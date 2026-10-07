import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', 'migrations');
const files = [
  '0002_core_tables.sql', '0003_reference_tables.sql', '0004_security_tables.sql',
  '0005_functions.sql', '0006_rls_policies.sql', '0007_seed_reference_data.sql',
  '0008_auth_consent.sql', '0009_seed_find_your_path.sql',
  '0010_scholarship_operations.sql', '0013_career_pathways.sql',
];

const db = new PGlite();
await db.exec(await readFile(join(HERE, 'auth-shim.sql'), 'utf8'));
for (const file of files) await db.exec(await readFile(join(MIGRATIONS, file), 'utf8'));

const results = [];
async function check(name, sql, predicate) {
  try {
    const { rows } = await db.query(sql);
    results.push({ name, pass: predicate(rows), detail: JSON.stringify(rows) });
  } catch (error) {
    results.push({ name, pass: false, detail: error.message.split('\n')[0] });
  }
}

await check('curated career catalog is manageable and complete',
  `select name, slug from public.careers where is_active order by name`,
  (rows) => rows.length >= 12 && rows.length <= 20 &&
    rows.some((row) => row.name === 'Cybersecurity Analyst') &&
    rows.some((row) => row.name === 'Data Analyst') && rows.every((row) => row.slug));

await check('every active career has an adaptive five-stage roadmap for all six levels',
  `select c.id, count(s.id)::int stage_count
   from public.careers c left join public.career_pathway_stages s on s.career_id = c.id
   where c.is_active group by c.id`,
  (rows) => rows.length >= 12 && rows.every((row) => row.stage_count === 30));

await check('cybersecurity reuses existing computer science courses',
  `select p.field_of_study from public.career_courses cc
   join public.careers c on c.id = cc.career_id
   join public.courses p on p.id = cc.course_id
   where c.name = 'Cybersecurity Analyst'`,
  (rows) => rows.length >= 1 && rows.every((row) => row.field_of_study === 'Computer Science'));

await check('career guidance fields are populated',
  `select name from public.careers where is_active and
   (cardinality(responsibilities)=0 or cardinality(required_skills)=0 or
    cardinality(useful_subjects)=0 or cardinality(education_routes)=0)`,
  (rows) => rows.length === 0);

await db.query(`insert into public.careers
  (name, field, description, required_skills, responsibilities, useful_subjects, education_routes, riasec_profile)
  values ('Environmental Researcher', 'Science', 'Studies environmental questions.',
    '{Research}', '{Collect evidence}', '{BIOLOGY}', '{Science degree}', 'IRS')`);
await check('admin-created careers receive a slug and starter pathways automatically',
  `select c.slug, count(s.id)::int stage_count from public.careers c
   left join public.career_pathway_stages s on s.career_id = c.id
   where c.name = 'Environmental Researcher' group by c.slug`,
  (rows) => rows[0]?.slug === 'environmental-researcher' && rows[0]?.stage_count === 30);

await db.query(`insert into public.careers
  (name, field, description, required_skills, riasec_profile, is_active)
  values ('Archived Example', 'Science', 'Not published.', '{Research}', 'IRS', false)`);
await db.query(`select set_config('request.jwt.claims', '{"role":"anon"}', false)`);
await db.exec('set role anon');
await check('anonymous readers cannot see archived career records',
  `select id from public.careers where name = 'Archived Example'`,
  (rows) => rows.length === 0);
await db.exec('reset role');

await db.close();
const passed = results.filter((result) => result.pass).length;
for (const result of results) console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.name}${result.pass ? '' : `\n        ${result.detail}`}`);
console.log(`\n${passed}/${results.length} passed.`);
process.exit(passed === results.length ? 0 : 1);
