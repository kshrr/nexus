// =============================================================================
// schema.test.mjs — migration / relationship / constraint / index / function
// verification. Applies supabase/migrations/* into PGlite and asserts the shape
// of the result matches architecture.md §3.
//
//   node supabase/tests/schema.test.mjs
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
];

const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });
async function expectQuery(name, sql, predicate) {
  try {
    const res = await db.query(sql);
    const [ok, detail] = predicate(res.rows);
    check(name, ok, detail);
  } catch (err) {
    check(name, false, `error: ${err.message.split('\n')[0]}`);
  }
}

const db = await new PGlite();
await db.exec(await readFile(join(HERE, 'auth-shim.sql'), 'utf8'));
for (const f of FILES) {
  await db.exec(await readFile(join(MIGRATIONS, f), 'utf8'));
}

// --- tables present -------------------------------------------------------
const EXPECTED_TABLES = [
  'profiles', 'subjects', 'riasec_results', 'riasec_responses', 'academic_results',
  'subject_strengths', 'recommendations', 'saved_items', 'chat_messages',
  'universities', 'courses', 'careers', 'career_pathway_stages', 'career_courses',
  'scholarships', 'scholarship_criteria',
  'consent_records', 'crawl_logs', 'audit_log', 'rate_limit_events',
];
await expectQuery(
  'all 20 expected tables exist',
  `select tablename from pg_tables where schemaname = 'public'`,
  (rows) => {
    const have = new Set(rows.map((r) => r.tablename));
    const missing = EXPECTED_TABLES.filter((t) => !have.has(t));
    const extra = [...have].filter((t) => !EXPECTED_TABLES.includes(t));
    return [missing.length === 0, missing.length ? `missing: ${missing}` : `extra: ${extra}`];
  }
);

// --- RLS enabled everywhere ---------------------------------------------
await expectQuery(
  'RLS enabled on every public table',
  `select tablename from pg_tables where schemaname='public' and rowsecurity=false`,
  (rows) => [rows.length === 0, rows.map((r) => r.tablename).join(', ')]
);

// --- foreign keys ------------------------------------------------------
const EXPECTED_FKS = [
  ['profiles', 'auth.users'],
  ['riasec_results', 'profiles'],
  ['riasec_responses', 'profiles'],
  ['academic_results', 'profiles'],
  ['academic_results', 'subjects'],
  ['subject_strengths', 'profiles'],
  ['subject_strengths', 'subjects'],
  ['recommendations', 'profiles'],
  ['saved_items', 'profiles'],
  ['chat_messages', 'profiles'],
  ['courses', 'universities'],
  ['career_pathway_stages', 'careers'],
  ['career_courses', 'careers'],
  ['career_courses', 'courses'],
  ['scholarship_criteria', 'scholarships'],
  ['consent_records', 'profiles'],
  ['crawl_logs', 'profiles'],
  ['audit_log', 'profiles'],
];
await expectQuery(
  'expected foreign keys exist',
  `select
      c.conrelid::regclass::text as child,
      c.confrelid::regclass::text as parent
   from pg_constraint c
   where c.contype = 'f'`,
  (rows) => {
    const have = rows.map((r) => `${stripSchema(r.child)}->${stripSchema(r.parent)}`);
    const missing = EXPECTED_FKS.map(([a, b]) => `${a}->${stripSchema(b)}`).filter(
      (fk) => !have.includes(fk)
    );
    return [missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : `${have.length} FKs`];
  }
);
function stripSchema(s) {
  return s.replace(/^public\./, '').replace(/^auth\./, '');
}

// --- cascade behaviour ------------------------------------------------
await expectQuery(
  'audit_log.actor_user_id is ON DELETE SET NULL (trail survives deletion)',
  `select confdeltype from pg_constraint
   where conrelid = 'public.audit_log'::regclass and contype='f'`,
  (rows) => [rows.some((r) => r.confdeltype === 'n'), JSON.stringify(rows)]
);
await expectQuery(
  'riasec_results.user_id is ON DELETE CASCADE',
  `select confdeltype from pg_constraint
   where conrelid = 'public.riasec_results'::regclass and contype='f'`,
  (rows) => [rows.every((r) => r.confdeltype === 'c'), JSON.stringify(rows)]
);

