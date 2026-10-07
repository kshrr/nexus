/**
 * RIASEC scoring — pure logic, no I/O, no Deno APIs, so it is unit-testable.
 *
 * Every rule here is transcribed from docs/architecture.md §7. Nothing is
 * invented:
 *   §7.2  five-point Likert, values 0-4, dimension_score = Σ(6 items) → 0-24
 *   §7.2  percentage = (score / 24) × 100
 *   §7.3  Holland Code = top three dimensions, descending by score;
 *         ties broken by canonical hexagon order R, I, A, S, E, C
 *   §7.1  validation: exactly 36 responses, ids 1-36 unique, values 0-4
 *
 * The answer key (question -> dimension) lives in question-bank.json and never
 * leaves the server (§3.3.2C / AC-16).
 */

export type Letter = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

/** Holland's canonical hexagon order — the §7.3 tie-break sequence. */
export const HEXAGON_ORDER: Letter[] = ['R', 'I', 'A', 'S', 'E', 'C'];

export const SCALE_MIN = 0;
export const SCALE_MAX = 4;
export const ITEMS_PER_DIMENSION = 6;
export const TOTAL_ITEMS = 36;
/** 6 items × max 4 = 24 (§7.2). */
export const MAX_DIMENSION_SCORE = ITEMS_PER_DIMENSION * SCALE_MAX;

export interface QuestionBankItem {
  id: number;
  dimension: Letter;
  text: string;
}

export interface QuestionBank {
  version: string;
  scale: { min: number; max: number; labels: string[] };
  questions: QuestionBankItem[];
}

export interface AssessmentResponse {
  question_id: number;
  value: number;
}

export type Scores = Record<Letter, number>;

export interface ValidationFailure {
  ok: false;
  code: 'INCOMPLETE_ASSESSMENT';
  message: string;
}
export type ValidationResult = { ok: true } | ValidationFailure;

const fail = (message: string): ValidationFailure => ({
  ok: false,
  code: 'INCOMPLETE_ASSESSMENT',
  message,
});

/**
 * Structural integrity of the question bank itself. Guards against a bad edit
 * to the config file (NFR07 allows editing it without code changes, so it must
 * be checked at load).
 */
export function validateQuestionBank(bank: QuestionBank): ValidationResult {
  if (!bank || !Array.isArray(bank.questions)) return fail('Question bank is malformed.');
  if (bank.questions.length !== TOTAL_ITEMS) {
    return fail(`Question bank must hold exactly ${TOTAL_ITEMS} items.`);
  }
  const ids = new Set<number>();
  const perDimension: Record<string, number> = {};
  for (const q of bank.questions) {
    if (!Number.isInteger(q.id) || q.id < 1 || q.id > TOTAL_ITEMS) {
      return fail(`Question id ${q.id} is out of range.`);
    }
    if (ids.has(q.id)) return fail(`Duplicate question id ${q.id}.`);
    ids.add(q.id);
    if (!HEXAGON_ORDER.includes(q.dimension)) {
      return fail(`Question ${q.id} has an unknown dimension.`);
    }
    if (typeof q.text !== 'string' || q.text.trim() === '') {
      return fail(`Question ${q.id} has no text.`);
    }
    perDimension[q.dimension] = (perDimension[q.dimension] ?? 0) + 1;
  }
  for (const letter of HEXAGON_ORDER) {
    if (perDimension[letter] !== ITEMS_PER_DIMENSION) {
      return fail(`Dimension ${letter} must have exactly ${ITEMS_PER_DIMENSION} items.`);
    }
  }
  return { ok: true };
}

/**
 * §7.1 validation: exactly 36 items; ids unique and within 1-36; values 0-4.
 * Any failure → 400 INCOMPLETE_ASSESSMENT (§15).
 */
export function validateResponses(
  responses: unknown,
  bank: QuestionBank
): ValidationResult {
  if (!Array.isArray(responses)) return fail('Responses must be a list.');
  if (responses.length !== TOTAL_ITEMS) {
    return fail(`Answer all ${TOTAL_ITEMS} questions before submitting.`);
  }

  const known = new Set(bank.questions.map((q) => q.id));
  const seen = new Set<number>();

  for (const raw of responses as AssessmentResponse[]) {
    if (!raw || typeof raw !== 'object') return fail('Malformed response entry.');
    const { question_id: id, value } = raw;

    if (!Number.isInteger(id) || id < 1 || id > TOTAL_ITEMS) {
      return fail(`Question id ${String(id)} is out of range.`);
    }
    if (!known.has(id)) return fail(`Question id ${id} is not in the question bank.`);
    if (seen.has(id)) return fail(`Question ${id} was answered more than once.`);
    seen.add(id);

    if (!Number.isInteger(value) || value < SCALE_MIN || value > SCALE_MAX) {
      return fail(`Question ${id} has an out-of-range answer.`);
    }
  }

  if (seen.size !== TOTAL_ITEMS) return fail('Every question must be answered exactly once.');
  return { ok: true };
}

/**
 * §7.2 — dimension_score = Σ(values of that dimension's 6 items). Plain sum; no
 * weighting and no reverse scoring (see the note in supabase/functions/README.md).
 * Assumes validateResponses() has already passed.
 */
export function scoreResponses(responses: AssessmentResponse[], bank: QuestionBank): Scores {
  const dimensionOf = new Map<number, Letter>(bank.questions.map((q) => [q.id, q.dimension]));
  const scores: Scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  for (const { question_id, value } of responses) {
    const dimension = dimensionOf.get(question_id);
    if (dimension) scores[dimension] += value;
  }
  return scores;
}

/**
 * §7.3 — the three highest-scoring dimensions, descending. Equal scores are
 * separated by the canonical hexagon order R-I-A-S-E-C, which makes the result
 * deterministic for a given response set (AC-13).
 */
export function deriveHollandCode(scores: Scores): string {
  return [...HEXAGON_ORDER]
    .sort((a, b) => {
      if (scores[b] !== scores[a]) return scores[b] - scores[a];
      return HEXAGON_ORDER.indexOf(a) - HEXAGON_ORDER.indexOf(b);
    })
    .slice(0, 3)
    .join('');
}

/** §7.2 — display normalisation for the radar chart and score list. */
export function toPercentages(scores: Scores): Record<Letter, number> {
  const out = {} as Record<Letter, number>;
  for (const letter of HEXAGON_ORDER) {
    out[letter] = Math.round((scores[letter] / MAX_DIMENSION_SCORE) * 100);
  }
  return out;
}

/** Ranked dimensions, highest first, hexagon order as tie-break. */
export function rankedDimensions(scores: Scores): { letter: Letter; score: number }[] {
  return [...HEXAGON_ORDER]
    .sort((a, b) => {
      if (scores[b] !== scores[a]) return scores[b] - scores[a];
      return HEXAGON_ORDER.indexOf(a) - HEXAGON_ORDER.indexOf(b);
    })
    .map((letter) => ({ letter, score: scores[letter] }));
}

/** Column names used by the riasec_results table (§3.2). */
export const SCORE_COLUMNS: Record<Letter, string> = {
  R: 'realistic_score',
  I: 'investigative_score',
  A: 'artistic_score',
  S: 'social_score',
  E: 'enterprising_score',
  C: 'conventional_score',
};

export function scoresToRow(scores: Scores): Record<string, number> {
  const row: Record<string, number> = {};
  for (const letter of HEXAGON_ORDER) row[SCORE_COLUMNS[letter]] = scores[letter];
  return row;
}
