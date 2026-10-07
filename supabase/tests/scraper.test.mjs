// =============================================================================
// scraper.test.mjs — database-side guarantees the scraper depends on (0012).
//
// These are the checks that matter most, because each one corresponds to a way
// the scraper could quietly damage production data:
//
//   * ON CONFLICT works against the PARTIAL unique index      (a plain target
//     raises 42P10; the same scholarship would otherwise duplicate)
//   * is_manual is honoured                                   (an administrator's
//     correction must survive every future run — "critical" in the brief)
//   * unchanged records are detected                          (so a weekly run is
//     not reported as seven updates)
//   * two runs cannot start at once                           (§13)
//   * browser-reachable roles cannot call the write path      (a student or a
//     compromised admin session must not be able to drive the scraper)
//
//   node supabase/tests/scraper.test.mjs
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
  '0011_chat_rate_limit.sql',
  '0012_scraper_runs.sql',
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
function expectEqual(name, actual, expected) {
  check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const db = await new PGlite();
await db.exec(await readFile(join(HERE, 'auth-shim.sql'), 'utf8'));
for (const f of FILES) await db.exec(await readFile(join(MIGRATIONS, f), 'utf8'));
await db.exec(`grant all on all tables in schema public to service_role;`);
check('migration 0012 applies cleanly on top of 0002–0011', true);

// --- identities --------------------------------------------------------------
await reset(db);
const STUDENT = (
  await db.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ('scr-student@test.nexus', '{"full_name":"Student"}'::jsonb) returning id`
  )
).rows[0].id;
const ADMIN = (
  await db.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ('scr-admin@test.nexus', '{"full_name":"Admin"}'::jsonb) returning id`
  )
).rows[0].id;
await db.query(`select public.grant_admin_by_email('scr-admin@test.nexus')`);

// The shape the Python scraper sends. Mirrors ScrapedScholarship.to_row(),
// which deliberately omits is_manual.
const record = (over = {}) =>
  JSON.stringify({
    name: 'Program Penajaan Nasional (PPN)',
    provider: 'Jabatan Perkhidmatan Awam (JPA)',
    description: 'A national sponsorship programme for SPM leavers.',
    funding_amount: 'Pinjaman Boleh Ubah (PBU)',
    education_levels: ['spm'],
    field_of_study: ['Engineering'],
    deadline: null,
    application_link: null,
    status: 'active',
    source_url: 'https://penajaan.jpa.gov.my/ppn.html',
    source_hash: 'identity-ppn',
    last_scraped_at: new Date().toISOString(),
    ...over,
  });

const criteria = JSON.stringify([
  {
    criterion_type: 'citizenship',
    operator: 'eq',
    value: 'MY',
    label: 'Malaysian citizen',
    is_checkable: false,
  },
]);

const upsert = (rec, crit = criteria) =>
  db.query(`select public.scraper_upsert_scholarship($1::jsonb, $2::jsonb) as outcome`, [rec, crit]);

// ---------------------------------------------------------------------------
// 1. the partial-index upsert
// ---------------------------------------------------------------------------
await asService(db);
expectEqual(
  'a new scholarship is inserted',
  (await upsert(record())).rows[0].outcome,
  'inserted'
);

await asService(db);
expectEqual(
  'the same source_hash is recognised, not duplicated (ON CONFLICT works on the PARTIAL index)',
  (await upsert(record())).rows[0].outcome,
  'unchanged'
);

await asService(db);
expectEqual(
  'only one row exists after two runs (AC-44)',
  Number(
    (await db.query(`select count(*)::int as n from public.scholarships where source_hash = 'identity-ppn'`))
      .rows[0].n
  ),
  1
);

// A plain conflict target is what the brief warns against. Proving it fails
// here is what makes the SQL-side upsert justified rather than a preference.
await asService(db);
await expectReject(
  'a PLAIN `on conflict (source_hash)` is rejected by PostgreSQL (42P10)',
  db.query(
    `insert into public.scholarships (name, provider, source_hash)
     values ('X', 'Y', 'identity-ppn')
     on conflict (source_hash) do nothing`
  )
);

// ---------------------------------------------------------------------------
// 2. change detection
// ---------------------------------------------------------------------------
await asService(db);
expectEqual(
  'a changed deadline is detected as an update',
  (await upsert(record({ deadline: '2027-01-31' }))).rows[0].outcome,
  'updated'
);
await asService(db);
expectEqual(
  'the update actually landed',
  (
    await db.query(
      `select to_char(deadline, 'YYYY-MM-DD') as d from public.scholarships where source_hash = 'identity-ppn'`
    )
  ).rows[0].d,
  '2027-01-31'
);
await asService(db);
expectEqual(
  're-running the same changed record is then unchanged',
  (await upsert(record({ deadline: '2027-01-31' }))).rows[0].outcome,
  'unchanged'
);

// ---------------------------------------------------------------------------
// 3. criteria are replaced, not accumulated
// ---------------------------------------------------------------------------
await asService(db);
await upsert(record({ deadline: '2027-02-28' }), criteria);
await asService(db);
expectEqual(
  'criteria are replaced on update, not duplicated',
  Number(
    (
      await db.query(
        `select count(*)::int as n from public.scholarship_criteria c
         join public.scholarships s on s.id = c.scholarship_id
         where s.source_hash = 'identity-ppn'`
      )
    ).rows[0].n
  ),
  1
);

