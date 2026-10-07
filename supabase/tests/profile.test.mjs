// =============================================================================
// profile.test.mjs — authentication & profile-ownership checks against real RLS.
// Applies supabase/migrations/* into PGlite on top of auth-shim.sql and asserts
// the guarantees this feature relies on (architecture.md §4.3, §4.4, §5).
//
//   node supabase/tests/profile.test.mjs
// =============================================================================
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', 'migrations');
const FILES = [
  '0002_core_tables.sql',
  '0003_reference_tables.sql',
  '0004_security_tables.sql',
  '0005_functions.sql',
  '0006_rls_policies.sql',
  '0007_seed_reference_data.sql',
  '0008_auth_consent.sql',
];

const results = [];
const rec = (name, pass, detail = '') => results.push({ name, pass, detail });

async function reset(db) {
  await db.exec('reset role;');
  await db.query(`select set_config('request.jwt.claims', '', false)`);
}
async function asUser(db, uid) {
  await reset(db);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: uid, role: 'authenticated' }),
  ]);
  await db.exec('set role authenticated;');
}
async function rows(name, promise, expected) {
  try {
    const r = await promise;
    rec(name, r.rows.length === expected, `got ${r.rows.length}, expected ${expected}`);
  } catch (e) {
    rec(name, false, `error: ${e.message.split('\n')[0]}`);
  }
}
async function affected(name, promise, expected) {
  try {
    const r = await promise;
    rec(name, (r.affectedRows ?? 0) === expected, `affected ${r.affectedRows ?? 0}, expected ${expected}`);
  } catch (e) {
    rec(name, false, `error: ${e.message.split('\n')[0]}`);
  }
}
async function reject(name, promise) {
  try {
    await promise;
    rec(name, false, 'expected rejection, succeeded');
  } catch (e) {
    rec(name, true, e.message.split('\n')[0]);
  }
}
async function ok(name, promise) {
  try {
    await promise;
    rec(name, true, '');
  } catch (e) {
    rec(name, false, `error: ${e.message.split('\n')[0]}`);
  }
}

const db = await new PGlite();
await db.exec(await readFile(join(HERE, 'auth-shim.sql'), 'utf8'));
for (const f of FILES) await db.exec(await readFile(join(MIGRATIONS, f), 'utf8'));
await db.exec(`grant all on all tables in schema public to service_role;`);

// --- registration path: auth.users insert with consent metadata -----------
await reset(db);
const A = (
  await db.query(
    `insert into auth.users (email, raw_user_meta_data) values
     ('a@test.nexus', jsonb_build_object('full_name','Student A','consent_version','2026-01-01','consent_at', now()::text))
     returning id`
  )
).rows[0].id;
const B = (
  await db.query(
    `insert into auth.users (email, raw_user_meta_data) values
     ('b@test.nexus', jsonb_build_object('full_name','Student B','consent_version','2026-01-01','consent_at', now()::text))
     returning id`
  )
).rows[0].id;

await rows(
  'sign-up creates a student profile with role=student, profile_completed=false',
  db.query(
    `select 1 from public.profiles where id='${A}' and role='student' and profile_completed=false and full_name='Student A'`
  ),
  1
);
await rows(
  'sign-up records consent on the profile (FR-SEC-10)',
  db.query(`select 1 from public.profiles where id='${A}' and consent_version='2026-01-01' and consent_at is not null`),
  1
);
await rows(
  'sign-up appends a consent_records row (FR-SEC-10 / NFR05)',
  db.query(`select 1 from public.consent_records where user_id='${A}' and policy_version='2026-01-01'`),
  1
);

// --- profile ownership (architecture.md §4.3) ----------------------------
await asUser(db, A);
await rows('A reads own profile', db.query(`select * from public.profiles where id='${A}'`), 1);
await asUser(db, A);
await rows("A reads B's profile", db.query(`select * from public.profiles where id='${B}'`), 0);

await asUser(db, A);
await ok(
  'A edits an allowed field on own profile (full_name, career_goal, education_level)',
  db.query(
    `update public.profiles set full_name='A. Edited', career_goal='Doctor', education_level='spm' where id='${A}'`
  )
);
await asUser(db, A);
await affected(
  "A cannot edit B's profile",
  db.query(`update public.profiles set full_name='hacked' where id='${B}'`),
  0
);

// --- privilege escalation (architecture.md §4.3 / §5.7 / RR-10) ----------
await asUser(db, A);
await reject(
  "A cannot set own role to 'admin' (trg_protect_role)",
  db.query(`update public.profiles set role='admin' where id='${A}'`)
);
await asUser(db, A);
await ok(
  'A can set own profile_completed = true (finish the wizard)',
  db.query(`update public.profiles set profile_completed=true where id='${A}'`)
);

// --- consent_records is owner-scoped and append-only --------------------
await asUser(db, A);
await rows('A reads own consent_records', db.query(`select * from public.consent_records`), 1);
await asUser(db, A);
await rows("A cannot read B's consent_records", db.query(`select * from public.consent_records where user_id='${B}'`), 0);
await asUser(db, A);
await reject(
  'consent_records cannot be updated (append-only)',
  db.query(`update public.consent_records set policy_version='tampered' where user_id='${A}'`)
);
await asUser(db, A);
await reject(
  'consent_records cannot be deleted (append-only)',
  db.query(`delete from public.consent_records where user_id='${A}'`)
);

// --- account deletion cascades (FR-SEC-11 groundwork) ------------------
// On Supabase this runs via the admin API / an Edge Function under the service
// role; here it runs in the trusted bootstrap context.
await reset(db);
await db.query(`delete from auth.users where id='${A}'`);
await rows('deleting the auth user cascades away the profile', db.query(`select 1 from public.profiles where id='${A}'`), 0);
await rows('and the consent trail', db.query(`select 1 from public.consent_records where user_id='${A}'`), 0);

// --- report ----------------------------------------------------------
await db.close();
const passed = results.filter((r) => r.pass).length;
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `\n        └─ ${r.detail}`}`);
console.log(`\n${passed}/${results.length} passed.`);
process.exit(passed === results.length ? 0 : 1);
