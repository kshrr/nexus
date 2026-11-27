// Supported-provider discoveries are auto-published by the crawler; web-search
// discoveries stay in the admin queue, can be filtered and ignored in bulk.
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
  '0014_scholarship_discovery.sql',
  '0015_scholarship_discovery_operations.sql',
  '0030_scholarship_source_documents.sql',
  '0031_auto_publish_supported_discoveries.sql',
]) {
  await db.exec(await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'));
}

const admin = (
  await db.query(`insert into auth.users(email) values ('auto-admin@test.nexus') returning id`)
).rows[0].id;
const student = (
  await db.query(`insert into auth.users(email) values ('auto-student@test.nexus') returning id`)
).rows[0].id;
await db.query(`select grant_admin_by_email('auto-admin@test.nexus')`);

async function role(name, uid = '') {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims',$1,false)`, [
    uid ? JSON.stringify({ sub: uid, role: name }) : '',
  ]);
  await db.exec(`set role ${name}`);
}
async function rpc(name, args) {
  return (
    await db.query(
      `select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) value`,
      args
    )
  ).rows[0].value;
}
const candidate = (key, { parser = 'mara', levels = ['spm'], deadline = null } = {}) => ({
  identity_key: key,
  canonical_url: `https://provider.example/${key}`,
  programme_key: key,
  record: {
    name: `Programme ${key}`,
    provider: parser ? 'Majlis Amanah Rakyat (MARA)' : 'Some Blog',
    description: 'A sponsorship programme for Malaysian school leavers.',
    education_levels: levels,
    field_of_study: [],
    deadline,
    application_link: null,
    status: 'active',
    source_url: `https://provider.example/${key}`,
  },
  criteria: [
    { criterion_type: 'citizenship', operator: 'eq', value: 'MY', label: 'Malaysian citizen', is_checkable: false },
  ],
  evidence: parser
    ? { official_source: true, trusted_application: true, parser }
    : { official_source: false },
  review_reasons: [],
  review_state: 'ready',
});

await role('service_role');
const ready = await rpc('scraper_stage_discovery', [candidate('ready')]);
const closed = await rpc('scraper_stage_discovery', [candidate('closed', { deadline: '2026-05-06' })]);
const noLevel = await rpc('scraper_stage_discovery', [candidate('no-level', { levels: [] })]);
const blog = await rpc('scraper_stage_discovery', [candidate('blog', { parser: null })]);
const blog2 = await rpc('scraper_stage_discovery', [candidate('blog2', { parser: null })]);

const published = await rpc('scraper_auto_publish_discovery', [ready.id]);
assert.equal(published.outcome, 'published');
assert.equal((await rpc('scraper_auto_publish_discovery', [closed.id])).outcome, 'published');
assert.equal((await rpc('scraper_auto_publish_discovery', [noLevel.id])).outcome, 'needs_review');
assert.equal((await rpc('scraper_auto_publish_discovery', [blog.id])).outcome, 'needs_review');
assert.equal(
  (await rpc('scraper_auto_publish_discovery', [ready.id])).outcome,
  'already_published'
);

await db.exec('reset role');
const row = (
  await db.query('select is_manual,status,source_hash from scholarships where id=$1', [
    published.scholarship_id,
  ])
).rows[0];
assert.deepEqual(row, { is_manual: false, status: 'active', source_hash: 'ready' });
assert.equal(
  (await db.query(`select status from scholarships where source_hash='closed'`)).rows[0].status,
  'expired'
);
assert.equal(
  (
    await db.query('select count(*)::int n from scholarship_criteria where scholarship_id=$1', [
      published.scholarship_id,
    ])
  ).rows[0].n,
  1
);
const disc = (
  await db.query('select monitoring_enabled,approved_by from scholarship_discoveries where id=$1', [
    ready.id,
  ])
).rows[0];
assert.deepEqual(disc, { monitoring_enabled: true, approved_by: null });
assert.equal(
  (await db.query(`select count(*)::int n from audit_log where action='discovery.auto_publish'`))
    .rows[0].n,
  2
);
console.log('PASS ready supported candidates publish as crawler-managed; others stay queued');

for (const [name, uid] of [
  ['anon', ''],
  ['authenticated', student],
  ['authenticated', admin],
]) {
  await role(name, uid);
  await assert.rejects(rpc('scraper_auto_publish_discovery', [blog.id]));
}
console.log('PASS only the crawler service role can auto-publish');

await role('authenticated', admin);
const all = await rpc('list_scholarship_discoveries', ['discover', '', '', 'all', 1, 20, 'all']);
assert.equal(all.total, 3);
assert.equal(all.supported_total, 1);
assert.equal(all.search_total, 2);
assert.equal(all.items[0].from_supported_provider, true); // supported first
const search = await rpc('list_scholarship_discoveries', ['discover', '', '', 'all', 1, 20, 'search']);
assert.deepEqual(search.items.map((i) => i.identity_key).sort(), ['blog', 'blog2']);
const legacy = await rpc('list_scholarship_discoveries', ['discover', '', '', 'all', 1, 20]);
assert.equal(legacy.total, 3);
await assert.rejects(rpc('list_scholarship_discoveries', ['discover', '', '', 'all', 1, 20, 'bogus']));
console.log('PASS source filter, supported-first order and the six-argument wrapper');

await role('authenticated', student);
await assert.rejects(rpc('ignore_unsupported_discoveries', []));
await role('authenticated', admin);
assert.equal(await rpc('ignore_unsupported_discoveries', []), 2);
await db.exec('reset role');
const states = Object.fromEntries(
  (await db.query('select identity_key,review_state from scholarship_discoveries')).rows.map((r) => [
    r.identity_key,
    r.review_state,
  ])
);
assert.equal(states.blog, 'ignored');
assert.equal(states.blog2, 'ignored');
assert.equal(states['no-level'], 'needs_review'); // supported: never bulk-ignored
await role('service_role');
await rpc('scraper_stage_discovery', [candidate('blog', { parser: null })]);
await db.exec('reset role');
assert.equal(
  (await db.query(`select review_state from scholarship_discoveries where identity_key='blog'`))
    .rows[0].review_state,
  'ignored'
);
console.log('PASS bulk ignore covers only web-search candidates and survives rediscovery');

await role('service_role');
const run = await rpc('begin_discovery_crawl_run', ['schedule', null, 'combined', null]);
await rpc('finish_discovery_crawl_run', [run, { status: 'success', auto_published: 2, errors: [] }]);
await db.exec('reset role');
assert.equal(
  (await db.query('select records_inserted from crawl_logs where id=$1', [run])).rows[0]
    .records_inserted,
  2
);
console.log('PASS the run log counts auto-published programmes');
void blog2;
await db.close();
