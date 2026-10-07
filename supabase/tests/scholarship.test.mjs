// =============================================================================
// scholarship.test.mjs — database-side checks for the scholarship module.
//
//   * students cannot modify authoritative scholarship records
//   * administrators can, and every write is audited (FR-SEC-09 / AC-46)
//   * is_manual protects admin corrections from the crawler (§10.7 / AC-45)
//   * crawler upserts update rather than duplicate (AC-44)
//   * deadline bands and expiry (AC-30 / D-25)
//   * saved_items stays owner-scoped
//
//   node supabase/tests/scholarship.test.mjs
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
  '0009_seed_find_your_path.sql',
  '0010_scholarship_operations.sql',
];

const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });

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
async function asAnon(db) {
  await reset(db);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ role: 'anon' }),
  ]);
  await db.exec('set role anon;');
}
async function asService(db) {
  await reset(db);
  await db.exec('set role service_role;');
}
async function expectReject(name, promise) {
  try {
    await promise;
    check(name, false, 'expected rejection, statement succeeded');
  } catch (e) {
    check(name, true, e.message.split('\n')[0]);
  }
}
async function expectAffected(name, promise, expected) {
  try {
    const r = await promise;
    check(name, (r.affectedRows ?? 0) === expected, `affected ${r.affectedRows ?? 0}`);
  } catch (e) {
    check(name, false, `error: ${e.message.split('\n')[0]}`);
  }
}
async function expectOk(name, promise) {
  try {
    await promise;
    check(name, true);
  } catch (e) {
    check(name, false, `error: ${e.message.split('\n')[0]}`);
  }
}

const db = await new PGlite();
await db.exec(await readFile(join(HERE, 'auth-shim.sql'), 'utf8'));
for (const f of FILES) await db.exec(await readFile(join(MIGRATIONS, f), 'utf8'));
await db.exec(`grant all on all tables in schema public to service_role;`);

