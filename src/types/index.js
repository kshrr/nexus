/**
 * Shared type definitions (JSDoc) and enumerations.
 *
 * The project is JavaScript, matching the folder structure in architecture.md §2
 * (`.jsx` / `.js`). Types are expressed as JSDoc typedefs so editors still give
 * completion and checking without a TypeScript build step.
 *
 * Enumerations are the canonical values from architecture.md §3.9.
 */

// --- Enumerations (architecture.md §3.9) -------------------------------------

/** @typedef {'student' | 'admin'} Role */
export const ROLES = /** @type {const} */ (['student', 'admin']);

/** @typedef {'spm' | 'stpm' | 'stam' | 'matriculation' | 'foundation' | 'diploma'} EducationLevel */
export const EDUCATION_LEVELS = /** @type {const} */ ([
  'spm',
  'stpm',
  'stam',
  'matriculation',
  'foundation',
  'diploma',
]);

/** Human labels for the profile wizard radio cards (ui-spec §3.4 step 2). */
export const EDUCATION_LEVEL_LABELS = Object.freeze({
  spm: 'SPM',
  stpm: 'STPM',
  stam: 'STAM',
  matriculation: 'Matriculation',
  foundation: 'Foundation',
  diploma: 'Diploma',
});

/** @typedef {'form4_final' | 'spm_trial' | 'spm_actual'} ExamType */
export const EXAM_TYPES = /** @type {const} */ (['form4_final', 'spm_trial', 'spm_actual']);

export const EXAM_TYPE_LABELS = Object.freeze({
  form4_final: 'Form 4 Final',
  spm_trial: 'SPM Trial',
  spm_actual: 'SPM Actual',
});

/** @typedef {'A+' | 'A' | 'A-' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'E' | 'G'} Grade */
export const GRADES = /** @type {const} */ (['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G']);

/**
 * Grade -> points, architecture.md §8.2 (D-06).
 *
 * The authoritative definition is the SQL function `grade_to_points()`; this
 * copy exists only so the trend chart can plot a numeric y-axis without a round
 * trip per point. `supabase/tests/findyourpath.test.mjs` asserts the two agree,
 * so they cannot drift.
 */
export const GRADE_POINTS = Object.freeze({
  'A+': 9,
  A: 8,
  'A-': 7,
  'B+': 6,
  B: 5,
  'C+': 4,
  C: 3,
  D: 2,
  E: 1,
  G: 0,
});

/** @typedef {'strong' | 'average' | 'weak'} SubjectStrength */
/** @typedef {'R' | 'I' | 'A' | 'S' | 'E' | 'C'} RiasecLetter */
export const RIASEC_LETTERS = /** @type {const} */ (['R', 'I', 'A', 'S', 'E', 'C']);

export const RIASEC_DIMENSIONS = Object.freeze({
  R: 'Realistic',
  I: 'Investigative',
  A: 'Artistic',
  S: 'Social',
  E: 'Enterprising',
  C: 'Conventional',
});

// --- Domain entities (subset — architecture.md §3) --------------------------

/**
 * @typedef {Object} Profile
 * @property {string} id
 * @property {string} full_name
 * @property {string} email
 * @property {Role} role
 * @property {EducationLevel | null} education_level
 * @property {string | null} career_goal
 * @property {string | null} target_industry
 * @property {boolean} profile_completed
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string | undefined} email
 */

/**
 * @typedef {Object} AuthState
 * @property {import('@supabase/supabase-js').Session | null} session
 * @property {AuthUser | null} user
 * @property {Profile | null} profile
 * @property {Role | null} role
 * @property {boolean} loading   true until the first session check resolves
 * @property {boolean} isAuthenticated
 */

export {};
