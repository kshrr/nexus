import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
await db.exec(await readFile(new URL('./auth-shim.sql', import.meta.url), 'utf8'));
for (const file of (await readdir(new URL('../migrations/', import.meta.url)))
  .filter((f) => /^00(0[2-9]|1[0-5])_.*\.sql$/.test(f))
  .sort())
  await db.exec(await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'));
const admin = (
  await db.query("insert into auth.users(email) values('course-admin@test.nexus') returning id")
).rows[0].id;
const student = (
  await db.query("insert into auth.users(email) values('course-student@test.nexus') returning id")
).rows[0].id;
await db.query("select grant_admin_by_email('course-admin@test.nexus')");
await db.exec(
  await readFile(new URL('../migrations/0016_course_catalogue_sync.sql', import.meta.url), 'utf8')
);
async function role(name, uid = '') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ role: name, ...(uid ? { sub: uid } : {}) }),
  ]);
  await db.exec('set role ' + name);
}
const requirements = [
  { applicant_category: 'Local', route: 'STPM', heading: 'STPM', text: 'Minimum CGPA 3.00.' },
];
const candidate = (over = {}) => ({
  name: 'Bachelor of Computer Science (Information Systems)',
  field_of_study: 'Computer Science',
  university_name: 'Universiti Malaya',
  university_state: 'Kuala Lumpur',
  pathway_type: 'degree',
  duration_months: 42,
  entry_requirements: 'Local / STPM\nMinimum CGPA 3.00.',
  entry_requirement_sections: requirements,
  programme_overview: 'Study information systems.',
  career_prospects: ['Data Analyst'],
  required_subject_codes: [],
  source_content_hash: 'a'.repeat(64),
  ...over,
});
const key = 'bachelor-of-computer-science-information-system';
const url = 'https://study.um.edu.my/' + key;
async function begin(request = null) {
  return (
    await db.query('select begin_course_crawl_run($1,$2,$3,$4) id', [
      'um',
      'manual',
      admin,
      request,
    ])
  ).rows[0].id;
}
async function ingest(
  record = candidate(),
  issues = [],
  error = null,
  programmeKey = key,
  sourceUrl = url
) {
  return (
    await db.query('select ingest_course_source($1,$2,$3,$4,$5,$6,$7,$8) result', [
      'um',
      programmeKey,
      sourceUrl,
      record,
      { faculty_url: 'https://study.um.edu.my/faculty-of-computer-science' },
      issues,
      error,
      run,
    ])
  ).rows[0].result;
}
await role('anon');
await assert.rejects(db.query('select * from course_source_records'));
await assert.rejects(
  db.query('select begin_course_crawl_run($1,$2,$3,$4)', ['um', 'manual', null, null])
);
await role('authenticated', student);
assert.equal((await db.query('select * from course_source_records')).rows.length, 0);
await assert.rejects(db.query("select list_course_sources('all',1,20)"));
await assert.rejects(begin());
await role('service_role');
const run = await begin('11111111-1111-4111-8111-111111111111');
assert.ok(run);
assert.equal(await begin(), null);
const first = await ingest();
assert.equal(first.outcome, 'inserted');
assert.ok(first.course_id);
assert.equal((await ingest()).outcome, 'unchanged');
const alias = await ingest(
  candidate(),
  [],
  null,
  'bachelor-information-systems-alias',
  'https://study.um.edu.my/bachelor-information-systems-alias'
);
assert.equal(
  alias.outcome,
  'incomplete',
  'A second source identity must not take ownership of an existing automatic course'
);
const changed = await ingest(
  candidate({ duration_months: 48, source_content_hash: 'b'.repeat(64) })
);
assert.equal(changed.outcome, 'updated');
assert.equal(changed.course_id, first.course_id);
await ingest(
  candidate({ duration_months: 24, entry_requirements: '', entry_requirement_sections: [] }),
  ['missing_entry_requirements']
);
assert.equal(
  (await db.query('select duration_months from courses where id=$1', [first.course_id])).rows[0]
    .duration_months,
  48
);
await ingest({}, [], 'HTTP 500');
assert.equal(
  (await db.query('select duration_months from courses where id=$1', [first.course_id])).rows[0]
    .duration_months,
  48
);
await ingest(
  candidate({
    entry_requirement_sections: [
      {
        applicant_category: 'International',
        route: 'Diploma',
        heading: 'Diploma',
        text: 'International guidance',
      },
    ],
  }),
  ['empty_requirement_section']
);
assert.deepEqual(
  (await db.query('select entry_requirement_sections from courses where id=$1', [first.course_id]))
    .rows[0].entry_requirement_sections,
  requirements,
  'Incomplete applicant tabs must retain previously published requirements'
);
await assert.rejects(ingest(candidate(), [], null, key, 'https://example.org/' + key));
await assert.rejects(ingest(candidate(), [], null, 'mismatched-identity', url));
await assert.rejects(ingest(candidate({ university_name: 'Fake University' })));
await assert.rejects(ingest([]));
await assert.rejects(ingest(candidate(), { unexpected: true }));
const forgedLink = await ingest(candidate({ course_id: 'c0000000-0000-4000-8000-000000000002' }));
assert.equal(
  forgedLink.course_id,
  first.course_id,
  'Candidate fields cannot forge a linked course ID'
);
await db.query(
  "insert into courses(name,field_of_study,university_id,pathway_type,entry_requirements) select 'Bachelor of Ambiguous Science','Science',university_id,'degree','Manual guidance' from courses where id=$1",
  [first.course_id]
);
await db.query(
  "insert into courses(name,field_of_study,university_id,pathway_type,entry_requirements) select 'Bachelor of Ambiguous Science','Science',university_id,'degree','Manual guidance' from courses where id=$1",
  [first.course_id]
);
const ambiguous = await ingest(
  candidate({ name: 'Bachelor of Ambiguous Science' }),
  [],
  null,
  'bachelor-ambiguous-science',
  'https://study.um.edu.my/bachelor-ambiguous-science'
);
assert.equal(ambiguous.outcome, 'incomplete');
assert.equal(
  ambiguous.course_id,
  null,
  'Ambiguous name matches cannot create or take ownership of a course'
);
const capitalized = await ingest(
  candidate({ name: 'Bachelor of Laws', field_of_study: 'Law' }),
  [],
  null,
  'Bachelor-of-laws',
  'https://study.um.edu.my/Bachelor-of-laws'
);
assert.equal(capitalized.outcome, 'inserted', 'Official case-sensitive source paths are preserved');
const missing = await ingest(
  candidate({ entry_requirements: '', entry_requirement_sections: [] }),
  [],
  null,
  'bachelor-empty',
  'https://study.um.edu.my/bachelor-empty'
);
assert.equal(missing.outcome, 'incomplete');
const manual = await ingest(
  candidate({ name: 'Bachelor of Medicine and Surgery' }),
  [],
  null,
  'bachelor-of-medicine-and-surgery',
  'https://study.um.edu.my/bachelor-of-medicine-and-surgery'
);
assert.equal(manual.outcome, 'protected_manual');
assert.equal(manual.course_id, 'c0000000-0000-4000-8000-000000000002');
await role('authenticated', admin);
assert.ok((await db.query("select list_course_sources('all',1,20) data")).rows[0].data.total >= 3);
await assert.rejects(db.query("select list_course_sources('all',1,51)"));
await assert.rejects(db.query("select list_course_sources('all',0,20)"));
const pageOne = (await db.query("select list_course_sources('all',1,1) data")).rows[0].data;
const pageTwo = (await db.query("select list_course_sources('all',2,1) data")).rows[0].data;
assert.equal(pageOne.items.length, 1);
assert.equal(pageTwo.items.length, 1);
assert.notEqual(pageOne.items[0].id, pageTwo.items[0].id);
assert.equal(pageOne.total, pageTwo.total);
await db.query("update courses set entry_requirements='Admin verified correction' where id=$1", [
  first.course_id,
]);
assert.deepEqual(
  (await db.query('select entry_requirement_sections from courses where id=$1', [first.course_id]))
    .rows[0].entry_requirement_sections,
  [],
  'Flat manual requirements must invalidate old structured guidance so students see the correction'
);
assert.equal(
  (await db.query('select sync_mode from courses where id=$1', [first.course_id])).rows[0]
    .sync_mode,
  'manual'
);
await role('service_role');
assert.equal((await ingest()).outcome, 'protected_manual');
assert.equal(
  (await db.query('select entry_requirements from courses where id=$1', [first.course_id])).rows[0]
    .entry_requirements,
  'Admin verified correction'
);
await role('authenticated', student);
await assert.rejects(db.query("select set_course_sync_mode($1,'automatic')", [first.course_id]));
await role('authenticated', admin);
await db.query("select set_course_sync_mode($1,'automatic')", [first.course_id]);
assert.equal(
  (await db.query('select sync_mode from courses where id=$1', [first.course_id])).rows[0]
    .sync_mode,
  'automatic'
);
await role('service_role');
assert.equal((await ingest()).outcome, 'updated');
await role('authenticated', admin);
await db.query(
  "insert into career_courses(career_id,course_id) values('b0000000-0000-4000-8000-000000000005',$1)",
  [first.course_id]
);
await db.query("update courses set entry_requirements='Second manual correction' where id=$1", [
  first.course_id,
]);
await db.query("select set_course_sync_mode($1,'automatic')", [first.course_id]);
await role('service_role');
assert.equal(
  (await ingest()).outcome,
  'updated',
  'Resuming sync must restore source content even when the source hash has not changed'
);
await role('authenticated', admin);
assert.equal(
  (
    await db.query('select count(*)::int n from career_courses where course_id=$1', [
      first.course_id,
    ])
  ).rows[0].n,
  1
);
await role('service_role');
await db.query('select finish_course_crawl_run($1,$2)', [
  run,
  {
    status: 'completed',
    found: 3,
    fetched: 3,
    inserted: 1,
    updated: 2,
    unchanged: 1,
    protected_manual: 2,
    incomplete: 1,
    fetch_failed: 1,
    coverage_complete: true,
    errors: [],
  },
]);
assert.equal(await begin('11111111-1111-4111-8111-111111111111'), null);
await role('authenticated', student);
assert.equal((await db.query('select * from course_crawl_runs')).rows.length, 0);
await role('postgres');
await db.query(
  "update course_crawl_runs set status='running',started_at=now()-interval '40 minutes' where id=$1",
  [run]
);
await role('service_role');
assert.ok(await begin());
assert.equal(
  (await db.query('select status from course_crawl_runs where id=$1', [run])).rows[0].status,
  'failed'
);
console.log(
  'PASS automatic course publication, stable identities, manual protection, source validation, RLS and run lifecycle'
);
await db.close();
