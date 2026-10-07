/**
 * Knowledge-based recommendation engine — pure logic, unit-testable.
 *
 * Deterministic and explainable. No machine learning, no generative AI: §4.1.3
 * of the report excludes both, and Gemini must never produce a recommendation
 * (architecture.md §9). Every output carries the rule that produced it and the
 * labelled conditions that were evaluated.
 *
 * Transcribed from docs/architecture.md §9:
 *   §9.1  rule/condition schema and the six condition types
 *   §9.2  match_score = (satisfied / applicable) × 100; fires at >= 50
 *   §9.3  rank by score desc, satisfied count desc, rule id asc
 *   §9.4  degraded mode — subject conditions are NOT EVALUABLE and excluded
 *         from both numerator and denominator; subject-only rules are skipped
 *   §9.6  careers.riasec_profile is a secondary signal, listed separately
 */

import type { Letter, Scores } from './riasec.ts';

export type ConditionStatus = 'satisfied' | 'unsatisfied' | 'not_evaluable';
export type Strength = 'strong' | 'average' | 'weak';

export interface RuleCondition {
  type:
    | 'riasec_letter'
    | 'riasec_score'
    | 'subject_strength'
    | 'subject_domain_strength'
    | 'education_level'
    | 'interest';
  operator: 'in_top_n' | 'is_primary' | 'gte' | 'lte' | 'eq' | 'in' | 'contains';
  label: string;
  value?: unknown;
  n?: number;
  subject?: string;
  domain?: string;
  dimension?: Letter;
}

export interface Rule {
  id: string;
  conditions: RuleCondition[];
  outputs: { careers?: string[]; course_fields?: string[] };
}

export interface RuleBase {
  version: string;
  rules: Rule[];
}

/** Everything the engine is allowed to see about one student. */
export interface StudentFacts {
  hollandCode: string;
  scores: Scores;
  /** subject_code -> strength. Empty object means "no academic data" (§9.4). */
  subjectStrengths: Record<string, Strength>;
  /** subject_code -> subjects.domain, for subject_domain_strength. */
  subjectDomains: Record<string, string>;
  educationLevel: string | null;
  careerGoal: string | null;
  targetIndustry: string | null;
}

/** The shape stored in recommendations.reasons (architecture.md §3.5). */
export interface Reason {
  condition: RuleCondition['type'];
  satisfied: boolean;
  text: string;
}

export interface EvaluatedRule {
  ruleId: string;
  statuses: ConditionStatus[];
  reasons: Reason[];
  applicable: number;
  satisfied: number;
  matchScore: number;
  fired: boolean;
  /** true when every condition was NOT EVALUABLE (subject-only rule, §9.4). */
  skipped: boolean;
}

export const FIRING_THRESHOLD = 50; // §9.2
export const RESULTS_PER_TYPE = 8; // §9.3 / D-15

/**
 * `subject_domain_strength` aggregation.
 *
 * OPEN DECISION — architecture.md §9.1 says only "aggregate over subjects.domain"
 * and never defines the aggregation function. The default below (satisfied when
 * AT LEAST ONE subject in the domain carries the required strength) is the
 * reading that matches how the report phrases the rules it does document
 * ("strong mathematics", "strong science"), but it is a decision the
 * specification does not make. It is isolated here so it is a one-line change,
 * and it is reported as an open item rather than presented as documented.
 */
export const DOMAIN_AGGREGATION: 'any' | 'all' = 'any';

const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

function hasAcademicData(facts: StudentFacts): boolean {
  return Object.keys(facts.subjectStrengths).length > 0;
}

/**
 * Evaluate one condition. Returns `not_evaluable` only where §9.4 says so: the
 * two subject condition types when the student has no academic data at all.
 *
 * A subject the student simply did not sit is `unsatisfied`, not an error and
 * not `not_evaluable` — architecture.md §8.4 states this explicitly.
 */
