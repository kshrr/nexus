import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(await readFile(new URL('./auth-shim.sql', import.meta.url), 'utf8'));
for (const file of [
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
]) {
  await db.exec(await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'));
}
const legacy = (
  await db.query(
    `insert into scholarships(name,provider,source_url,source_hash) values ('Legacy award','Provider','https://provider.example/award','legacy-key') returning id`
  )
).rows[0].id;
await db.query(
  `insert into scholarships(name,provider,source_url,is_manual,status) values ('Manual','Provider','https://provider.example/manual',true,'active'),('Flagged','Provider','https://provider.example/flagged',false,'flagged')`
);
await db.exec(
  await readFile(new URL('../migrations/0014_scholarship_discovery.sql', import.meta.url), 'utf8')
);
const admin = (
  await db.query(`insert into auth.users(email) values ('discovery-admin@test.nexus') returning id`)
).rows[0].id;
const student = (
  await db.query(
    `insert into auth.users(email) values ('discovery-student@test.nexus') returning id`
  )
).rows[0].id;
await db.query(`select grant_admin_by_email('discovery-admin@test.nexus')`);
async function role(name, uid = '') {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims',$1,false)`, [
    uid ? JSON.stringify({ sub: uid, role: name }) : '',
  ]);
  await db.exec(`set role ${name}`);
}
assert.equal(
  (await db.query('select scholarship_id from scholarship_discoveries')).rows[0].scholarship_id,
  legacy
);
assert.equal((await db.query('select count(*)::int n from scholarship_discoveries')).rows[0].n, 1);
assert.equal((await db.query('select count(*)::int n from scholarships')).rows[0].n, 3);
await role('anon');
await assert.rejects(db.query('select * from scholarship_discoveries'));
await role('authenticated', student);
assert.equal((await db.query('select * from scholarship_discoveries')).rows.length, 0);
assert.equal((await db.query('select * from scholarship_discovery_settings')).rows.length, 0);
await role('authenticated', admin);
assert.equal((await db.query('select * from scholarship_discoveries')).rows.length, 1);
await assert.rejects(db.query(`update scholarship_discoveries set review_state='ignored'`));
await assert.rejects(
  db.query(`update scholarship_discovery_settings set queries=array['changed']`)
);
await role('postgres');
await assert.rejects(
  db.query(`update scholarship_discovery_settings set queries=array['1','2','3','4','5','6','7']`)
);
await assert.rejects(db.query(`update scholarship_discovery_settings set max_pages=101`));
await assert.rejects(db.query(`update scholarship_discovery_settings set max_pages_per_host=0`));
console.log('PASS staging RLS, direct-write boundaries, backfill and settings bounds');
await db.exec(
  await readFile(
    new URL('../migrations/0015_scholarship_discovery_operations.sql', import.meta.url),
    'utf8'
  )
);
const record = (over = {}) => ({
  name: 'Future award',
  provider: 'Foundation',
  description: 'A scholarship for Malaysian SPM school leavers.',
  education_levels: ['spm'],
  field_of_study: [],
  deadline: null,
  application_link: null,
  status: 'active',
  source_url: 'https://foundation.example/award',
  ...over,
});
const candidate = (key, over = {}) => ({
  identity_key: key,
  canonical_url: 'https://foundation.example/' + key,
  programme_key: key,
  record: record({ source_url: 'https://foundation.example/' + key }),
  criteria: [],
  evidence: { official_source: true },
  review_reasons: [],
  review_state: 'ready',
  ...over,
});
async function rpc(name, args) {
  return (
    await db.query(
      `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) value`,
      args
    )
  ).rows[0].value;
}
await role('service_role');
const staged = await rpc('scraper_stage_discovery', [candidate('future')]);
await role('authenticated', student);
await assert.rejects(rpc('publish_scholarship_discovery', [staged.id, 1]));
await assert.rejects(rpc('scraper_stage_discovery', [candidate('student')]));
await role('authenticated', admin);
await assert.rejects(rpc('scraper_stage_discovery', [candidate('admin-service')]));
const pub = await rpc('publish_scholarship_discovery', [staged.id, 1]);
assert.equal(await rpc('publish_scholarship_discovery', [staged.id, 1]), pub);
assert.equal(
  (await db.query('select is_manual from scholarships where id=$1', [pub])).rows[0].is_manual,
  false
);
assert.equal(
  (
    await db.query('select monitoring_enabled from scholarship_discoveries where id=$1', [
      staged.id,
    ])
  ).rows[0].monitoring_enabled,
  true
);
await assert.rejects(db.query('select * from scholarship_publication_guards'));
await db.query(`select set_config('nexus.publication','true',false)`);
await db.query(`update scholarships set description='Admin correction' where id=$1`, [pub]);
assert.equal(
  (await db.query('select is_manual from scholarships where id=$1', [pub])).rows[0].is_manual,
  true
);
await role('service_role');
assert.equal(
  await rpc('scraper_monitor_discovery', [
    staged.id,
    candidate('future', { record: record({ deadline: '2030-10-01' }) }),
  ]),
  'skipped_manual'
);
assert.equal((await rpc('scraper_stage_discovery', [candidate('future')])).id, staged.id);
await role('authenticated', admin);
await rpc('set_discovery_ignored', [staged.id, true]);
await role('service_role');
await rpc('scraper_stage_discovery', [candidate('future')]);
assert.equal(
  (await db.query('select review_state from scholarship_discoveries where id=$1', [staged.id]))
    .rows[0].review_state,
  'ignored'
);
const incomplete = await rpc('scraper_stage_discovery', [
  candidate('incomplete', { record: record({ education_levels: [] }) }),
]);
await role('authenticated', admin);
await assert.rejects(rpc('publish_scholarship_discovery', [incomplete.id, 1]), /NOT_READY/);
const corrected = await rpc('save_discovery_review', [
  incomplete.id,
  1,
  record({ source_url: 'https://foundation.example/incomplete', provider: 'Correct Foundation' }),
  [],
  true,
  null,
]);
await assert.rejects(
  rpc('save_discovery_review', [incomplete.id, 1, record(), [], true, null]),
  /STALE_REVIEW/
);
const correctedPub = await rpc('publish_scholarship_discovery', [
  incomplete.id,
  corrected.revision,
]);
await role('service_role');
await rpc('scraper_monitor_discovery', [
  incomplete.id,
  candidate('incomplete', {
    record: record({ source_url: 'https://foundation.example/incomplete', deadline: '2030-11-01' }),
  }),
]);
assert.equal(
  (await db.query('select provider,deadline from scholarships where id=$1', [correctedPub])).rows[0]
    .provider,
  'Correct Foundation'
);
assert.equal(
  (await db.query('select deadline::text deadline from scholarships where id=$1', [correctedPub]))
    .rows[0].deadline,
  '2030-11-01'
);
assert.equal(
  await rpc('scraper_monitor_discovery', [
    incomplete.id,
    candidate('incomplete', {
      record: record({
        source_url: 'https://foundation.example/incomplete',
        application_link: 'https://new.example/apply',
      }),
    }),
  ]),
  'needs_review'
);
assert.equal(
  (await db.query('select application_link from scholarships where id=$1', [correctedPub])).rows[0]
    .application_link,
  null
);
const expired = await rpc('scraper_stage_discovery', [
  candidate('closed', {
    record: record({
      source_url: 'https://foundation.example/closed',
      status: 'expired',
      deadline: '2020-01-01',
    }),
  }),
]);
const rollbackCandidate = await rpc('scraper_stage_discovery', [
  candidate('invalid-criteria', {
    criteria: [{ criterion_type: 'invented', operator: 'eq', value: 1, label: 'Invalid' }],
  }),
]);
await role('authenticated', admin);
await assert.rejects(rpc('publish_scholarship_discovery', [rollbackCandidate.id, 1]), /NOT_READY/);
assert.equal(
  (
    await db.query('select count(*)::int n from scholarships where source_hash=$1', [
      'invalid-criteria',
    ])
  ).rows[0].n,
  0
);
const expiredPub = await rpc('publish_scholarship_discovery', [expired.id, 1]);
assert.equal(
  (await db.query('select status from scholarships where id=$1', [expiredPub])).rows[0].status,
  'expired'
);
await assert.rejects(
  rpc('link_discovery_alias', [incomplete.id, expired.id]),
  /conflicting publications/
);
await db.query(
  `insert into scholarship_criteria(scholarship_id,criterion_type,operator,value,label) values($1,'other','eq','true','Manual criterion')`,
  [correctedPub]
);
assert.equal(
  (await db.query('select is_manual from scholarships where id=$1', [correctedPub])).rows[0]
    .is_manual,
  true
);
await role('service_role');
const archived = await rpc('scraper_stage_discovery', [candidate('archived')]);
await role('authenticated', admin);
const archivedPub = await rpc('publish_scholarship_discovery', [archived.id, 1]);
await db.query(`update scholarships set status='archived' where id=$1`, [archivedPub]);
await role('service_role');
assert.equal(
  await rpc('scraper_monitor_discovery', [archived.id, candidate('archived')]),
  'skipped_manual'
);
await role('postgres');
assert.equal(
  (await db.query('select count(*)::int n from scholarship_publication_guards')).rows[0].n,
  0
);
await role('service_role');
for (let i = 0; i < 25; i++)
  await rpc('scraper_stage_discovery', [
    candidate('catalogue-' + i, {
      record: record({
        name: 'Catalogue ' + i,
        provider: 'Literal (MY), Inc.',
        source_url: 'https://foundation.example/catalogue-' + i,
      }),
    }),
  ]);
