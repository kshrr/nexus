/**
 * Scholarship eligibility matching — pure logic, no I/O, unit-testable.
 *
 * Transcribed from docs/architecture.md §10.5 and §10.6:
 *   §10.5  is_checkable = false -> status 'unknown'
 *          eligibility_score = satisfied / checkable_count × 100
 *          relevance_score   = field overlap with recommended course fields
 *          rank by (eligibility DESC, relevance DESC, deadline ASC)
 *   §10.6  satisfied ✓ / unsatisfied ✗ / unknown —
 *          an `unknown` criterion is NEVER rendered as a failure
 *
 * Nothing here decides *whether* a student may apply. It reports, per criterion,
 * what the stored profile can and cannot confirm.
 */

export type CriterionStatus = 'satisfied' | 'unsatisfied' | 'unknown';

export type CriterionType =
  | 'citizenship'
  | 'education_level'
  | 'field_of_study'
  | 'min_grade'
  | 'subject_grade'
  | 'age'
  | 'other';

export interface Criterion {
  id: string;
  criterion_type: CriterionType;
  operator: 'eq' | 'in' | 'gte' | 'lte' | 'contains';
  value: unknown; // jsonb
  label: string;
  is_checkable: boolean;
}

export interface ScholarshipRow {
  id: string;
  name: string;
  provider: string;
  deadline: string | null;
  status: string;
  field_of_study: string[];
  education_levels: string[];
}

/** Exactly what the matcher is allowed to see about the student. */
export interface StudentEligibilityProfile {
  educationLevel: string | null;
  careerGoal: string | null;
  targetIndustry: string | null;
  /** subject_code -> average grade points (architecture.md §8.2 scale, 0-9). */
  subjectPoints: Record<string, number>;
  /** Course fields from the student's current recommendations (§10.5). */
  recommendedFields: string[];
  /**
   * Self-declared, optional (migration 0036): 'malaysian' | 'non_malaysian' |
   * null when the student has not answered. Nothing else about the student's
   * identity is collected.
   */
  nationality?: string | null;
  /**
   * Self-declared, optional (migration 0039): year of birth and a monthly household income band.
   * Used only for age and income limits. null = not answered.
   */
  birthYear?: number | null;
  householdIncomeBand?: string | null;
  /** The year used to turn a birth year into an age. Defaults to the current year; settable for tests. */
  currentYear?: number;
}

export interface ChecklistItem {
  criterion_id: string;
  criterion_type: CriterionType;
  label: string;
  status: CriterionStatus;
  /** Shown under an unsatisfied or unknown line to say what to do (§10.6). */
  hint: string | null;
}

export interface ScholarshipMatch {
  scholarship_id: string;
  eligibility_score: number;
  relevance_score: number;
  checkable_count: number;
  satisfied_count: number;
  checklist: ChecklistItem[];
}

/**
 * Criterion types the profile has no collection point for.
 *
 * Date of birth and IC number are NOT collected (ui-specifications.md §9.1), so
 * `age` can never be verified and is reported as `unknown` — "we cannot check
 * this" — rather than guessed in either direction (§10.6). Nationality is now
 * an optional, self-declared profile answer (migration 0036): `citizenship` is
 * checked when the student has answered and is `unknown` otherwise.
 */
const NO_DATA_SOURCE: CriterionType[] = ['age']; // checked only when its label gives a limit (inferRule)
const ADD_NATIONALITY_HINT = 'Add your nationality in your profile to check this.';
/** `alt: true` — the provider also accepts another exam (STAM, UEC, O-Level …). */
const ALTERNATIVE_EXAM_HINT =
  'Another exam can also meet this. Add your SPM results to check it against them.';

const CANNOT_VERIFY_HINT = "Nexus can't check this. See the provider's page.";
const ADD_BIRTH_YEAR_HINT = 'Add your year of birth in your profile to check this.';
const ADD_INCOME_HINT = 'Add your household income range in your profile to check this.';
const ADD_RESULTS_HINT = 'Add your SPM results in your profile to check this.';