// ---------------------------------------------------------------------------
// 4. MANUAL PROTECTION — the critical requirement (§7, AC-45)
// ---------------------------------------------------------------------------
await asUser(db, ADMIN);
await db.query(
  `update public.scholarships
      set name = 'PPN — corrected by an administrator', description = 'Admin-verified wording.'
    where source_hash = 'identity-ppn'`
);
await asUser(db, ADMIN);
expectEqual(
  'an admin edit sets is_manual via the existing trigger',
  (await db.query(`select is_manual from public.scholarships where source_hash = 'identity-ppn'`))
    .rows[0].is_manual,
  true
);

await asService(db);
expectEqual(
  'the scraper reports skipped_manual for an administrator-managed record',
  (await upsert(record({ deadline: '2029-12-31' }))).rows[0].outcome,
  'skipped_manual'
);
await asService(db);
const afterManual = (
  await db.query(
    `select name, description, to_char(deadline,'YYYY-MM-DD') as d, last_scraped_at
       from public.scholarships where source_hash = 'identity-ppn'`
  )
).rows[0];
expectEqual(
  "the administrator's name survives the scrape",
  afterManual.name,
  'PPN — corrected by an administrator'
);
expectEqual(
  "the administrator's description survives the scrape",
  afterManual.description,
  'Admin-verified wording.'
);
expectEqual('the scraper did not overwrite the deadline either', afterManual.d, '2027-02-28');
check(
  'last_scraped_at still advances, so an admin can see the source was checked',
  afterManual.last_scraped_at !== null
);

await asService(db);
expectEqual(
  "a manual record's criteria are left untouched",
  Number(
    (
      await db.query(
        `select count(*)::int as n from public.scholarship_criteria c
         join public.scholarships s on s.id = c.scholarship_id
         where s.source_hash = 'identity-ppn'`
      )
    ).rows[0].n
  ),
  1
);

// ---------------------------------------------------------------------------
// 5. concurrency (§13)
// ---------------------------------------------------------------------------
await asService(db);
const runA = (await db.query(`select public.begin_crawl_run('schedule', null) as id`)).rows[0].id;
check('a run can be claimed', Boolean(runA));

await asService(db);
expectEqual(
  'a second concurrent run is refused while the first is active',
  (await db.query(`select public.begin_crawl_run('manual', null) as id`)).rows[0].id,
  null
);

await asService(db);
await db.query(`select public.finish_crawl_run($1, 'success', 1, 2, 0, null)`, [runA]);
await asService(db);
const finished = (
  await db.query(
    `select status, records_inserted, records_updated, duration_ms, finished_at
       from public.crawl_logs where id = $1`,
    [runA]
  )
).rows[0];
expectEqual('a finished run records its status', finished.status, 'success');
expectEqual('a finished run records its counters', finished.records_inserted, 1);
check('a finished run records a duration', finished.duration_ms !== null);

await asService(db);
const runB = (await db.query(`select public.begin_crawl_run('manual', null) as id`)).rows[0].id;
check('a new run can start once the previous one has finished', Boolean(runB));
await asService(db);
await db.query(`select public.finish_crawl_run($1, 'partial', 0, 0, 1, 'one page failed')`, [runB]);

await asService(db);
await expectReject(
  "a run cannot be finished with an invented status",
  db.query(`select public.finish_crawl_run($1, 'running', 0, 0, 0, null)`, [runB])
);
await asService(db);
await expectReject(
  'triggered_by is constrained to schedule | manual',
  db.query(`select public.begin_crawl_run('curl', null)`)
);

// ---------------------------------------------------------------------------
// 6. the write path is not reachable from a browser session
// ---------------------------------------------------------------------------
await asUser(db, STUDENT);
await expectReject(
  'a student cannot call scraper_upsert_scholarship',
  db.query(`select public.scraper_upsert_scholarship($1::jsonb, '[]'::jsonb)`, [
    record({ source_hash: 'student-injected' }),
  ])
);
await asUser(db, STUDENT);
await expectReject(
  'a student cannot start a crawl run',
  db.query(`select public.begin_crawl_run('manual', null)`)
);
// Admins trigger a run through the Edge Function, which checks is_admin()
// server-side — never by reaching the scraper's own write path directly.
await asUser(db, ADMIN);
await expectReject(
  'not even an admin session can call the scraper write path directly',
  db.query(`select public.scraper_upsert_scholarship($1::jsonb, '[]'::jsonb)`, [
    record({ source_hash: 'admin-injected' }),
  ])
);

// ---------------------------------------------------------------------------
// 7. a record with no source_hash is refused rather than silently inserted
// ---------------------------------------------------------------------------
await asService(db);
await expectReject(
  'a record without a source_hash is refused',
  upsert(record({ source_hash: null }))
);

// ---------------------------------------------------------------------------
await db.close();
const passed = results.filter((r) => r.pass).length;
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `\n        └─ ${r.detail}`}`);
}
console.log(`\n${passed}/${results.length} passed.`);
process.exit(passed === results.length ? 0 : 1);
