import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
await db.exec(await readFile(new URL('./auth-shim.sql', import.meta.url), 'utf8'));
for (const file of (await readdir(new URL('../migrations/', import.meta.url)))
  .filter((f) => /^00(0[2-9]|1[0-6])_.*\.sql$/.test(f))
  .sort()) {
  await db.exec(await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'));
}
await db.exec(
  await readFile(
    new URL('../migrations/0020_three_university_course_sources.sql', import.meta.url),
    'utf8'
  )
);
const sources = JSON.parse(
  await readFile(new URL('../../scraper/course_sources.json', import.meta.url), 'utf8')
);
await db.exec('set request.jwt.claims = \'{"role":"service_role"}\'; set role service_role');
assert.deepEqual(
  (await db.query('select source from course_source_registry order by source')).rows.map(
    (r) => r.source
  ),
  ['um', 'unimap', 'usim']
);
for (const source of Object.keys(sources)) {
  const row = (await db.query('select * from course_source_registry where source=$1', [source]))
    .rows[0];
  assert.equal(row.name, sources[source].name);
  assert.deepEqual(row.destinations, sources[source].destinations);
}
const run = (await db.query("select begin_course_crawl_run('usim','manual') id")).rows[0].id;
assert.ok(run);
assert.ok((await db.query("select begin_course_crawl_run('unimap','manual') id")).rows[0].id);
const record = {
  name: 'Preparatory of Accounting and Muamalat',
  field_of_study: 'Accounting',
  university_name: sources.usim.name,
  university_state: sources.usim.state,
  pathway_type: 'foundation',
  duration_months: 12,
  entry_requirements: 'SPM minimum published requirements.',
  entry_requirement_sections: [
    {
      applicant_category: 'Local',
      route: 'SPM',
      heading: 'SPM',
      text: 'SPM minimum published requirements.',
    },
  ],
  programme_overview: null,
  career_prospects: [],
  required_subject_codes: [],
  source_content_hash: 'a'.repeat(64),
  source_academic_session: null,
  source_evidence: {},
};
async function ingest(
  over = {},
  key = 'foundation:pid:73',
  url = 'https://admission.usim.edu.my/academic-programmes/?pid=73'
) {
  return (
    await db.query('select ingest_course_source($1,$2,$3,$4,$5,$6,$7,$8) result', [
      'usim',
      key,
      url,
      { ...record, ...over },
      {},
      [],
      null,
      run,
    ])
  ).rows[0].result;
}
const first = await ingest();
assert.equal(first.outcome, 'inserted');
const again = await ingest();
assert.equal(again.outcome, 'unchanged');
assert.equal(again.course_id, first.course_id);
const changed = await ingest({ duration_months: 18, source_content_hash: 'b'.repeat(64) });
assert.equal(changed.outcome, 'updated');
assert.equal(changed.course_id, first.course_id);
const wrongUniversity = { university_name: 'Universiti Malaya' };
await assert.rejects(ingest(wrongUniversity));
await assert.rejects(ingest({}, 'foundation:bad', 'https://evil.org/academic-programmes/?pid=73'));
await assert.rejects(
  ingest({}, 'foundation:bad', 'https://admission.usim.edu.my/academic-programmes/?pid=73&pid=74')
);
assert.equal(
  (await ingest({ source_academic_session: '2024/2025', source_content_hash: 'c'.repeat(64) }))
    .outcome,
  'incomplete'
);
assert.equal(
  (
    await ingest({
      source_academic_session: '2026/2027',
      source_evidence: { sessions: ['2026/2027', '2025/2026'] },
      source_content_hash: 'e'.repeat(64),
    })
  ).outcome,
  'incomplete'
);
assert.equal(
  (await db.query('select duration_months from courses where id=$1', [first.course_id])).rows[0]
    .duration_months,
  18
);
const degree = await ingest(
  { name: record.name, pathway_type: 'degree', source_content_hash: 'd'.repeat(64) },
  'degree:pid:74',
  'https://admission.usim.edu.my/academic-programmes/?pid=74'
);
assert.equal(degree.outcome, 'inserted');
assert.notEqual(degree.course_id, first.course_id);
const withCode = await ingest({ source_content_hash: 'b'.repeat(64) }, 'foundation:UQ0340001');
assert.equal(withCode.course_id, first.course_id);
assert.equal(
  (
    await db.query(
      "select count(*)::integer n from course_source_records where source='usim' and canonical_url like '%pid=73'"
    )
  ).rows[0].n,
  1
);
await db.exec('reset role');
const admin = (
  await db.query(
    "insert into auth.users(email) values('three-source-admin@test.nexus') returning id"
  )
).rows[0].id;
await db.query("select grant_admin_by_email('three-source-admin@test.nexus')");
await db.query("select set_config('request.jwt.claims',$1,false)", [
  JSON.stringify({ role: 'authenticated', sub: admin }),
]);
await db.exec('set role authenticated');
assert.equal((await db.query('select source from course_source_registry')).rows.length, 3);
await assert.rejects(db.query("update course_source_registry set session='2024/2025'"));
await db.query("update courses set entry_requirements='Admin correction' where id=$1", [
  first.course_id,
]);
await db.exec('reset role');
await db.exec('set request.jwt.claims = \'{"role":"service_role"}\'; set role service_role');
assert.equal((await ingest()).outcome, 'protected_manual');
await db.exec('reset role');
await db.exec('set request.jwt.claims = \'{"role":"anon"}\'; set role anon');
await assert.rejects(db.query('select * from course_source_registry'));
await assert.rejects(db.query("select begin_course_crawl_run('um','manual')"));
console.log('Three-university ingestion, URL binding, session protection and stable IDs passed.');
await db.close();