/**
 * Household income bands (migration 0039), as (low, high] in RM per month. A limit is clearly met when
 * the whole band sits at or under it, clearly missed when the whole band sits over it, and otherwise
 * the band straddles the limit and Nexus cannot tell.
 */
const INCOME_BANDS: Record<string, [number, number]> = {
  under_2500: [0, 2500],
  '2500_5000': [2500, 5000],
  '5000_7500': [5000, 7500],
  '7500_10000': [7500, 10000],
  '10000_15000': [10000, 15000],
  over_15000: [15000, Number.POSITIVE_INFINITY],
};

/** SPM credits are grades A+ to C (points 3 and up on the §8.2 scale). */
const CREDIT_POINTS = 3;

export type InferredRule =
  | { kind: 'age_max'; limit: number }
  | { kind: 'income_max'; limit: number }
  | { kind: 'spm_credits'; count: number }
  | { kind: 'citizen_my' };

const toNumber = (v: string): number => Number(v.replace(/,/g, ''));

/**
 * Many provider conditions arrive as plain text ("Aged 25 years or below.", "Total monthly gross
 * household income of RM5,000 and below", "Obtained minimum three (3) credits in SPM") and are stored
 * as `other`. These narrow patterns, in English and Malay, turn the common ones into a rule Nexus can
 * check. Anything that does not match stays "can't check".
 */
export function inferRule(label: string): InferredRule | null {
  const text = label.replace(/^(general|academic|eligibility)\s+condition:\s*/i, '').trim();

  if (/^(malaysian(\s+citizen(ship)?)?|warganegara\s+malaysia)\.?$/i.test(text)) {
    return { kind: 'citizen_my' };
  }

  const age =
    text.match(
      /\baged?\s+(\d{2})\s+(?:years?(?:\s+old)?\s+)?(?:and|or)\s+(?:below|under|younger)/i
    ) ??
    text.match(
      /\b(?:below|under|not\s+(?:more\s+than|exceeding)|less\s+than|maximum\s+age\s+of)\s+(\d{2})\s+years?/i
    ) ??
    text.match(
      /\b(?:berumur|umur)\s+(?:tidak\s+melebihi|bawah|kurang\s+daripada)\s+(\d{2})\s+tahun/i
    );
  if (age) return { kind: 'age_max', limit: Number(age[1]) };

  if (/household|family|isi\s+rumah|keluarga|parents?|ibu\s+bapa/i.test(text)) {
    const income =
      text.match(/income[^.]{0,80}?RM\s?([\d,]+)(?:\.\d+)?\s*(?:and|or)\s+(?:below|under|less)/i) ??
      text.match(/pendapatan[^.]{0,80}?tidak\s+melebihi\s+RM\s?([\d,]+)/i);
    if (income) return { kind: 'income_max', limit: toNumber(income[1]) };
  }

  if (/\bSPM\b|sijil\s+pelajaran\s+malaysia/i.test(text)) {
    const credits =
      text.match(/\b(?:minimum|at\s+least)\s+(?:[a-z-]+\s+)?\(?(\d+)\)?\s+credits?\b/i) ??
      text.match(/\bsekurang-kurangnya\s+(\d+)\s+kepujian/i);
    if (credits && Number(credits[1]) >= 1)
      return { kind: 'spm_credits', count: Number(credits[1]) };
  }

  return null;
}