// --- identities -------------------------------------------------------------
await reset(db);
const STUDENT = (
  await db.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ('sch-student@test.nexus', '{"full_name":"Student"}'::jsonb) returning id`
  )
).rows[0].id;
const OTHER = (
  await db.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ('sch-other@test.nexus', '{"full_name":"Other"}'::jsonb) returning id`
  )
).rows[0].id;
const ADMIN = (
  await db.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ('sch-admin@test.nexus', '{"full_name":"Admin"}'::jsonb) returning id`
  )
).rows[0].id;
await db.query(`select public.grant_admin_by_email('sch-admin@test.nexus')`);

// A crawler-provided record: written under the service role, so no human actor.
await asService(db);
const CRAWLED = (
  await db.query(
    `insert into public.scholarships (name, provider, status, deadline, source_url, source_hash, field_of_study, education_levels)
     values ('Crawled Award', 'Provider A', 'active', current_date + 45, 'https://example.gov.my/a',
             'hash-a', '{Engineering}', '{spm}')
     returning id`
  )
).rows[0].id;

// ---------------------------------------------------------------------------
// 1. students must not modify authoritative records (§4.5)
// ---------------------------------------------------------------------------
await asUser(db, STUDENT);
await expectReject(
  'a student cannot insert a scholarship',
  db.query(`insert into public.scholarships (name, provider) values ('Fake', 'Fake')`)
);
await asUser(db, STUDENT);
await expectAffected(
  'a student cannot update a scholarship',
  db.query(`update public.scholarships set name = 'Hijacked' where id = $1`, [CRAWLED]),
  0
);
await asUser(db, STUDENT);
await expectAffected(
  'a student cannot delete a scholarship',
  db.query(`delete from public.scholarships where id = $1`, [CRAWLED]),
  0
);
await asUser(db, STUDENT);
await expectReject(
  'a student cannot add eligibility criteria',
  db.query(
    `insert into public.scholarship_criteria (scholarship_id, criterion_type, operator, value, label)
     values ($1, 'citizenship', 'eq', '"MY"'::jsonb, 'Injected')`,
    [CRAWLED]
  )
);

// ---------------------------------------------------------------------------
// 2. public read access (§4.5 / AC-33)
// ---------------------------------------------------------------------------
await asAnon(db);
await expectOk(
  'an anonymous visitor can browse scholarships',
  db.query(`select * from public.scholarships`)
);
await asAnon(db);
await expectOk(
  'an anonymous visitor can read eligibility criteria',
  db.query(`select * from public.scholarship_criteria`)
);
await asAnon(db);
await expectReject(
  'an anonymous visitor cannot write a scholarship',
  db.query(`insert into public.scholarships (name, provider) values ('Fake', 'Fake')`)
);

// ---------------------------------------------------------------------------
// 3. administrators can manage records, and it is audited
// ---------------------------------------------------------------------------
await asUser(db, ADMIN);
const MANUAL = (
  await db.query(
    `insert into public.scholarships (name, provider, status, deadline, field_of_study, education_levels)
     values ('Admin Entered Award', 'Provider B', 'active', current_date + 20, '{Medicine}', '{spm}')
     returning id`
  )
).rows[0].id;
check('an admin can create a scholarship', Boolean(MANUAL));

await asUser(db, ADMIN);
await expectOk(
  'an admin can add eligibility criteria',
  db.query(
    `insert into public.scholarship_criteria (scholarship_id, criterion_type, operator, value, label, is_checkable)
     values ($1, 'education_level', 'eq', '"spm"'::jsonb, 'SPM leaver', true),
            ($1, 'other', 'eq', 'null'::jsonb, 'Leadership experience', false)`,
    [MANUAL]
  )
);

await reset(db);
const audit = await db.query(
  `select action, target_table, actor_user_id, metadata from public.audit_log
   where target_table in ('scholarships','scholarship_criteria') order by created_at`
);
check(
  'every admin write created an audit entry naming the actor (AC-46)',
  audit.rows.length === 3 && audit.rows.every((r) => r.actor_user_id === ADMIN),
  JSON.stringify(audit.rows.map((r) => r.action))
);
check(
  'the audit entry records the action and target table',
  audit.rows[0].action === 'scholarships.insert' &&
    audit.rows[0].target_table === 'scholarships',
  JSON.stringify(audit.rows[0])
);

await reset(db);
const crawlerAudit = await db.query(
  `select count(*)::int c from public.audit_log where metadata->>'name' = 'Crawled Award'`
);
check(
  'a crawler (service-role) write is NOT audited as an admin action — crawl_logs covers it',
  crawlerAudit.rows[0].c === 0
);

await asUser(db, ADMIN);
await expectAffected(
  'an admin cannot tamper with the audit trail (AC-11)',
  db.query(`update public.audit_log set action = 'x'`).catch(() => ({ affectedRows: -1 })),
  -1
);

// ---------------------------------------------------------------------------
// 4. is_manual — protecting corrections from the crawler (§10.7 / AC-45)
// ---------------------------------------------------------------------------
await reset(db);
const manualFlag = await db.query(`select is_manual from public.scholarships where id = $1`, [MANUAL]);
check(
  'a record created by an admin is flagged is_manual (§10.7)',
  manualFlag.rows[0].is_manual === true
);
const crawledFlag = await db.query(`select is_manual from public.scholarships where id = $1`, [CRAWLED]);
check(
  'a record written by the crawler is not flagged is_manual',
  crawledFlag.rows[0].is_manual === false
);

await asUser(db, ADMIN);
await db.query(`update public.scholarships set description = 'Corrected by admin' where id = $1`, [
  CRAWLED,
]);
await reset(db);
const afterEdit = await db.query(`select is_manual from public.scholarships where id = $1`, [CRAWLED]);
check(
  'an admin edit to a crawled record sets is_manual (§10.7)',
  afterEdit.rows[0].is_manual === true
);

// the crawler's guarded upsert must now skip that record (AC-45)
await asService(db);
await db.query(
  `update public.scholarships set name = 'Overwritten by crawler', description = null
   where source_hash = 'hash-a' and is_manual = false`
);
await reset(db);
const survived = await db.query(`select name, description from public.scholarships where id = $1`, [
  CRAWLED,
]);
check(
  'the weekly crawler does not overwrite an is_manual record (AC-45)',
  survived.rows[0].name === 'Crawled Award' &&
    survived.rows[0].description === 'Corrected by admin',
  JSON.stringify(survived.rows[0])
);

// ---------------------------------------------------------------------------
// 5. crawler upsert updates rather than duplicates (AC-44)
// ---------------------------------------------------------------------------
await asService(db);
await db.query(
  `insert into public.scholarships (name, provider, status, source_url, source_hash)
   values ('Second Award', 'Provider C', 'active', 'https://example.gov.my/c', 'hash-c')`
);
// NOTE: uq_scholarships_source_hash is a PARTIAL index (WHERE source_hash IS
// NOT NULL), so the upsert must repeat that predicate for the arbiter index to
// be inferred. The Stage 9 crawler must use this exact form.
await asService(db);
await db.query(
  `insert into public.scholarships (name, provider, status, source_url, source_hash)
   values ('Second Award (updated)', 'Provider C', 'active', 'https://example.gov.my/c', 'hash-c')
   on conflict (source_hash) where source_hash is not null
   do update set name = excluded.name`
);
await reset(db);
const dupes = await db.query(
  `select count(*)::int c, max(name) n from public.scholarships where source_hash = 'hash-c'`
);
check(
  're-running the crawler updates the existing record rather than duplicating it (AC-44)',
  dupes.rows[0].c === 1 && dupes.rows[0].n === 'Second Award (updated)',
  JSON.stringify(dupes.rows[0])
);

// ---------------------------------------------------------------------------
// 6. deadline bands and expiry (AC-30 / D-25)
// ---------------------------------------------------------------------------
await reset(db);
const bands = await db.query(`
  select public.deadline_urgency((current_date + 6)::date)  d6,
         public.deadline_urgency((current_date + 7)::date)  d7,
         public.deadline_urgency((current_date + 8)::date)  d8,
         public.deadline_urgency((current_date + 30)::date) d30,
         public.deadline_urgency((current_date + 31)::date) d31,
         public.deadline_urgency(null)                      dnull
`);
const b = bands.rows[0];
check(
  'deadline bands: 6/7 critical, 8/30 warning, 31 normal, null none (AC-30)',
  b.d6 === 'critical' &&
    b.d7 === 'critical' &&
    b.d8 === 'warning' &&
    b.d30 === 'warning' &&
    b.d31 === 'warning' === false &&
    b.d31 === 'normal' &&
    b.dnull === 'none',
  JSON.stringify(b)
);

await asService(db);
const PAST = (
  await db.query(
    `insert into public.scholarships (name, provider, status, deadline)
     values ('Closed Award', 'Provider D', 'active', current_date - 1) returning id`
  )
).rows[0].id;
await reset(db);
const expired = await db.query(`select public.expire_past_deadlines() c`);
check('expire_past_deadlines() closes a past-deadline record (D-25)', expired.rows[0].c >= 1);
const pastRow = await db.query(`select status, is_manual from public.scholarships where id = $1`, [
  PAST,
]);
check(
  'expiry sets status = expired and does NOT mark the record as manual',
  pastRow.rows[0].status === 'expired' && pastRow.rows[0].is_manual === false,
  JSON.stringify(pastRow.rows[0])
);
const activeStill = await db.query(
  `select status from public.scholarships where id = $1`,
  [MANUAL]
);
check(
  'a future deadline is left active',
  activeStill.rows[0].status === 'active',
  JSON.stringify(activeStill.rows[0])
);

// expired records stay reachable by direct link (§10.2)
await asAnon(db);
const direct = await db.query(`select id from public.scholarships where id = $1`, [PAST]);
check('an expired record is still readable by direct link (§10.2)', direct.rows.length === 1);

// ---------------------------------------------------------------------------
// 7. student data — saved items stay owner-scoped
// ---------------------------------------------------------------------------
await asUser(db, STUDENT);
await expectOk(
  'a student can save a scholarship',
  db.query(
    `insert into public.saved_items (user_id, item_type, item_id) values ($1, 'scholarship', $2)`,
    [STUDENT, MANUAL]
  )
);
await asUser(db, STUDENT);
await expectReject(
  'a student cannot save an item on behalf of someone else',
  db.query(
    `insert into public.saved_items (user_id, item_type, item_id) values ($1, 'scholarship', $2)`,
    [OTHER, MANUAL]
  )
);
await asUser(db, OTHER);
const theirs = await db.query(`select * from public.saved_items`);
check("another student cannot see the first student's saved items", theirs.rows.length === 0);

await asUser(db, STUDENT);
await expectOk(
  'a student can track their application status',
  db.query(
    `update public.saved_items set application_status = 'preparing'
     where user_id = $1 and item_id = $2`,
    [STUDENT, MANUAL]
  )
);
await asUser(db, STUDENT);
await expectReject(
  'application_status is constrained to the documented set',
  db.query(`update public.saved_items set application_status = 'invented' where user_id = $1`, [
    STUDENT,
  ])
);

// ---------------------------------------------------------------------------
// 8. data integrity constraints
// ---------------------------------------------------------------------------
await asUser(db, ADMIN);
await expectReject(
  'application_link must be https (§3.4)',
  db.query(
    `insert into public.scholarships (name, provider, application_link)
     values ('Insecure', 'X', 'http://example.com')`
  )
);
await asUser(db, ADMIN);
await expectReject(
  'status is constrained to active/expired/flagged/archived',
  db.query(`insert into public.scholarships (name, provider, status) values ('X', 'Y', 'invented')`)
);
await asUser(db, ADMIN);
await expectReject(
  'criterion_type is constrained to the seven documented types',
  db.query(
    `insert into public.scholarship_criteria (scholarship_id, criterion_type, operator, value, label)
     values ($1, 'income', 'eq', '"x"'::jsonb, 'Household income')`,
    [MANUAL]
  )
);

// ---------------------------------------------------------------------------
await db.close();
const passed = results.filter((r) => r.pass).length;
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `\n        └─ ${r.detail}`}`);
}
console.log(`\n${passed}/${results.length} passed.`);
process.exit(passed === results.length ? 0 : 1);