await role('authenticated', admin);
const page = await rpc('list_scholarship_discoveries', [
  'discover',
  '(MY), Inc.',
  '',
  'all',
  2,
  20,
]);
assert.equal(page.total, 25);
assert.equal(page.items.length, 5);
await assert.rejects(
  rpc('save_scholarship_discovery_settings', [{ queries: ['1', '2', '3', '4', '5', '6', '7'] }]),
  /INVALID_SETTINGS/
);
await role('service_role');
const alias = await rpc('scraper_stage_discovery', [candidate('alias')]);
await role('authenticated', admin);
await rpc('link_discovery_alias', [incomplete.id, alias.id]);
await role('service_role');
assert.equal((await rpc('scraper_stage_discovery', [candidate('alias')])).id, incomplete.id);
await role('authenticated', student);
await assert.rejects(rpc('list_scholarship_discoveries', ['discover', '', '', 'all', 1, 20]));
await assert.rejects(rpc('save_scholarship_discovery_settings', [{ queries: ['query'] }]));
console.log(
  'PASS atomic/idempotent publication, review revisions, overrides, expiry, manual criteria, aliases, paging and RPC roles'
);
await role('service_role');
const requestId = '11111111-1111-4111-8111-111111111111';
const run = await rpc('begin_discovery_crawl_run', ['manual', admin, 'discovery', requestId]);
assert.ok(run);
assert.equal(await rpc('begin_discovery_crawl_run', ['schedule', null, 'combined', null]), null);
await rpc('finish_discovery_crawl_run', [
  run,
  {
    status: 'partial',
    leads_found: 30,
    candidates_created: 25,
    failed: 1,
    errors: ['Search rate limit'],
  },
]);
const log = (await db.query('select * from crawl_logs where id=$1', [run])).rows[0];
assert.equal(log.mode, 'discovery');
assert.equal(log.request_id, requestId);
assert.equal(log.candidates_created, 25);
assert.equal(log.status, 'partial');
await role('authenticated', admin);
await assert.rejects(rpc('begin_discovery_crawl_run', ['manual', admin, 'discovery', requestId]));
console.log('PASS discovery lifecycle counters, correlation and concurrent-run lock');
await role('postgres');
await db.query(
  `update scholarship_discoveries set last_checked_at='2020-01-01' where monitoring_enabled`
);
await role('service_role');
const cutoff = '2026-10-07T00:00:00Z';
const firstSelected = await rpc('scraper_selected_discoveries', [
  '1970-01-01',
  '00000000-0000-0000-0000-000000000000',
  cutoff,
  1,
]);
assert.equal(firstSelected.length, 1);
await rpc('scraper_record_discovery_error', [firstSelected[0].id, 'test check']);
const secondSelected = await rpc('scraper_selected_discoveries', [
  firstSelected[0].last_checked_at,
  firstSelected[0].id,
  cutoff,
  100,
]);
assert.ok(secondSelected.length > 0);
assert.ok(secondSelected.every((item) => item.id !== firstSelected[0].id));
console.log('PASS oldest-first keyset monitoring remains stable after check-time updates');
// Review regressions: approved generic destinations and pending drafts.
await role('service_role');
const pendingFixture = await rpc('scraper_stage_discovery', [candidate('pending-review')]);
await role('authenticated', admin);
const pendingPub = await rpc('publish_scholarship_discovery', [pendingFixture.id, 1]);
let pendingRow = (
  await db.query('select * from scholarship_discoveries where id=$1', [pendingFixture.id])
).rows[0];
await rpc('save_discovery_review', [
  pendingFixture.id,
  pendingRow.revision,
  { ...pendingRow.extracted_record, description: 'Draft correction not yet approved.' },
  [],
  true,
  null,
]);
await role('service_role');
await rpc('scraper_monitor_discovery', [pendingFixture.id, candidate('pending-review')]);
assert.equal(
  (await db.query('select description from scholarships where id=$1', [pendingPub])).rows[0]
    .description,
  record().description
);
const genericRecord = record({
  source_url: 'https://foundation.example/generic',
  application_link: 'https://apply.example/form',
});
const genericPayload = candidate('generic-approved', {
  record: genericRecord,
  evidence: { official_source: true },
  review_state: 'needs_review',
  review_reasons: ['Confirm application destination'],
});
const generic = await rpc('scraper_stage_discovery', [genericPayload]);
await role('authenticated', admin);
let genericDraft = await rpc('save_discovery_review', [
  generic.id,
  1,
  genericRecord,
  [],
  true,
  'https://apply.example/form',
]);
const genericPub = await rpc('publish_scholarship_discovery', [generic.id, genericDraft.revision]);
await role('service_role');
const linkedRefresh = { ...genericPayload, record: { ...genericRecord, deadline: '2031-04-30' } };
assert.equal(await rpc('scraper_monitor_discovery', [generic.id, linkedRefresh]), 'updated');
assert.equal(
  (await db.query('select deadline::text deadline from scholarships where id=$1', [genericPub]))
    .rows[0].deadline,
  '2031-04-30'
);
assert.equal(
  await rpc('scraper_monitor_discovery', [
    generic.id,
    {
      ...linkedRefresh,
      record: { ...linkedRefresh.record, application_link: 'https://changed.example/form' },
    },
  ]),
  'needs_review'
);
await role('authenticated', admin);
genericDraft = (await db.query('select * from scholarship_discoveries where id=$1', [generic.id]))
  .rows[0];