export function evaluateCondition(cond: RuleCondition, facts: StudentFacts): ConditionStatus {
  const yes = (b: boolean): ConditionStatus => (b ? 'satisfied' : 'unsatisfied');

  switch (cond.type) {
    case 'riasec_letter': {
      const letter = asString(cond.value).toUpperCase();
      if (cond.operator === 'is_primary') return yes(facts.hollandCode.charAt(0) === letter);
      // in_top_n — the Holland Code is already the top three (§7.3)
      const n = Number.isInteger(cond.n) ? (cond.n as number) : 3;
      return yes(facts.hollandCode.slice(0, n).includes(letter));
    }

    case 'riasec_score': {
      const dimension = cond.dimension;
      if (!dimension || !(dimension in facts.scores)) return 'unsatisfied';
      const actual = facts.scores[dimension];
      const threshold = Number(cond.value);
      if (!Number.isFinite(threshold)) return 'unsatisfied';
      return yes(cond.operator === 'lte' ? actual <= threshold : actual >= threshold);
    }

    case 'subject_strength': {
      if (!hasAcademicData(facts)) return 'not_evaluable'; // §9.4
      const subject = asString(cond.subject).toUpperCase();
      const actual = facts.subjectStrengths[subject];
      if (!actual) return 'unsatisfied'; // §8.4 — subject not sat
      if (cond.operator === 'in') {
        const allowed = Array.isArray(cond.value) ? (cond.value as string[]) : [];
        return yes(allowed.includes(actual));
      }
      return yes(actual === cond.value);
    }

    case 'subject_domain_strength': {
      if (!hasAcademicData(facts)) return 'not_evaluable'; // §9.4
      const domain = asString(cond.domain).toLowerCase();
      const wanted = asString(cond.value);
      const inDomain = Object.keys(facts.subjectStrengths).filter(
        (code) => (facts.subjectDomains[code] ?? '').toLowerCase() === domain
      );
      if (inDomain.length === 0) return 'unsatisfied';
      const matches = inDomain.filter((code) => facts.subjectStrengths[code] === wanted);
      return yes(DOMAIN_AGGREGATION === 'all' ? matches.length === inDomain.length : matches.length > 0);
    }

    case 'education_level': {
      const level = facts.educationLevel;
      if (!level) return 'unsatisfied';
      if (cond.operator === 'in') {
        const allowed = Array.isArray(cond.value) ? (cond.value as string[]) : [];
        return yes(allowed.includes(level));
      }
      return yes(level === cond.value);
    }

    case 'interest': {
      // Matched against profiles.career_goal and profiles.target_industry (§9.1).
      // Neither stated -> unsatisfied, which is what the recommendation card in
      // ui-specifications.md §3.9 shows ("Interest in health sciences not stated").
      const haystack = `${facts.careerGoal ?? ''} ${facts.targetIndustry ?? ''}`
        .toLowerCase()
        .trim();
      const needle = asString(cond.value).toLowerCase().trim();
      if (!needle) return 'unsatisfied';
      if (cond.operator === 'eq') return yes(haystack === needle);
      return yes(haystack.includes(needle));
    }

    default:
      return 'not_evaluable';
  }
}

/**
 * Every condition must carry a label — "no label, no explanation" (§9.1).
 * Enforced at load so a malformed rule can never produce an unexplained card.
 */
export function validateRuleBase(base: RuleBase): { ok: true } | { ok: false; message: string } {
  if (!base || !Array.isArray(base.rules)) return { ok: false, message: 'Rule base is malformed.' };
  const ids = new Set<string>();
  for (const rule of base.rules) {
    if (!rule.id) return { ok: false, message: 'A rule is missing an id.' };
    if (ids.has(rule.id)) return { ok: false, message: `Duplicate rule id ${rule.id}.` };
    ids.add(rule.id);
    if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
      return { ok: false, message: `Rule ${rule.id} has no conditions.` };
    }
    for (const cond of rule.conditions) {
      if (!cond.label || cond.label.trim() === '') {
        return { ok: false, message: `Rule ${rule.id} has a condition with no label.` };
      }
    }
    const outs = rule.outputs ?? {};
    if (!outs.careers?.length && !outs.course_fields?.length) {
      return { ok: false, message: `Rule ${rule.id} produces no outputs.` };
    }
  }
  return { ok: true };
}

/** §9.2 — score one rule against one student. */
export function evaluateRule(rule: Rule, facts: StudentFacts): EvaluatedRule {
  const statuses = rule.conditions.map((c) => evaluateCondition(c, facts));

  const reasons: Reason[] = [];
  rule.conditions.forEach((cond, i) => {
    // NOT EVALUABLE conditions contributed nothing, so they are not presented
    // as a reason. The degraded-mode notice explains the omission (§9.4).
    if (statuses[i] === 'not_evaluable') return;
    reasons.push({
      condition: cond.type,
      satisfied: statuses[i] === 'satisfied',
      text: cond.label,
    });
  });

  const applicable = statuses.filter((s) => s !== 'not_evaluable').length;
  const satisfied = statuses.filter((s) => s === 'satisfied').length;
  const skipped = applicable === 0;
  const matchScore = skipped ? 0 : (satisfied / applicable) * 100;

  return {
    ruleId: rule.id,
    statuses,
    reasons,
    applicable,
    satisfied,
    matchScore,
    fired: !skipped && matchScore >= FIRING_THRESHOLD,
    skipped,
  };
}

export interface CatalogCareer {
  id: string;
  name: string;
  slug?: string;
  field: string;
  description?: string;
  riasec_profile: string;
}
export interface CatalogCourse {
  id: string;
  name: string;
  field_of_study: string;
  university_name: string | null;
  pathway_type: string | null;
  duration_months: number | null;
  entry_requirements: string;
}
export interface Catalog {
  careers: CatalogCareer[];
  courses: CatalogCourse[];
}