function evaluateRule(
  rule: InferredRule,
  profile: StudentEligibilityProfile
): { status: CriterionStatus; hint: string | null } {
  switch (rule.kind) {
    case 'citizen_my': {
      if (!profile.nationality) return { status: 'unknown', hint: ADD_NATIONALITY_HINT };
      return profile.nationality === 'malaysian'
        ? { status: 'satisfied', hint: null }
        : { status: 'unsatisfied', hint: 'This scholarship is for Malaysian citizens.' };
    }

    case 'age_max': {
      if (!profile.birthYear) return { status: 'unknown', hint: ADD_BIRTH_YEAR_HINT };
      const year = profile.currentYear ?? new Date().getFullYear();
      // A year of birth leaves the age as one of two values, depending on the birthday.
      const oldest = year - profile.birthYear;
      const youngest = oldest - 1;
      if (oldest <= rule.limit) return { status: 'satisfied', hint: null };
      if (youngest > rule.limit) {
        return { status: 'unsatisfied', hint: `The age limit is ${rule.limit} years.` };
      }
      return {
        status: 'unknown',
        hint: 'Your year of birth is too close to the limit to tell. See the provider’s page.',
      };
    }

    case 'income_max': {
      if (!profile.householdIncomeBand) return { status: 'unknown', hint: ADD_INCOME_HINT };
      const band = INCOME_BANDS[profile.householdIncomeBand];
      if (!band) return { status: 'unknown', hint: ADD_INCOME_HINT };
      const [low, high] = band;
      if (high <= rule.limit) return { status: 'satisfied', hint: null };
      if (low >= rule.limit) {
        return {
          status: 'unsatisfied',
          hint: `The household income limit is RM${rule.limit.toLocaleString('en-MY')} a month.`,
        };
      }
      return {
        status: 'unknown',
        hint: 'Your income range spans the limit, so Nexus can’t tell. See the provider’s page.',
      };
    }

    case 'spm_credits': {
      const points = Object.values(profile.subjectPoints);
      if (points.length === 0) return { status: 'unknown', hint: ADD_RESULTS_HINT };
      const credits = points.filter((p) => p >= CREDIT_POINTS).length;
      return credits >= rule.count
        ? { status: 'satisfied', hint: null }
        : {
            status: 'unsatisfied',
            hint: `From the subjects you’ve added you have ${credits} of the ${rule.count} credits needed. Add any missing SPM results in your profile.`,
          };
    }
  }
}

const asString = (v: unknown): string => (typeof v === 'string' ? v : '');
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [v]);
const lower = (v: unknown) => asString(v).trim().toLowerCase();

/** Grade -> points, architecture.md §8.2. Mirrors SQL grade_to_points(). */
export const GRADE_POINTS: Record<string, number> = {
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
};

/** Accepts either a letter grade or a raw point value. */
function toPoints(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const key = asString(value).toUpperCase().trim();
  return key in GRADE_POINTS ? GRADE_POINTS[key] : null;
}

function compare(operator: string, actual: number, threshold: number): boolean {
  return operator === 'lte' ? actual <= threshold : actual >= threshold;
}

