// scholarship_source_documents(): official requirement PDFs for published
// scholarships, served to students without exposing admin-only staging.
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
]) {
  await db.exec(await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'));
}

const admin = (
  await db.query(`insert into auth.users(email) values ('docs-admin@test.nexus') returning id`)
).rows[0].id;
await db.query(`select grant_admin_by_email('docs-admin@test.nexus')`);

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

const SOURCE = 'https://www.bnm.gov.my/careers/scholarships';
const LIST = 'https://www.bnm.gov.my/documents/20124/1514833/Approved_Universities_for_Academic_Year_2026.pdf';
const candidate = (key, documents) => ({
  identity_key: key,
  canonical_url: SOURCE,
  programme_key: key,
  record: {
    name: `Kijang award ${key}`,
    provider: 'Bank Negara Malaysia (BNM)',
    description: 'A scholarship for outstanding Malaysian students.',
    education_levels: ['stpm'],
    field_of_study: [],
    deadline: null,
    application_link: null,
    status: 'active',
    source_url: SOURCE,
    source_documents: documents,
  },
  criteria: [],
  evidence: { official_source: true },
  review_reasons: [],
  review_state: 'ready',
});

await role('service_role');
const staged = await rpc('scraper_stage_discovery', [
  candidate('docs', [
    { label: 'Approved universities (PDF)', url: LIST },
    { label: 'Duplicate', url: LIST },
    { label: 'Other site', url: 'https://evil.example/list.pdf' },
    { label: 'Plain http', url: 'http://www.bnm.gov.my/documents/list.pdf' },
    { label: 'Not a PDF', url: 'https://www.bnm.gov.my/documents/list.html' },
    { label: '', url: 'https://www.bnm.gov.my/documents/blank.pdf' },
    'not-an-object',
  ]),
]);
const unpublished = await rpc('scraper_stage_discovery', [
  candidate('draft', [{ label: 'Draft list (PDF)', url: LIST }]),
]);

await role('authenticated', admin);
const pub = await rpc('publish_scholarship_discovery', [staged.id, 1]);

await role('anon');
assert.deepEqual(await rpc('scholarship_source_documents', [pub]), [
  { label: 'Approved universities (PDF)', url: LIST },
]);
console.log('PASS only same-host https PDFs with labels are served, de-duplicated');

assert.deepEqual(
  await rpc('scholarship_source_documents', ['00000000-0000-0000-0000-000000000000']),
  []
);
await assert.rejects(db.query('select * from scholarship_discoveries'));
console.log('PASS anon reads documents through the function only, never the staging table');

await role('authenticated', admin);
const draftScholarship = (
  await db.query('select scholarship_id from scholarship_discoveries where id=$1', [unpublished.id])
).rows[0].scholarship_id;
assert.equal(draftScholarship, null);

await db.exec('reset role');
await db.query(`update scholarships set status='flagged' where id=$1`, [pub]);
await role('anon');
assert.deepEqual(await rpc('scholarship_source_documents', [pub]), []);
await db.exec('reset role');
await db.query(`update scholarships set status='expired' where id=$1`, [pub]);
await role('anon');
assert.equal((await rpc('scholarship_source_documents', [pub])).length, 1);
console.log('PASS flagged publications hide documents; expired ones keep them');

await db.exec('reset role');
await db.query(`update scholarship_discoveries set review_state='ignored' where id=$1`, [staged.id]);
await role('anon');
assert.deepEqual(await rpc('scholarship_source_documents', [pub]), []);
console.log('PASS an ignored discovery serves no documents');
await db.close();