export interface Recommendation {
  target_id: string;
  match_score: number;
  rank: number;
  rule_id: string;
  reasons: Reason[];
  /** Denormalised for display; not persisted in the recommendations table. */
  detail: CatalogCareer | CatalogCourse;
}

interface Candidate {
  targetId: string;
  matchScore: number;
  satisfiedCount: number;
  ruleId: string;
  reasons: Reason[];
  detail: CatalogCareer | CatalogCourse;
}

/**
 * §9.3 ranking: match_score desc, satisfied-condition count desc, rule id asc.
 *
 * A fourth key (target id asc) is appended because one rule commonly emits
 * several courses, which tie on all three documented keys — without it the
 * output order is not repeatable and AC-23 ("identical inputs produce identical
 * ranked output") cannot hold. Reported as an open item.
 */
function compareCandidates(a: Candidate, b: Candidate): number {
  if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
  if (b.satisfiedCount !== a.satisfiedCount) return b.satisfiedCount - a.satisfiedCount;
  if (a.ruleId !== b.ruleId) return a.ruleId < b.ruleId ? -1 : 1;
  return a.targetId < b.targetId ? -1 : a.targetId > b.targetId ? 1 : 0;
}

/** Dedupe keeping the strongest evidence for each target (§9.5). */
function dedupe(candidates: Candidate[]): Candidate[] {
  const best = new Map<string, Candidate>();
  for (const c of candidates) {
    const existing = best.get(c.targetId);
    if (!existing || compareCandidates(c, existing) < 0) best.set(c.targetId, c);
  }
  return [...best.values()];
}

function toRecommendations(candidates: Candidate[], limit: number): Recommendation[] {
  return dedupe(candidates)
    .sort(compareCandidates)
    .slice(0, limit)
    .map((c, i) => ({
      target_id: c.targetId,
      match_score: Math.round(c.matchScore * 100) / 100,
      rank: i + 1,
      rule_id: c.ruleId,
      reasons: c.reasons,
      detail: c.detail,
    }));
}

export interface EngineResult {
  careers: Recommendation[];
  courses: Recommendation[];
  /** §9.6 — careers surfaced by riasec_profile overlap, kept separate. */
  secondaryCareers: { detail: CatalogCareer; sharedLetters: string[] }[];
  degradedMode: boolean;
  firedRules: EvaluatedRule[];
}

/** §9.5 — the full pipeline, minus I/O. */
export function generateRecommendations(
  base: RuleBase,
  facts: StudentFacts,
  catalog: Catalog
): EngineResult {
  const degradedMode = !hasAcademicData(facts);

  const careerCandidates: Candidate[] = [];
  const courseCandidates: Candidate[] = [];
  const firedRules: EvaluatedRule[] = [];

  const careerByName = new Map(catalog.careers.map((c) => [c.name.toLowerCase(), c]));

  for (const rule of base.rules) {
    const evaluated = evaluateRule(rule, facts);
    if (!evaluated.fired) continue;
    firedRules.push(evaluated);

    for (const name of rule.outputs.careers ?? []) {
      const career = careerByName.get(name.toLowerCase());
      if (!career) continue; // unseeded catalog entry — silently skipped
      careerCandidates.push({
        targetId: career.id,
        matchScore: evaluated.matchScore,
        satisfiedCount: evaluated.satisfied,
        ruleId: evaluated.ruleId,
        reasons: evaluated.reasons,
        detail: career,
      });
    }

    for (const field of rule.outputs.course_fields ?? []) {
      const wanted = field.toLowerCase();
      for (const course of catalog.courses) {
        if (course.field_of_study.toLowerCase() !== wanted) continue;
        courseCandidates.push({
          targetId: course.id,
          matchScore: evaluated.matchScore,
          satisfiedCount: evaluated.satisfied,
          ruleId: evaluated.ruleId,
          reasons: evaluated.reasons,
          detail: course,
        });
      }
    }
  }

  const careers = toRecommendations(careerCandidates, RESULTS_PER_TYPE);
  const courses = toRecommendations(courseCandidates, RESULTS_PER_TYPE);

  // §9.6 secondary signal: two or more shared letters with the Holland Code.
  const ruleMatched = new Set(careers.map((c) => c.target_id));
  const studentLetters = new Set(facts.hollandCode.split(''));
  const secondaryCareers = catalog.careers
    .filter((career) => !ruleMatched.has(career.id))
    .map((career) => ({
      detail: career,
      sharedLetters: [...new Set(career.riasec_profile.split(''))].filter((l) =>
        studentLetters.has(l)
      ),
    }))
    .filter((entry) => entry.sharedLetters.length >= 2)
    .sort((a, b) => {
      if (b.sharedLetters.length !== a.sharedLetters.length) {
        return b.sharedLetters.length - a.sharedLetters.length;
      }
      return a.detail.name < b.detail.name ? -1 : a.detail.name > b.detail.name ? 1 : 0;
    });

  return { careers, courses, secondaryCareers, degradedMode, firedRules };
}