const pendingRecord = {
  ...linkedRefresh.record,
  description: 'A corrected description awaiting explicit approval.',
};
genericDraft = await rpc('save_discovery_review', [
  generic.id,
  genericDraft.revision,
  pendingRecord,
  [],
  true,
  'https://apply.example/form',
]);
await role('service_role');
await rpc('scraper_monitor_discovery', [generic.id, linkedRefresh]);
assert.equal(
  (await db.query('select description from scholarships where id=$1', [genericPub])).rows[0]
    .description,
  genericRecord.description
);
await role('authenticated', admin);
genericDraft = (await db.query('select * from scholarship_discoveries where id=$1', [generic.id]))
  .rows[0];
await rpc('approve_scholarship_discovery_changes', [generic.id, genericDraft.revision]);
assert.equal(
  (await db.query('select description,is_manual from scholarships where id=$1', [genericPub]))
    .rows[0].description,
  pendingRecord.description
);
assert.equal(
  (await db.query('select is_manual from scholarships where id=$1', [genericPub])).rows[0]
    .is_manual,
  false
);
console.log('PASS confirmed destinations refresh; saved drafts require explicit approval');
await role('service_role');
const moved = {
  ...linkedRefresh,
  record: { ...linkedRefresh.record, source_url: 'https://foundation.example/moved-generic' },
  evidence: {
    official_source: true,
    source_url: 'https://foundation.example/moved-generic',
    observed_identity_key: 'observed-moved-generic',
  },
  review_state: 'needs_review',
  review_reasons: ['Source or programme identity changed; review and approve the observed source'],
};
assert.equal(await rpc('scraper_monitor_discovery', [generic.id, moved]), 'needs_review');
assert.equal(
  (await db.query('select source_url from scholarships where id=$1', [genericPub])).rows[0]
    .source_url,
  genericRecord.source_url
);
await role('authenticated', admin);
genericDraft = (await db.query('select * from scholarship_discoveries where id=$1', [generic.id]))
  .rows[0];