// --- key constraints ------------------------------------------------
await expectQuery(
  'riasec_results score CHECKs (0-24) present',
  `select conname from pg_constraint
   where conrelid='public.riasec_results'::regclass and contype='c'`,
  (rows) => [rows.length >= 6, `${rows.length} check constraints`]
);
await expectQuery(
  'riasec_results PK is user_id (overwrite-on-retake)',
  `select a.attname from pg_index i
     join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
   where i.indrelid = 'public.riasec_results'::regclass and i.indisprimary`,
  (rows) => [rows.length === 1 && rows[0].attname === 'user_id', JSON.stringify(rows)]
);
await expectQuery(
  'scholarships.application_link CHECK enforces https',
  `select pg_get_constraintdef(oid) def from pg_constraint
   where conrelid='public.scholarships'::regclass and contype='c'`,
  (rows) => [rows.some((r) => /https/i.test(r.def)), JSON.stringify(rows.map((r) => r.def))]
);
await expectQuery(
  'holland_code CHECK enforces ^[RIASEC]{3}$',
  `select pg_get_constraintdef(oid) def from pg_constraint
   where conrelid='public.riasec_results'::regclass and contype='c'`,
  (rows) => [rows.some((r) => /RIASEC/.test(r.def)), 'pattern check present']
);
await expectQuery(
  'unique (user_id, exam_type, subject_code) on academic_results',
  `select conname, pg_get_constraintdef(oid) def from pg_constraint
   where conrelid='public.academic_results'::regclass and contype='u'`,
  (rows) => [
    rows.some((r) => /user_id.*exam_type.*subject_code/.test(r.def)),
    JSON.stringify(rows.map((r) => r.def)),
  ]
);

// --- indexes ---------------------------------------------------------
const EXPECTED_INDEXES = [
  'idx_profiles_role',
  'idx_academic_user',
  'idx_recommendations_user',
  'idx_chat_messages_user',
  'idx_courses_field',
  'idx_courses_required_subjects',
  'uq_scholarships_source_hash',
  'idx_scholarships_deadline',
  'idx_scholarships_status',
  'idx_scholarships_field',
  'idx_scholarships_levels',
  'idx_scholarship_criteria_scholarship',
  'idx_audit_log_actor',
  'idx_rate_limit_window',
];
await expectQuery(
  'expected indexes exist',
  `select indexname from pg_indexes where schemaname='public'`,
  (rows) => {
    const have = new Set(rows.map((r) => r.indexname));
    const missing = EXPECTED_INDEXES.filter((i) => !have.has(i));
    return [missing.length === 0, missing.length ? `missing: ${missing}` : `${have.size} indexes`];
  }
);
await expectQuery(
  'partial index idx_profiles_role targets admins only',
  `select pg_get_indexdef(indexrelid) def from pg_index
   where indexrelid = 'public.idx_profiles_role'::regclass`,
  (rows) => [/where \(role = 'admin'::text\)/i.test(rows[0]?.def ?? ''), rows[0]?.def ?? 'missing']
);

// --- functions -----------------------------------------------------
const EXPECTED_FUNCS = [
  'is_admin', 'assert_admin', 'grade_to_points', 'deadline_urgency',
  'compute_subject_strengths', 'handle_new_user', 'set_updated_at', 'grant_admin_by_email',
];
await expectQuery(
  'all SQL functions exist',
  `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`,
  (rows) => {
    const have = new Set(rows.map((r) => r.proname));
    const missing = EXPECTED_FUNCS.filter((f) => !have.has(f));
    return [missing.length === 0, missing.length ? `missing: ${missing}` : `${have.size} functions`];
  }
);
await expectQuery(
  'is_admin() is SECURITY DEFINER with pinned search_path',
  `select prosecdef, proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and proname='is_admin'`,
  (rows) => [
    rows[0]?.prosecdef === true && String(rows[0]?.proconfig).includes('search_path=public'),
    JSON.stringify(rows[0]),
  ]
);

