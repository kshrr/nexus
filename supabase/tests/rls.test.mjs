// =============================================================================
// rls.test.mjs — deliverable A-01 (architecture.md §4.9)
//
// Applies supabase/migrations/* into an in-process PostgreSQL (PGlite, no Docker)
// on top of auth-shim.sql, then runs the RLS assurance matrix as real
// unprivileged roles. Prints a pass/fail table and exits non-zero on any fail.
//
//   node supabase/tests/rls.test.mjs
// =============================================================================
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', 'migrations');

const MIGRATION_FILES = [
  '0001_extensions.sql',
  '0002_core_tables.sql',
  '0003_reference_tables.sql',
  '0004_security_tables.sql',
  '0005_functions.sql',
  '0006_rls_policies.sql',
  '0007_seed_reference_data.sql',
];

// --- session role helpers ----------------------------------------------------
async function reset(db) {
  await db.exec(`reset role;`);
  await db.query(`select set_config('request.jwt.claims', '', false)`);
}
async function asUser(db, uid) {
  await reset(db);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: uid, role: 'authenticated' }),
  ]);
  await db.exec(`set role authenticated;`);
}
async function asAnon(db) {
  await reset(db);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ role: 'anon' }),
  ]);
  await db.exec(`set role anon;`);
}
async function asService(db) {
  await reset(db);
  await db.exec(`set role service_role;`);
}

// --- assertion helpers -----------------------------------------------------
const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
}
async function expectRows(name, promise, expected) {
  try {
    const res = await promise;
    const n = res.rows.length;
    record(name, n === expected, `got ${n} row(s), expected ${expected}`);
  } catch (err) {
    record(name, false, `unexpected error: ${err.message}`);
  }
}
async function expectAffected(name, promise, expected) {
  try {
    const res = await promise;
    const n = res.affectedRows ?? 0;
    record(name, n === expected, `affected ${n}, expected ${expected}`);
  } catch (err) {
    record(name, false, `unexpected error: ${err.message}`);
  }
}
async function expectReject(name, promise) {
  try {
    await promise;
    record(name, false, 'expected an error, statement succeeded');
  } catch (err) {
    record(name, true, `rejected: ${String(err.message).split('\n')[0]}`);
  }
}
// Pass when the caller obtains no data — whether RLS filtered to 0 rows or the
// role lacks the table privilege entirely. Both mean "cannot read this".
async function expectNoData(name, promise) {
  try {
    const res = await promise;
    record(name, res.rows.length === 0, `got ${res.rows.length} row(s), expected none`);
  } catch (err) {
    record(name, /permission denied/i.test(err.message), `rejected: ${err.message.split('\n')[0]}`);
  }
}
async function expectOk(name, promise) {
  try {
    await promise;
    record(name, true, 'succeeded');
  } catch (err) {
    record(name, false, `unexpected error: ${err.message}`);
  }
}

// --- main ------------------------------------------------------------------
const db = await new PGlite();

// 1. platform shim
await db.exec(await readFile(join(HERE, 'auth-shim.sql'), 'utf8'));

// 2. migrations
for (const file of MIGRATION_FILES) {
  const sql = await readFile(join(MIGRATIONS, file), 'utf8');
  try {
    await db.exec(sql);
  } catch (err) {
    if (file === '0001_extensions.sql') {
      console.warn(`  (skipped ${file}: ${err.message.split('\n')[0]} — provided by the platform)`);
    } else {
      console.error(`\nMigration ${file} failed:\n${err.message}\n`);
      process.exit(1);
    }
  }
}
// On hosted Supabase the `service_role` is granted broad table access by the
// platform. Reproduce that here so service-context seeding behaves the same.
await db.exec(`
  grant all on all tables in schema public to service_role;
  grant all on all sequences in schema public to service_role;
`);

console.log('Migrations applied.\n');