/** Evaluate one criterion against the student's stored data. */
export function evaluateCriterion(
  criterion: Criterion,
  profile: StudentEligibilityProfile
): { status: CriterionStatus; hint: string | null } {
  // Plain-text conditions Nexus can now read: age, household income, SPM credits, citizenship.
  // (§10.5 still applies to everything else: marked not checkable -> unknown.)
  if (
    (!criterion.is_checkable || NO_DATA_SOURCE.includes(criterion.criterion_type)) &&
    ['other', 'age', 'citizenship'].includes(criterion.criterion_type)
  ) {
    const rule = inferRule(criterion.label);
    if (rule) return evaluateRule(rule, profile);
  }

  // §10.5 — the admin has marked this as something Nexus cannot verify.
  if (!criterion.is_checkable) {
    return { status: 'unknown', hint: CANNOT_VERIFY_HINT };
  }

  if (NO_DATA_SOURCE.includes(criterion.criterion_type)) {
    return { status: 'unknown', hint: CANNOT_VERIFY_HINT };
  }

  switch (criterion.criterion_type) {
    case 'citizenship': {
      // value 'MY' = Malaysian citizen. An unanswered question is unknown, not
      // a failure: the student chose not to say, or has not got to it yet.
      if (!profile.nationality) return { status: 'unknown', hint: ADD_NATIONALITY_HINT };
      const wanted = lower(criterion.value);
      if (wanted !== 'my' && wanted !== 'malaysian') {
        return { status: 'unknown', hint: CANNOT_VERIFY_HINT };
      }
      return profile.nationality === 'malaysian'
        ? { status: 'satisfied', hint: null }
        : { status: 'unsatisfied', hint: 'This scholarship is for Malaysian citizens.' };
    }

    case 'education_level': {
      if (!profile.educationLevel) {
        return { status: 'unsatisfied', hint: 'Set your education level in your profile.' };
      }
      const actual = profile.educationLevel.toLowerCase();
      const allowed = asArray(criterion.value).map(lower);
      const met = criterion.operator === 'in' ? allowed.includes(actual) : actual === allowed[0];
      return { status: met ? 'satisfied' : 'unsatisfied', hint: met ? null : null };
    }

    case 'field_of_study': {
      const mine = [
        ...profile.recommendedFields,
        profile.targetIndustry ?? '',
        profile.careerGoal ?? '',
      ]
        .map((f) => f.toLowerCase())
        .filter(Boolean);
      if (mine.length === 0) {
        return {
          status: 'unsatisfied',
          hint: 'Add a career goal, or generate your recommendations, so we know your field.',
        };
      }
      const wanted = asArray(criterion.value).map(lower).filter(Boolean);
      const met = wanted.some((w) => mine.some((m) => m.includes(w) || w.includes(m)));
      return { status: met ? 'satisfied' : 'unsatisfied', hint: null };
    }

    case 'subject_grade': {
      // value: { subject: 'MATH', grade: 'B', alt?: true }  (grade may also be a point value)
      const spec = (criterion.value ?? {}) as { subject?: string; grade?: unknown; alt?: unknown };
      if (spec.alt === true && Object.keys(profile.subjectPoints).length === 0) {
        return { status: 'unknown', hint: ALTERNATIVE_EXAM_HINT };
      }
      const subject = asString(spec.subject).toUpperCase();
      const threshold = toPoints(spec.grade);
      if (!subject || threshold === null) {
        return { status: 'unknown', hint: CANNOT_VERIFY_HINT };
      }
      const actual = profile.subjectPoints[subject];
      if (actual === undefined) {
        return {
          status: 'unsatisfied',
          hint: `You haven't added a grade for ${subject.replace(/_/g, ' ').toLowerCase()}.`,
        };
      }
      return {
        status: compare(criterion.operator, actual, threshold) ? 'satisfied' : 'unsatisfied',
        hint: null,
      };
    }

    case 'min_grade': {
      // Two value shapes:
      //   { count: 8, grade: 'A' } -> at least 8 subjects at grade A or better
      //   'B' / 5                  -> minimum average across recorded subjects
      const spec = criterion.value as { count?: unknown; grade?: unknown; alt?: unknown } | null;
      if (spec && typeof spec === 'object' && !Array.isArray(spec) && 'count' in spec) {
        if (spec.alt === true && Object.keys(profile.subjectPoints).length === 0) {
          return { status: 'unknown', hint: ALTERNATIVE_EXAM_HINT };
        }
        const count = Number(spec.count);
        const floor = toPoints(spec.grade);
        if (!Number.isInteger(count) || count < 1 || floor === null) {
          return { status: 'unknown', hint: CANNOT_VERIFY_HINT };
        }
        const points = Object.values(profile.subjectPoints);
        if (points.length === 0) {
          return { status: 'unsatisfied', hint: "You haven't added any exam results yet." };
        }
        const reached = points.filter((p) => p >= floor).length;
        return reached >= count
          ? { status: 'satisfied', hint: null }
          : { status: 'unsatisfied', hint: `You have ${reached} of the ${count} subjects needed.` };
      }
      const threshold = toPoints(criterion.value);
      if (threshold === null) return { status: 'unknown', hint: CANNOT_VERIFY_HINT };
      const points = Object.values(profile.subjectPoints);
      if (points.length === 0) {
        return { status: 'unsatisfied', hint: "You haven't added any exam results yet." };
      }
      const average = points.reduce((a, b) => a + b, 0) / points.length;
      return {
        status: compare(criterion.operator, average, threshold) ? 'satisfied' : 'unsatisfied',
        hint: null,
      };
    }

    // `other` marked checkable has no defined evaluation in the specification.
    default:
      return { status: 'unknown', hint: CANNOT_VERIFY_HINT };
  }
}

