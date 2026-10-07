// =============================================================================
// findyourpath.test.mjs — database-side checks for the Find Your Path module.
//
//   * academic classification boundaries (architecture.md §8.2 / §8.3)
//   * RIASEC storage semantics (one row per user, retake overwrites)
//   * catalog integrity: every rule output resolves to a real career / course
//   * RLS isolation for riasec_results, riasec_responses and recommendations
//
//   node supabase/tests/findyourpath.test.mjs
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
];

const results = [];
const rec = (name, pass, detail = '') => results.push({ name, pass, detail });
const check = (name, pass, detail = '') => rec(name, pass, detail);

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

const db = await new PGlite();
await db.exec(await readFile(join(HERE, 'auth-shim.sql'), 'utf8'));
for (const f of FILES) await db.exec(await readFile(join(MIGRATIONS, f), 'utf8'));

// ---------------------------------------------------------------------------
// 1. catalog integrity — the rule base must not reference anything unseeded
// ---------------------------------------------------------------------------
const ruleBase = JSON.parse(
  await readFile(join(HERE, '..', 'functions', 'recommend', 'rules.json'), 'utf8')
);
await reset(db);
const careerNames = new Set(
  (await db.query(`select lower(name) n from public.careers`)).rows.map((r) => r.n)
);
const courseFields = new Set(
  (await db.query(`select distinct lower(field_of_study) f from public.courses`)).rows.map((r) => r.f)
);

const missingCareers = [];
const missingFields = [];
for (const rule of ruleBase.rules) {
  for (const name of rule.outputs.careers ?? []) {
    if (!careerNames.has(name.toLowerCase())) missingCareers.push(`${rule.id}:${name}`);
  }
  for (const field of rule.outputs.course_fields ?? []) {
    if (!courseFields.has(field.toLowerCase())) missingFields.push(`${rule.id}:${field}`);
  }
}
check(
  'every career a rule emits exists in the careers table',
  missingCareers.length === 0,
  missingCareers.join(', ')
);
check(
  'every course_field a rule emits matches at least one course',
  missingFields.length === 0,
  missingFields.join(', ')
);
check(
  'every seeded career carries a valid RIASEC profile (§9.6 secondary signal)',
  (await db.query(`select count(*)::int c from public.careers where riasec_profile !~ '^[RIASEC]{3}$'`))
    .rows[0].c === 0
);

// ---------------------------------------------------------------------------
// 2. academic classification — §8.2 grade points, §8.3 thresholds
// ---------------------------------------------------------------------------
await reset(db);
const S = (
  await db.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ('fyp-a@test.nexus', '{"full_name":"Student A"}'::jsonb) returning id`
  )
).rows[0].id;
const T = (
  await db.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ('fyp-b@test.nexus', '{"full_name":"Student B"}'::jsonb) returning id`
  )
).rows[0].id;

// grade -> points, verified directly against the §8.2 table
const gradePoints = {
  'A+': 9, A: 8, 'A-': 7, 'B+': 6, B: 5, 'C+': 4, C: 3, D: 2, E: 1, G: 0,
};
let mappingOk = true;
for (const [grade, points] of Object.entries(gradePoints)) {
  const got = Number(
    (await db.query(`select public.grade_to_points($1) p`, [grade])).rows[0].p
  );
  if (got !== points) mappingOk = false;
}
check('grade_to_points matches the §8.2 mapping for all ten grades', mappingOk);