// --- function behaviour (unit) -----------------------------------
await expectQuery(
  'grade_to_points: A+ = 9, C+ = 4, G = 0',
  `select public.grade_to_points('A+') a, public.grade_to_points('C+') c, public.grade_to_points('G') g`,
  (rows) => [
    Number(rows[0].a) === 9 && Number(rows[0].c) === 4 && Number(rows[0].g) === 0,
    JSON.stringify(rows[0]),
  ]
);
await expectQuery(
  'deadline_urgency bands: 7d critical, 8d warning, 30d warning, 31d normal, null none',
  `select
     public.deadline_urgency((current_date + 7)) d7,
     public.deadline_urgency((current_date + 8)) d8,
     public.deadline_urgency((current_date + 30)) d30,
     public.deadline_urgency((current_date + 31)) d31,
     public.deadline_urgency(null) dn`,
  (rows) => {
    const r = rows[0];
    const ok =
      r.d7 === 'critical' && r.d8 === 'warning' && r.d30 === 'warning' &&
      r.d31 === 'normal' && r.dn === 'none';
    return [ok, JSON.stringify(r)];
  }
);

// --- handle_new_user trigger -------------------------------------
await expectQuery(
  'on_auth_user_created trigger exists on auth.users',
  `select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal`,
  (rows) => [rows.some((r) => r.tgname === 'on_auth_user_created'), JSON.stringify(rows)]
);
await db.query(
  `insert into auth.users (email, raw_user_meta_data)
   values ('newbie@test.nexus', '{"full_name":"New Bie"}'::jsonb)`
);
await expectQuery(
  'inserting an auth user auto-creates a student profile (profile_completed=false)',
  `select full_name, role, profile_completed from public.profiles
   where email = 'newbie@test.nexus'`,
  (rows) => [
    rows.length === 1 && rows[0].role === 'student' &&
      rows[0].profile_completed === false && rows[0].full_name === 'New Bie',
    JSON.stringify(rows[0]),
  ]
);

// --- compute_subject_strengths classification -------------------
const uid = (
  await db.query(`select id from public.profiles where email='newbie@test.nexus'`)
).rows[0].id;
await db.query(
  `insert into public.academic_results (user_id, exam_type, subject_code, grade) values
     ($1,'form4_final','MATH','A'), ($1,'spm_trial','MATH','A-'), ($1,'spm_actual','MATH','A'),
     ($1,'form4_final','BIOLOGY','C'), ($1,'spm_actual','BIOLOGY','C+'),
     ($1,'spm_actual','SEJARAH','E')`,
  [uid]
);
await db.query(`select public.compute_subject_strengths($1)`, [uid]);
await expectQuery(
  'compute_subject_strengths classifies by average points (>=7 strong, 4-6.99 average, <4 weak)',
  `select subject_code, strength, average_points, exam_count
   from public.subject_strengths where user_id = '${uid}' order by subject_code`,
  (rows) => {
    const by = Object.fromEntries(rows.map((r) => [r.subject_code, r]));
    // MATH avg(8,7,8)=7.67 -> strong, 3 exams
    // BIOLOGY avg(3,4)=3.5 -> weak, 2 exams
    // SEJARAH avg(1)=1 -> weak, 1 exam
    const ok =
      by.MATH?.strength === 'strong' && by.MATH?.exam_count === 3 &&
      Number(by.MATH?.average_points) > 7.6 && Number(by.MATH?.average_points) < 7.7 &&
      by.BIOLOGY?.strength === 'weak' && by.BIOLOGY?.exam_count === 2 &&
      by.SEJARAH?.strength === 'weak' && by.SEJARAH?.exam_count === 1;
    return [ok, JSON.stringify(rows)];
  }
);

// --- seed data --------------------------------------------------
await expectQuery(
  'subjects seeded (>= 15 rows, includes MATH/BIOLOGY/CHEMISTRY)',
  `select code from public.subjects`,
  (rows) => {
    const codes = new Set(rows.map((r) => r.code));
    return [
      rows.length >= 15 && codes.has('MATH') && codes.has('BIOLOGY') && codes.has('CHEMISTRY'),
      `${rows.length} subjects`,
    ];
  }
);

// --- report ----------------------------------------------------
await db.close();
const passed = results.filter((r) => r.pass).length;
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `\n        └─ ${r.detail}`}`);
}
console.log(`\n${passed}/${results.length} passed.`);
process.exit(passed === results.length ? 0 : 1);