// 3. seed identities via auth.users (fires handle_new_user -> profiles)
async function makeUser(email, name) {
  await reset(db);
  const { rows } = await db.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, jsonb_build_object('full_name', $2::text)) returning id`,
    [email, name]
  );
  return rows[0].id;
}
const A = await makeUser('a@test.nexus', 'Student A');
const B = await makeUser('b@test.nexus', 'Student B');
const C = await makeUser('c@test.nexus', 'Admin C');

// promote C (service/superuser context)
await reset(db);
await db.query(`select public.grant_admin_by_email('c@test.nexus')`);

// 4. seed owned data as each student
async function seedStudent(uid) {
  await asUser(db, uid);
  await db.query(
    `insert into public.riasec_results
       (user_id, realistic_score, investigative_score, artistic_score,
        social_score, enterprising_score, conventional_score, holland_code)
     values ($1, 10, 20, 15, 12, 8, 6, 'ISA')`,
    [uid]
  );
  await db.query(
    `insert into public.academic_results (user_id, exam_type, subject_code, grade)
     values ($1, 'spm_actual', 'MATH', 'A'), ($1, 'spm_actual', 'BIOLOGY', 'B+')`,
    [uid]
  );
  await db.query(`select public.compute_subject_strengths($1)`, [uid]);
  await db.query(
    `insert into public.recommendations
       (user_id, rec_type, target_id, match_score, rank, reasons, rule_id)
     values ($1, 'course', gen_random_uuid(), 85, 1, '[]'::jsonb, 'R-TEST-01')`,
    [uid]
  );
  await db.query(
    `insert into public.saved_items (user_id, item_type, item_id)
     values ($1, 'scholarship', gen_random_uuid())`,
    [uid]
  );
  await db.query(
    `insert into public.chat_messages (user_id, sender, message)
     values ($1, 'user', 'hello')`,
    [uid]
  );
}
await seedStudent(A);
await seedStudent(B);

// a scholarship + criterion for the public-read / admin-write tests
await asService(db);
const { rows: schRows } = await db.query(
  `insert into public.scholarships (name, provider, status, application_link)
   values ('Seed Scholarship', 'Seed Provider', 'active', 'https://example.gov.my/apply')
   returning id`
);
const SCH = schRows[0].id;
await db.query(
  `insert into public.scholarship_criteria (scholarship_id, criterion_type, operator, value, label)
   values ($1, 'citizenship', 'eq', '"MY"'::jsonb, 'Malaysian citizen')`,
  [SCH]
);
// an audit row so "update audit_log" has a target
await db.query(
  `insert into public.audit_log (actor_user_id, action) values ($1, 'seed.test')`,
  [C]
);
// a crawl log for the admin-only read test
await db.query(
  `insert into public.crawl_logs (status, triggered_by) values ('success', 'schedule')`
);

// =========================================================================
// A-01 MATRIX
// =========================================================================

// -- user isolation: reads --------------------------------------------------
await asUser(db, A);
await expectRows('A reads own riasec_results', db.query(`select * from public.riasec_results`), 1);
await asUser(db, A);
await expectRows(
  "A reads B's riasec_results",
  db.query(`select * from public.riasec_results where user_id = $1`, [B]),
  0
);
for (const tbl of ['academic_results', 'subject_strengths', 'recommendations', 'saved_items', 'chat_messages']) {
  await asUser(db, A);
  await expectRows(
    `A reads B's ${tbl} (AC-07)`,
    db.query(`select * from public.${tbl} where user_id = $1`, [B]),
    0
  );
}

// -- user isolation: writes -----------------------------------------------
await asUser(db, A);
await expectAffected(
  "A updates B's riasec_results",
  db.query(`update public.riasec_results set holland_code = 'RRR' where user_id = $1`, [B]),
  0
);
await asUser(db, A);
await expectAffected(
  "A deletes B's chat_messages",
  db.query(`delete from public.chat_messages where user_id = $1`, [B]),
  0
);
await asUser(db, A);
await expectReject(
  "A reassigns own recommendation row to B's user_id",
  db.query(`update public.recommendations set user_id = $1 where user_id = $2`, [B, A])
);
await asUser(db, A);
await expectReject(
  'A calls compute_subject_strengths for B',
  db.query(`select public.compute_subject_strengths($1)`, [B])
);

// -- privilege escalation --------------------------------------------------
await asUser(db, A);
await expectReject(
  "A sets own role to 'admin' (RR-10 / AC-08)",
  db.query(`update public.profiles set role = 'admin' where id = $1`, [A])
);
await asUser(db, A);
await expectOk(
  'A updates an allowed own-profile field',
  db.query(`update public.profiles set career_goal = 'Doctor' where id = $1`, [A])
);

// -- anonymous access ----------------------------------------------------
await asAnon(db);
await expectNoData('Anonymous reads profiles', db.query(`select * from public.profiles`));
await asAnon(db);
await expectRows(
  'Anonymous reads scholarships',
  db.query(`select * from public.scholarships`),
  1
);
await asAnon(db);
await expectReject(
  'Anonymous inserts a profile',
  db.query(`insert into public.profiles (id, full_name, email) values (gen_random_uuid(), 'X', 'x@x')`)
);