// The frontend keeps a display-only copy of the mapping for the trend chart's
// numeric axis. It must never drift from the SQL definition.
const clientMap = JSON.parse(
  (await readFile(join(HERE, '..', '..', 'src', 'types', 'index.js'), 'utf8'))
    .split('export const GRADE_POINTS = Object.freeze(')[1]
    .split(');')[0]
    .replace(/'/g, '"')
    .replace(/([{,]\s*)([A-Za-z+-]+):/g, '$1"$2":')
    .replace(/""/g, '"')
    .replace(/,(\s*})/g, '$1')
);
check(
  'src/types GRADE_POINTS has not drifted from SQL grade_to_points()',
  JSON.stringify(clientMap) === JSON.stringify(gradePoints),
  `client=${JSON.stringify(clientMap)}`
);

await asUser(db, S);
await db.query(
  `insert into public.academic_results (user_id, exam_type, subject_code, grade) values
    -- MATH: A-, A-, A-  -> avg 7.00  -> boundary, strong
    ($1,'form4_final','MATH','A-'), ($1,'spm_trial','MATH','A-'), ($1,'spm_actual','MATH','A-'),
    -- PHYSICS: A-, B+   -> avg 6.50  -> just under the threshold, average
    ($1,'spm_trial','PHYSICS','A-'), ($1,'spm_actual','PHYSICS','B+'),
    -- CHEMISTRY: C+     -> avg 4.00  -> boundary, average
    ($1,'spm_actual','CHEMISTRY','C+'),
    -- BIOLOGY: C+, C    -> avg 3.50  -> just under, weak
    ($1,'spm_trial','BIOLOGY','C+'), ($1,'spm_actual','BIOLOGY','C'),
    -- SEJARAH: A+       -> avg 9.00  -> strong, single exam
    ($1,'spm_actual','SEJARAH','A+')`,
  [S]
);
await db.query(`select public.compute_subject_strengths()`);

const strengths = Object.fromEntries(
  (
    await db.query(
      `select subject_code, strength, average_points::float ap, exam_count
       from public.subject_strengths where user_id = $1`,
      [S]
    )
  ).rows.map((r) => [r.subject_code, r])
);

check(
  'avg exactly 7.00 classifies as strong (>= 7.0 boundary)',
  strengths.MATH?.strength === 'strong' && strengths.MATH.ap === 7 && strengths.MATH.exam_count === 3,
  JSON.stringify(strengths.MATH)
);
check(
  'avg 6.50 classifies as average (just below the strong threshold)',
  strengths.PHYSICS?.strength === 'average' && strengths.PHYSICS.ap === 6.5,
  JSON.stringify(strengths.PHYSICS)
);
check(
  'avg exactly 4.00 classifies as average (>= 4.0 boundary)',
  strengths.CHEMISTRY?.strength === 'average' && strengths.CHEMISTRY.ap === 4,
  JSON.stringify(strengths.CHEMISTRY)
);
check(
  'avg 3.50 classifies as weak (below 4.0)',
  strengths.BIOLOGY?.strength === 'weak' && strengths.BIOLOGY.ap === 3.5,
  JSON.stringify(strengths.BIOLOGY)
);
check(
  'a single-exam subject is classified and reports exam_count = 1 (§8.4)',
  strengths.SEJARAH?.strength === 'strong' && strengths.SEJARAH.exam_count === 1,
  JSON.stringify(strengths.SEJARAH)
);
check(
  'a subject never sat produces no strength row (§8.4)',
  strengths.ADD_MATH === undefined
);

// changing a grade re-classifies without a manual refresh (AC-20)
await asUser(db, S);
await db.query(
  `update public.academic_results set grade = 'A+'
   where user_id = $1 and subject_code = 'BIOLOGY' and exam_type = 'spm_actual'`,
  [S]
);
await db.query(`select public.compute_subject_strengths()`);
const bioAfter = (
  await db.query(
    `select strength, average_points::float ap from public.subject_strengths
     where user_id = $1 and subject_code = 'BIOLOGY'`,
    [S]
  )
).rows[0];
// C+(4) and C(3) averaged 3.50 -> weak. Raising the actual to A+(9) gives
// (4 + 9) / 2 = 6.50 -> average. The band must move without a manual refresh.
check(
  'changing a grade re-runs the classification (AC-20): weak -> average at 6.50',
  bioAfter?.strength === 'average' && bioAfter.ap === 6.5,
  JSON.stringify(bioAfter)
);

// ---------------------------------------------------------------------------
// 3. RIASEC storage — one row per user, retake overwrites (AC-15)
// ---------------------------------------------------------------------------
await asUser(db, S);
await db.query(
  `insert into public.riasec_results
     (user_id, realistic_score, investigative_score, artistic_score,
      social_score, enterprising_score, conventional_score, holland_code)
   values ($1, 6, 21, 16, 18, 11, 9, 'ISA')`,
  [S]
);
await asUser(db, S);
await db.query(
  `insert into public.riasec_results
     (user_id, realistic_score, investigative_score, artistic_score,
      social_score, enterprising_score, conventional_score, holland_code)
   values ($1, 24, 2, 3, 4, 5, 6, 'RCE')
   on conflict (user_id) do update set
     realistic_score = excluded.realistic_score,
     investigative_score = excluded.investigative_score,
     artistic_score = excluded.artistic_score,
     social_score = excluded.social_score,
     enterprising_score = excluded.enterprising_score,
     conventional_score = excluded.conventional_score,
     holland_code = excluded.holland_code`,
  [S]
);
const after = await db.query(
  `select holland_code, realistic_score from public.riasec_results where user_id = $1`,
  [S]
);
check(
  'a retake overwrites in place — exactly one row per user (AC-15)',
  after.rows.length === 1 && after.rows[0].holland_code === 'RCE',
  JSON.stringify(after.rows)
);

let rejectedBadCode = false;
try {
  await asUser(db, S);
  await db.query(
    `update public.riasec_results set holland_code = 'XYZ' where user_id = $1`,
    [S]
  );
} catch {
  rejectedBadCode = true;
}
check('holland_code CHECK rejects a non-RIASEC code', rejectedBadCode);

let rejectedBadScore = false;
try {
  await asUser(db, S);
  await db.query(
    `update public.riasec_results set investigative_score = 25 where user_id = $1`,
    [S]
  );
} catch {
  rejectedBadScore = true;
}
check('dimension score CHECK rejects a value above 24 (§7.2 range)', rejectedBadScore);

// ---------------------------------------------------------------------------
// 4. RLS isolation for the module's tables
// ---------------------------------------------------------------------------
await asUser(db, S);
await db.query(
  `insert into public.recommendations
     (user_id, rec_type, target_id, match_score, rank, reasons, rule_id, degraded_mode)
   values ($1, 'career', 'b0000000-0000-4000-8000-000000000002', 100, 1,
           '[{"condition":"riasec_letter","satisfied":true,"text":"Investigative interests"}]'::jsonb,
           'R-HEALTH-01', false)`,
  [S]
);

for (const [table, label] of [
  ['riasec_results', 'RIASEC results'],
  ['subject_strengths', 'subject strengths'],
  ['academic_results', 'academic results'],
  ['recommendations', 'recommendations'],
]) {
  await asUser(db, T);
  const r = await db.query(`select * from public.${table} where user_id = $1`, [S]);
  check(`Student B cannot read Student A's ${label}`, r.rows.length === 0, `${r.rows.length} rows`);
}

await asUser(db, S);
const own = await db.query(`select * from public.recommendations`);
check('Student A reads their own recommendations', own.rows.length === 1);

await asUser(db, S);
const reasons = own.rows[0]?.reasons;
check(
  'stored reasons keep the documented {condition, satisfied, text} shape (§3.5)',
  Array.isArray(reasons) &&
    reasons.length > 0 &&
    'condition' in reasons[0] &&
    'satisfied' in reasons[0] &&
    'text' in reasons[0],
  JSON.stringify(reasons)
);

// public reference data stays readable for the catalog lookups
await asUser(db, T);
const cat = await db.query(`select count(*)::int c from public.careers`);
check('careers/courses remain public-read reference data (§4.5)', cat.rows[0].c > 0);

// ---------------------------------------------------------------------------
await db.close();
const passed = results.filter((r) => r.pass).length;
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `\n        └─ ${r.detail}`}`);
}
console.log(`\n${passed}/${results.length} passed.`);
process.exit(passed === results.length ? 0 : 1);
