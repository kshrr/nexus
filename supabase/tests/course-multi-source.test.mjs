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
for (const file of [
  '0020_three_university_course_sources.sql',
  '0021_more_university_course_sources.sql',
  '0024_mmu_course_source.sql',
  '0025_keep_published_course_on_fetch_failure.sql',
  '0026_utm_course_source.sql',
  '0028_taylors_course_source.sql',
  '0029_taylors_college_course_source.sql',
  '0032_inti_course_source.sql',
  '0033_umpsa_course_source.sql',
  '0034_sunway_college_course_source.sql',
]) {
  await db.exec(await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'));
}
const sources = JSON.parse(
  await readFile(new URL('../../scraper/course_sources.json', import.meta.url), 'utf8')
);
await db.exec('set request.jwt.claims = \'{"role":"service_role"}\'; set role service_role');
assert.deepEqual(
  (await db.query('select source from course_source_registry order by source')).rows.map(
    (r) => r.source
  ),
  [
    'inti',
    'mmu',
    'sunway_college',
    'taylors',
    'taylors_college',
    'um',
    'umpsa',
    'unimap',
    'unisza',
    'usim',
    'utem',
    'utm',
    'uum',
  ]
);
for (const source of Object.keys(sources)) {
  const row = (await db.query('select * from course_source_registry where source=$1', [source]))
    .rows[0];
  assert.equal(row.name, sources[source].name);
  assert.deepEqual(row.destinations, sources[source].destinations);
}
const validUrl = async (source, url) =>
  (await db.query('select is_valid_course_source_url($1,$2) ok', [source, url])).rows[0].ok;
const mmu = 'https://www.mmu.edu.my/programmes-by-faculty-all/programmes-by-faculty-fci/';
assert.equal(await validUrl('mmu', mmu + 'bachelor-of-computer-science-hons'), true);
assert.equal(await validUrl('mmu', 'https://www.mmu.edu.my/courses-sitemap.xml'), true);
assert.equal(await validUrl('mmu', mmu + 'master-of-computer-science'), false);
assert.equal(await validUrl('mmu', mmu + 'bachelor-of-computer-science-hons?x=1'), false);
assert.equal(await validUrl('mmu', 'https://www.mmu.edu.my.evil.org/courses-sitemap.xml'), false);
const run = (await db.query("select begin_course_crawl_run('usim','manual') id")).rows[0].id;
assert.ok(run);
assert.ok((await db.query("select begin_course_crawl_run('unimap','manual') id")).rows[0].id);
const record = {
  name: 'Preparatory of Accounting and Muamalat',
  field_of_study: 'Accounting',
  // USIM was registered by 0020 and is retired by 0022 (checked at the end).
  university_name: 'Universiti Sains Islam Malaysia',
  university_state: 'Negeri Sembilan',
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

// 0025: a published course whose page cannot be re-checked keeps its last good
// record (and stays out of the attention list); a never-published one does not.
const failedFetch = async (key, url) =>
  (
    await db.query('select ingest_course_source($1,$2,$3,$4,$5,$6,$7,$8) result', [
      'usim',
      key,
      url,
      {},
      {},
      [],
      'HTTPS request failed',
      run,
    ])
  ).rows[0].result;
const usimPage = 'https://admission.usim.edu.my/academic-programmes/?pid=';
const kept = await failedFetch('degree:pid:74', usimPage + '74');
assert.equal(kept.outcome, 'fetch_failed');
assert.equal(kept.course_id, degree.course_id);
const keptRecord = (
  await db.query(
    "select outcome, candidate->>'name' name, last_error, last_success_at from course_source_records where source='usim' and programme_key='degree:pid:74'"
  )
).rows[0];
assert.equal(keptRecord.outcome, 'unchanged');
assert.equal(keptRecord.name, record.name);
assert.equal(keptRecord.last_error, 'HTTPS request failed');
assert.ok(keptRecord.last_success_at);
const neverPublished = await failedFetch('degree:pid:75', usimPage + '75');
assert.equal(neverPublished.outcome, 'fetch_failed');
assert.equal(neverPublished.course_id, null);
assert.equal(
  (
    await db.query(
      "select outcome from course_source_records where source='usim' and programme_key='degree:pid:75'"
    )
  ).rows[0].outcome,
  'fetch_failed'
);
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
assert.equal((await db.query('select source from course_source_registry')).rows.length, 13);
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
await db.exec('reset role');

// 0022 retires UniMAP and USIM: registry matches scraper/course_sources.json again,
// their scraped courses are hidden (not deleted) and their sync history is removed.
await db.query("update course_crawl_runs set status='completed', finished_at=now()");
await db.exec(
  await readFile(
    new URL('../migrations/0022_retire_unimap_usim_course_sources.sql', import.meta.url),
    'utf8'
  )
);
// 0023 retires UUM (its site refuses connections from GitHub's US runners).
await db.exec(
  await readFile(
    new URL('../migrations/0023_retire_uum_course_source.sql', import.meta.url),
    'utf8'
  )
);
assert.deepEqual(
  (await db.query('select source from course_source_registry order by source')).rows.map(
    (r) => r.source
  ),
  Object.keys(sources).sort()
);
assert.deepEqual(
  (
    await db.query('select is_active from courses where id = any($1::uuid[])', [
      [first.course_id, degree.course_id],
    ])
  ).rows.map((r) => r.is_active),
  [false, false]
);
assert.equal(
  (
    await db.query(
      "select count(*)::integer n from course_source_records where source in ('unimap','usim')"
    )
  ).rows[0].n,
  0
);
assert.equal(
  (
    await db.query(
      "select count(*)::integer n from course_crawl_runs where source in ('unimap','usim')"
    )
  ).rows[0].n,
  0
);

// UTM's allow-list admits its book and bachelor pages only.
const utm = 'https://admission.utm.my/';
assert.equal(
  await validUrl('utm', utm + 'programmes/bachelor-of-civil-engineering-with-honours'),
  true
);
assert.equal(
  await validUrl(
    'utm',
    utm +
      'wp-content/uploads/sites/461/2026/08/28072026-BUKU-SYARAT-KEMASUKAN-UG-LOCAL-20262027.pdf'
  ),
  true
);
assert.equal(await validUrl('utm', utm + 'programmes/master-of-software-engineering'), false);
assert.equal(
  await validUrl('utm', utm + 'wp-content/uploads/sites/461/2020/09/Health-Assesment-Form-1.pdf'),
  false
);

// 0027 hides the 0009 demonstration courses, their career links and the universities
// left with nothing published; universities with a registered source stay visible.
const seedIds = Array.from(
  { length: 12 },
  (_, i) => `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
);
await db.exec(
  await readFile(new URL('../migrations/0027_hide_seed_courses.sql', import.meta.url), 'utf8')
);
assert.equal(
  (
    await db.query(
      'select count(*)::integer n from courses where id = any($1::uuid[]) and is_active',
      [seedIds]
    )
  ).rows[0].n,
  0
);
assert.equal(
  (
    await db.query(
      'select count(*)::integer n from career_courses where course_id = any($1::uuid[])',
      [seedIds]
    )
  ).rows[0].n,
  0
);
const visible = Object.fromEntries(
  (await db.query('select name, is_active from universities')).rows.map((r) => [
    r.name,
    r.is_active,
  ])
);
assert.equal(visible['Universiti Putra Malaysia'], false);
assert.equal(visible['Universiti Teknologi MARA'], false);
assert.equal(visible['Universiti Sains Malaysia'], false);
assert.equal(visible['Universiti Sains Islam Malaysia'], false);
assert.equal(visible['Universiti Malaya'], true);
assert.equal(visible['Universiti Teknologi Malaysia'], true);
console.log(
  'Multi-university ingestion, URL binding, session protection, stable IDs, source retirement and seed hiding passed.'
);
await db.close();