/**
 * §10.5 — score one scholarship.
 *
 * The denominator is the number of criteria Nexus could actually check.
 * Unverifiable criteria are excluded entirely rather than counted as failures,
 * so they can never drag a student's score down.
 */
export function matchScholarship(
  scholarship: ScholarshipRow,
  criteria: Criterion[],
  profile: StudentEligibilityProfile
): ScholarshipMatch {
  const checklist: ChecklistItem[] = criteria.map((criterion) => {
    const { status, hint } = evaluateCriterion(criterion, profile);
    return {
      criterion_id: criterion.id,
      criterion_type: criterion.criterion_type,
      label: criterion.label,
      status,
      hint,
    };
  });

  const checkable = checklist.filter((c) => c.status !== 'unknown');
  const satisfied = checkable.filter((c) => c.status === 'satisfied');
  const eligibilityScore = checkable.length
    ? Math.round((satisfied.length / checkable.length) * 10000) / 100
    : 0;

  // Relevance: how many of the scholarship's fields overlap the student's
  // recommended course fields (§10.5).
  const mine = new Set(profile.recommendedFields.map((f) => f.toLowerCase()));
  const relevanceScore = (scholarship.field_of_study ?? []).filter((f) =>
    mine.has(String(f).toLowerCase())
  ).length;

  return {
    scholarship_id: scholarship.id,
    eligibility_score: eligibilityScore,
    relevance_score: relevanceScore,
    checkable_count: checkable.length,
    satisfied_count: satisfied.length,
    checklist,
  };
}

/**
 * §10.5 ranking: eligibility DESC, relevance DESC, deadline ASC.
 *
 * Scholarships with no deadline (rolling intake) sort after dated ones, and a
 * final id tie-break keeps the order repeatable — the documented three keys
 * cannot separate two equally-scored records.
 */
export function rankMatches(
  matches: ScholarshipMatch[],
  byId: Map<string, ScholarshipRow>
): ScholarshipMatch[] {
  return [...matches].sort((a, b) => {
    if (b.eligibility_score !== a.eligibility_score) {
      return b.eligibility_score - a.eligibility_score;
    }
    if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;

    const da = byId.get(a.scholarship_id)?.deadline ?? null;
    const db = byId.get(b.scholarship_id)?.deadline ?? null;
    if (da !== db) {
      if (da === null) return 1;
      if (db === null) return -1;
      return da < db ? -1 : 1;
    }
    return a.scholarship_id < b.scholarship_id ? -1 : a.scholarship_id > b.scholarship_id ? 1 : 0;
  });
}

/** Run the whole matcher over a set of scholarships. */
export function matchAll(
  scholarships: ScholarshipRow[],
  criteriaByScholarship: Map<string, Criterion[]>,
  profile: StudentEligibilityProfile
): ScholarshipMatch[] {
  const byId = new Map(scholarships.map((s) => [s.id, s]));
  const matches = scholarships.map((s) =>
    matchScholarship(s, criteriaByScholarship.get(s.id) ?? [], profile)
  );
  return rankMatches(matches, byId);
}

/**
 * Deadline urgency — mirrors the SQL deadline_urgency() thresholds
 * (architecture.md §3.8 / §10.2). 7 and 30 are fixed by the report.
 */
export function deadlineUrgency(
  deadline: string | null,
  now: Date = new Date()
): 'critical' | 'warning' | 'normal' | 'none' {
  if (!deadline) return 'none';
  const d = new Date(`${deadline}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 'none';
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((d.getTime() - today) / 86_400_000);
  if (days <= 7) return 'critical';
  if (days <= 30) return 'warning';
  return 'normal';
}