// -- reference-table write protection -----------------------------------
await asUser(db, A);
await expectReject(
  'A inserts a scholarship',
  db.query(`insert into public.scholarships (name, provider) values ('Fake', 'Fake')`)
);
await asUser(db, A);
await expectAffected(
  "A updates protected scholarship data",
  db.query(`update public.scholarships set name = 'Hijacked' where id = $1`, [SCH]),
  0
);
await asUser(db, A);
await expectAffected(
  'A deletes a scholarship',
  db.query(`delete from public.scholarships where id = $1`, [SCH]),
  0
);
await asUser(db, C);
await expectOk(
  'Admin inserts a scholarship',
  db.query(`insert into public.scholarships (name, provider) values ('Real', 'JPA')`)
);
await asUser(db, C);
await expectOk(
  'Admin updates a scholarship',
  db.query(`update public.scholarships set funding_amount = 'Full' where id = $1`, [SCH])
);

// -- admin has NO access to student advisory data (§4.4) ----------------
await asUser(db, C);
await expectRows(
  "Admin reads A's riasec_results (expect 0 — §4.4)",
  db.query(`select * from public.riasec_results where user_id = $1`, [A]),
  0
);
await asUser(db, C);
await expectRows(
  "Admin reads A's chat_messages (expect 0)",
  db.query(`select * from public.chat_messages where user_id = $1`, [A]),
  0
);

// -- audit log is append-only -----------------------------------------
await asUser(db, C);
await expectReject(
  'Admin updates audit_log (append-only — AC-11)',
  db.query(`update public.audit_log set action = 'tampered'`)
);
await asUser(db, C);
await expectReject(
  'Admin deletes from audit_log (append-only — AC-11)',
  db.query(`delete from public.audit_log`)
);
await asUser(db, A);
await expectReject(
  'A forges an audit_log row as another actor',
  db.query(`insert into public.audit_log (actor_user_id, action) values ($1, 'forged')`, [B])
);
await asUser(db, A);
await expectOk(
  'A writes an audit_log row as themselves',
  db.query(`insert into public.audit_log (actor_user_id, action) values ($1, 'self.action')`, [A])
);

// -- admin-only operational tables -------------------------------------
await asUser(db, A);
await expectRows('Student reads crawl_logs (expect 0)', db.query(`select * from public.crawl_logs`), 0);
await asUser(db, C);
await expectRows('Admin reads crawl_logs', db.query(`select * from public.crawl_logs`), 1);

// -- rate_limit_events unreachable from the browser -------------------
await asUser(db, A);
await expectReject(
  'Student selects from rate_limit_events (no grant)',
  db.query(`select * from public.rate_limit_events`)
);
await asAnon(db);
await expectReject(
  'Anonymous selects from rate_limit_events (no grant)',
  db.query(`select * from public.rate_limit_events`)
);

// -- RLS enabled on every public table --------------------------------
await reset(db);
const { rows: noRls } = await db.query(`
  select tablename from pg_tables
  where schemaname = 'public'
    and rowsecurity = false
`);
record(
  'RLS enabled on every public table',
  noRls.length === 0,
  noRls.length ? `missing on: ${noRls.map((r) => r.tablename).join(', ')}` : 'all tables'
);

// =========================================================================
// report
// =========================================================================
await db.close();

const pad = (s, n) => String(s).padEnd(n);
const passed = results.filter((r) => r.pass).length;
console.log('┌─────┬──────────────────────────────────────────────────────────────┬────────┐');
console.log(`│  #  │ ${pad('case', 60)} │ result │`);
console.log('├─────┼──────────────────────────────────────────────────────────────┼────────┤');
results.forEach((r, i) => {
  console.log(
    `│ ${pad(i + 1, 3)} │ ${pad(r.name, 60)} │ ${r.pass ? '  PASS  ' : ' *FAIL* '.trimEnd().padEnd(6)} │`
  );
  if (!r.pass) console.log(`│     │   └─ ${pad(r.detail, 70)}│`);
});
console.log('└─────┴──────────────────────────────────────────────────────────────┴────────┘');
console.log(`\n${passed}/${results.length} passed.`);

if (passed !== results.length) {
  console.log('\nFailures:');
  results.filter((r) => !r.pass).forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  process.exit(1);
}
console.log('All RLS assurance checks passed.');
