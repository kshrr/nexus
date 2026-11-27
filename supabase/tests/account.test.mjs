// =============================================================================
// account.test.mjs — migration 0038: a student can delete only their own account.
//   node supabase/tests/account.test.mjs
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
  '0038_delete_my_account.sql',
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
async function count(db, sql) {
  await reset(db);
  return Number((await db.query(sql)).rows[0].n);
}

const db = await new PGlite();
await db.exec(await readFile(join(HERE, 'auth-shim.sql'), 'utf8'));
for (const f of FILES) await db.exec(await readFile(join(MIGRATIONS, f), 'utf8'));
await db.exec(`grant all on all tables in schema public to service_role;`);

await reset(db);
const make = async (email) =>
  (await db.query(`insert into auth.users (email) values ('${email}') returning id`)).rows[0].id;
const A = await make('a@test.nexus');
const B = await make('b@test.nexus');
const ADMIN = await make('admin@test.nexus');
await db.query(`select public.grant_admin_by_email('admin@test.nexus')`);
await db.query(
  `insert into public.academic_results (user_id, subject_code, exam_type, grade)
   select '${A}', code, 'spm_actual', 'A' from public.subjects limit 2`
);
await db.query(
  `insert into public.academic_results (user_id, subject_code, exam_type, grade)
   select '${B}', code, 'spm_actual', 'B' from public.subjects limit 2`
);

// Signed-out callers are refused.
await reset(db);
await db.exec('set role anon;');
try {
  await db.query(`select public.delete_my_account()`);
  rec('anonymous callers cannot call delete_my_account', false, 'succeeded');
} catch (e) {
  rec('anonymous callers cannot call delete_my_account', true, e.message.split('\n')[0]);
}

// Admins are refused.
await asUser(db, ADMIN);
try {
  await db.query(`select public.delete_my_account()`);
  rec('admin accounts are refused', false, 'succeeded');
} catch (e) {
  rec('admin accounts are refused', /cannot be deleted/i.test(e.message), e.message.split('\n')[0]);
}
rec('refused admin still exists', (await count(db, `select count(*) n from auth.users where id='${ADMIN}'`)) === 1);

// A student deletes only themselves, and their data goes with them.
await asUser(db, A);
await db.query(`select public.delete_my_account()`);
rec('student account is deleted', (await count(db, `select count(*) n from auth.users where id='${A}'`)) === 0);
rec('profile is deleted with it', (await count(db, `select count(*) n from public.profiles where id='${A}'`)) === 0);
rec('their results are deleted with it', (await count(db, `select count(*) n from public.academic_results where user_id='${A}'`)) === 0);
rec('another student is untouched', (await count(db, `select count(*) n from auth.users where id='${B}'`)) === 1);
rec('another student keeps their results', (await count(db, `select count(*) n from public.academic_results where user_id='${B}'`)) === 2);

let failed = 0;
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : ' — ' + r.detail}`);
  if (!r.pass) failed += 1;
}
console.log(`\n${results.length - failed}/${results.length} passed.`);
process.exit(failed ? 1 : 0);
