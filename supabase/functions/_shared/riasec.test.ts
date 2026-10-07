/**
 * RIASEC scoring tests — verified against docs/architecture.md §7.
 * Runs under Vitest (the module is pure; no Deno APIs are touched).
 */
import { describe, it, expect } from 'vitest';
import bankJson from '../score-riasec/question-bank.json';
import {
  HEXAGON_ORDER,
  MAX_DIMENSION_SCORE,
  TOTAL_ITEMS,
  deriveHollandCode,
  rankedDimensions,
  scoreResponses,
  scoresToRow,
  toPercentages,
  validateQuestionBank,
  validateResponses,
  type Letter,
  type QuestionBank,
  type Scores,
} from './riasec.ts';

const bank = bankJson as unknown as QuestionBank;

/** Build a full 36-item response set from a per-dimension value map. */
function responsesFor(byDimension: Partial<Record<Letter, number>>, fallback = 0) {
  return bank.questions.map((q) => ({
    question_id: q.id,
    value: byDimension[q.dimension] ?? fallback,
  }));
}

// ---------------------------------------------------------------------------
describe('question bank (the shipped config)', () => {
  it('holds exactly 36 items, six per dimension, ids 1-36 unique', () => {
    expect(validateQuestionBank(bank)).toEqual({ ok: true });
    expect(bank.questions).toHaveLength(TOTAL_ITEMS);
    for (const letter of HEXAGON_ORDER) {
      expect(bank.questions.filter((q) => q.dimension === letter)).toHaveLength(6);
    }
  });

  it('reproduces the one item the report specifies (Figure 4.6) as a Realistic item', () => {
    const first = bank.questions.find((q) => q.id === 1);
    expect(first?.text).toBe('I like to work with my hands to build or repair things.');
    expect(first?.dimension).toBe('R');
  });

  it('uses the five-point 0-4 scale adopted in §7.2', () => {
    expect(bank.scale.min).toBe(0);
    expect(bank.scale.max).toBe(4);
    expect(bank.scale.labels).toHaveLength(5);
  });

  it('rejects a tampered bank (wrong item count in a dimension)', () => {
    const broken = { ...bank, questions: bank.questions.slice(0, 35) };
    expect(validateQuestionBank(broken as QuestionBank).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('validateResponses — §7.1 / AC-14', () => {
  it('accepts a complete, in-range set', () => {
    expect(validateResponses(responsesFor({}, 2), bank)).toEqual({ ok: true });
  });

  it('rejects fewer than 36 answers (submission blocked while any item is unanswered)', () => {
    const short = responsesFor({}, 2).slice(0, 35);
    const res = validateResponses(short, bank);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INCOMPLETE_ASSESSMENT');
  });

  it('rejects more than 36 answers', () => {
    const long = [...responsesFor({}, 2), { question_id: 1, value: 1 }];
    expect(validateResponses(long, bank).ok).toBe(false);
  });

  it('rejects a duplicated question id', () => {
    const dupe = responsesFor({}, 2);
    dupe[35] = { question_id: 1, value: 3 };
    expect(validateResponses(dupe, bank).ok).toBe(false);
  });

  it.each([0, 37, -1, 1.5])('rejects out-of-range question id %s', (id) => {
    const bad = responsesFor({}, 2);
    bad[0] = { question_id: id as number, value: 2 };
    expect(validateResponses(bad, bank).ok).toBe(false);
  });

  it.each([-1, 5, 2.5, Number.NaN])('rejects out-of-range answer value %s', (value) => {
    const bad = responsesFor({}, 2);
    bad[0] = { question_id: 1, value: value as number };
    expect(validateResponses(bad, bank).ok).toBe(false);
  });

  it.each([null, undefined, 'nope', 42, {}])('rejects a non-list payload (%s)', (payload) => {
    expect(validateResponses(payload, bank).ok).toBe(false);
  });

  it('rejects a malformed entry', () => {
    const bad: unknown[] = responsesFor({}, 2);
    bad[3] = null;
    expect(validateResponses(bad, bank).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('scoreResponses — §7.2 plain sum, range 0-24', () => {
  it('sums the six items of each dimension', () => {
    const scores = scoreResponses(responsesFor({ R: 0, I: 4, A: 3, S: 2, E: 1, C: 0 }), bank);
    expect(scores).toEqual({ R: 0, I: 24, A: 18, S: 12, E: 6, C: 0 });
  });

  it('caps at 24 when every item is answered 4', () => {
    const scores = scoreResponses(responsesFor({}, 4), bank);
    for (const letter of HEXAGON_ORDER) expect(scores[letter]).toBe(MAX_DIMENSION_SCORE);
  });

  it('floors at 0 when every item is answered 0', () => {
    const scores = scoreResponses(responsesFor({}, 0), bank);
    for (const letter of HEXAGON_ORDER) expect(scores[letter]).toBe(0);
  });

  it('never weights or reverses an item — a single +1 moves exactly one dimension by 1', () => {
    const base = responsesFor({}, 0);
    const bumped = base.map((r) => (r.question_id === 1 ? { ...r, value: 1 } : r));
    expect(scoreResponses(bumped, bank)).toEqual({ R: 1, I: 0, A: 0, S: 0, E: 0, C: 0 });
  });
});

// ---------------------------------------------------------------------------
describe('deriveHollandCode — §7.3', () => {
  it('takes the three highest dimensions in descending order', () => {
    const scores: Scores = { R: 6, I: 21, A: 16, S: 18, E: 11, C: 9 };
    expect(deriveHollandCode(scores)).toBe('ISA');
  });

  it('breaks ties using the canonical hexagon order R-I-A-S-E-C', () => {
    const allTied: Scores = { R: 12, I: 12, A: 12, S: 12, E: 12, C: 12 };
    expect(deriveHollandCode(allTied)).toBe('RIA');
  });

  it('applies the hexagon order only among tied scores', () => {
    // C is clearly highest; A and S tie behind it -> A wins on hexagon order
    const scores: Scores = { R: 1, I: 2, A: 9, S: 9, E: 3, C: 20 };
    expect(deriveHollandCode(scores)).toBe('CAS');
  });

  it('is deterministic — the same responses always produce the same code (AC-13)', () => {
    const responses = responsesFor({ R: 2, I: 3, A: 3, S: 1, E: 4, C: 2 });
    const first = deriveHollandCode(scoreResponses(responses, bank));
    for (let i = 0; i < 25; i += 1) {
      expect(deriveHollandCode(scoreResponses(responses, bank))).toBe(first);
    }
  });

  it('always returns exactly three letters from the RIASEC set (AC-12)', () => {
    const code = deriveHollandCode(scoreResponses(responsesFor({}, 4), bank));
    expect(code).toMatch(/^[RIASEC]{3}$/);
  });
});

// ---------------------------------------------------------------------------
describe('display helpers', () => {
  it('normalises to a percentage of 24 (§7.2)', () => {
    expect(toPercentages({ R: 24, I: 12, A: 0, S: 6, E: 18, C: 3 })).toEqual({
      R: 100,
      I: 50,
      A: 0,
      S: 25,
      E: 75,
      C: 13,
    });
  });

  it('ranks dimensions with the same tie-break as the Holland Code', () => {
    const ranked = rankedDimensions({ R: 5, I: 5, A: 1, S: 0, E: 0, C: 0 });
    expect(ranked.map((d) => d.letter)).toEqual(['R', 'I', 'A', 'S', 'E', 'C']);
  });

  it('maps scores onto the riasec_results column names (§3.2)', () => {
    expect(scoresToRow({ R: 1, I: 2, A: 3, S: 4, E: 5, C: 6 })).toEqual({
      realistic_score: 1,
      investigative_score: 2,
      artistic_score: 3,
      social_score: 4,
      enterprising_score: 5,
      conventional_score: 6,
    });
  });
});
