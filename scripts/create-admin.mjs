/**
 * One-time administrator bootstrap (architecture.md §5.7 / FR-SEC-13 / D-38).
 *
 * There is no admin self-registration and no application code path that writes
 * `profiles.role` — a BEFORE UPDATE trigger rejects any role change unless the
 * caller is already an admin (RR-10 / AC-08). The first admin therefore has to
 * be created out of band, and this script is that documented procedure.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-admin.mjs <email> <password>
 *
 * It does two things:
 *   1. creates a confirmed auth user via the Auth Admin API
 *   2. calls public.grant_admin_by_email(), which suspends the role trigger for
 *      exactly one statement and writes an audit_log entry recording the grant
 *
 * The service-role key is read from the environment for this one command and is
 * never written to disk. Do not put it in .env: `src/config/env.js` throws if a
 * secret is VITE_-prefixed, but the safest place for it is nowhere local.
 */
import { readFile } from 'node:fs/promises';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-admin.mjs <email> <password>');
  process.exit(1);
}

// --- read the project URL from .env (it is not a secret) --------------------
async function readEnv() {
  const out = {};
  try {
    const text = await readFile('.env', 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    /* no .env */
  }
  return out;
}

const env = await readEnv();
const url = process.env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  console.error('No Supabase URL. Set VITE_SUPABASE_URL in .env or SUPABASE_URL in the environment.');
  process.exit(1);
}

// --- warn where the password breaks the app's own policy --------------------
// D-36: at least 8 characters, with a letter and a digit. The Auth Admin API
// bypasses the client-side form, so a password set here can be one the app
// itself would refuse — worth knowing before it becomes confusing later.
const policyProblems = [];
if (password.length < 8) policyProblems.push('fewer than 8 characters');
if (!/[A-Za-z]/.test(password)) policyProblems.push('no letter');
if (!/[0-9]/.test(password)) policyProblems.push('no digit');

if (policyProblems.length) {
  console.warn(
    `\n  WARNING  "${'*'.repeat(password.length)}" does not meet the password policy in\n` +
      `           architecture.md §5.1 (D-36): ${policyProblems.join(', ')}.\n` +
      `           The Auth Admin API accepts it, but the app's own Register and\n` +
      `           Change-password forms would reject it. Fine for local development;\n` +
      `           change it before any deployment or demo that is publicly reachable.\n`
  );
}

if (!serviceKey) {
  console.log(`
No SUPABASE_SERVICE_ROLE_KEY in the environment, so the account cannot be
created from here. Two options:

  A. Re-run with the key (Dashboard -> Project Settings -> API -> service_role):

       SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/create-admin.mjs ${email} <password>

  B. Do it by hand, which needs no key locally:

       1. Dashboard -> Authentication -> Users -> "Add user"
          email: ${email}
          password: <your password>
          tick "Auto Confirm User"

       2. Dashboard -> SQL Editor:

          select public.grant_admin_by_email('${email}');

Either way, step 2 is what actually grants the role. Creating the user alone
leaves them an ordinary student.
`);
  process.exit(1);
}

// --- 1. create the auth user ------------------------------------------------
const base = url.replace(/\/$/, '');
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

console.log(`Creating ${email} …`);
const created = await fetch(`${base}/auth/v1/admin/users`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    email,
    password,
    email_confirm: true, // skip the OTP step for a bootstrap account
    user_metadata: { full_name: 'Administrator' },
  }),
});

const body = await created.json().catch(() => ({}));

if (!created.ok) {
  const alreadyExists = /already been registered|already exists/i.test(JSON.stringify(body));
  if (alreadyExists) {
    console.log('  Account already exists — continuing to the role grant.');
  } else {
    console.error(`  Failed (${created.status}):`, JSON.stringify(body).slice(0, 300));
    process.exit(1);
  }
} else {
  console.log('  Created and confirmed.');
}

// --- 2. grant the role ------------------------------------------------------
console.log('Granting the administrator role …');
const granted = await fetch(`${base}/rest/v1/rpc/grant_admin_by_email`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ p_email: email }),
});

if (!granted.ok) {
  const text = await granted.text().catch(() => '');
  console.error(`  Failed (${granted.status}): ${text.slice(0, 300)}`);
  console.error('\n  Run this in the SQL Editor instead:');
  console.error(`    select public.grant_admin_by_email('${email}');`);
  process.exit(1);
}

console.log(`  Done. ${email} is now an administrator.`);
console.log('\nSign in, then open /admin. The grant is recorded in the audit log.');
