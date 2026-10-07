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
 * Criterion types the documented profile has no collection point for.
 *
 * ui-specifications.md §9.1 states outright that date of birth, IC number and
 * nationality are NOT collected, so `age` and `citizenship` can never be
 * verified from stored data. They are reported as `unknown` — "we cannot check
 * this" — rather than guessed in either direction, which is the §10.6 rule.
 * See supabase/functions/README.md for the gap report.
 */
const NO_DATA_SOURCE: CriterionType[] = ['citizenship', 'age'];

const CANNOT_VERIFY_HINT = "Nexus can't check this. See the provider's page.";

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
  // §10.5 — the admin has marked this as something Nexus cannot verify.
  if (!criterion.is_checkable) {
    return { status: 'unknown', hint: CANNOT_VERIFY_HINT };
  }

  if (NO_DATA_SOURCE.includes(criterion.criterion_type)) {
    return { status: 'unknown', hint: CANNOT_VERIFY_HINT };
  }

  switch (criterion.criterion_type) {
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
      // value: { subject: 'MATH', grade: 'B' }  (grade may also be a point value)
      const spec = (criterion.value ?? {}) as { subject?: string; grade?: unknown };
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
      // Minimum average across every subject the student has recorded.
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