genericDraft = await rpc('save_discovery_review', [
  generic.id,
  genericDraft.revision,
  { ...genericDraft.extracted_record, ...genericDraft.review_overrides },
  [],
  true,
  'https://apply.example/form',
]);
await rpc('approve_scholarship_discovery_changes', [generic.id, genericDraft.revision]);
await role('service_role');
const resolvedMoved = {
  ...moved,
  identity_key: 'observed-moved-generic',
  record: { ...moved.record, deadline: '2033-01-10' },
  review_reasons: ['Confirm application destination'],
  review_state: 'needs_review',
};
assert.equal(await rpc('scraper_monitor_discovery', [generic.id, resolvedMoved]), 'updated');
assert.equal(
  (await db.query('select source_url from scholarships where id=$1', [genericPub])).rows[0]
    .source_url,
  moved.record.source_url
);
await role('authenticated', student);
await assert.rejects(rpc('approve_scholarship_discovery_changes', [generic.id, 1]));
await role('postgres');
assert.equal(
  (await db.query('select count(*)::int n from scholarship_publication_guards')).rows[0].n,
  0
);
console.log('PASS moved sources require approval and alias enrollment; publication guards clear');
await role('postgres');
const nullablePub = (
  await db.query(
    `insert into scholarships(name,provider,source_url) values('Nullable legacy award','Foundation','https://foundation.example/nullable') returning id`
  )
).rows[0].id;
const nullable = (
  await db.query(
    `insert into scholarship_discoveries(identity_key,canonical_url,programme_key,scholarship_id,monitoring_enabled,approved_source_url,review_state) values('nullable-legacy','https://foundation.example/nullable','Nullable legacy award',$1,true,'https://foundation.example/nullable','ready') returning id`,
    [nullablePub]
  )
).rows[0].id;
await role('service_role');
assert.equal(
  await rpc('scraper_monitor_discovery', [
    nullable,
    candidate('nullable-legacy', {
      canonical_url: 'https://foundation.example/nullable',
      record: record({
        name: 'Nullable legacy award',
        source_url: 'https://foundation.example/nullable',
      }),
    }),
  ]),
  'updated'
);
assert.equal(
  (
    await db.query('select count(*)::int n from scholarships where source_url=$1', [
      'https://foundation.example/nullable',
    ])
  ).rows[0].n,
  1
);
assert.equal(
  (await db.query('select source_hash from scholarships where id=$1', [nullablePub])).rows[0]
    .source_hash,
  'nullable-legacy'
);
console.log('PASS selected legacy rows without hashes refresh without duplicate publication');
await db.close();
