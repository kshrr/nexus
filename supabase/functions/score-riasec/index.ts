/**
 * fn:score-riasec — architecture.md §7.1, §15.
 *
 *   GET  ?action=questions  -> { questions: [{ id, text }], scale }
 *                              NO `dimension` field: the answer key never
 *                              leaves the server (§3.3.2C / AC-16).
 *   GET  ?action=interpretation&code=ISA -> per-letter description blocks (§7.5)
 *   POST { responses: [{ question_id, value }] × 36 }
 *        -> validate, score, derive Holland Code, persist, return
 *
 * All database access runs under the caller's JWT (FR-SEC-05).
 */
import { getCaller } from '../_shared/auth.ts';
import { fail, ok, preflight, serverError } from '../_shared/http.ts';
import {
  HEXAGON_ORDER,
  deriveHollandCode,
  scoreResponses,
  scoresToRow,
  validateQuestionBank,
  validateResponses,
  type Letter,
  type QuestionBank,
} from '../_shared/riasec.ts';

import bankJson from './question-bank.json' with { type: 'json' };
import interpretationsJson from './interpretations.json' with { type: 'json' };

const bank = bankJson as unknown as QuestionBank;
const interpretations = interpretationsJson as {
  letters: Record<string, Record<string, string>>;
};

// Fail fast at cold start if the config file has been edited badly (NFR07).
const bankCheck = validateQuestionBank(bank);

// @ts-expect-error — Deno global
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req);

  try {
    if (!bankCheck.ok) {
      return fail(500, 'QUESTION_BANK_INVALID', 'The assessment is unavailable right now.');
    }

    const caller = await getCaller(req);
    if (!caller) return fail(401, 'UNAUTHENTICATED', 'Sign in to continue.');

    const url = new URL(req.url);

    // ---- GET ?action=questions -------------------------------------------
    if (req.method === 'GET' && url.searchParams.get('action') === 'questions') {
      return ok({
        version: bank.version,
        scale: bank.scale,
        questions: bank.questions
          .slice()
          .sort((a, b) => a.id - b.id)
          .map(({ id, text }) => ({ id, text })), // dimension deliberately omitted
      });
    }

    // ---- GET ?action=interpretation&code=ISA -----------------------------
    if (req.method === 'GET' && url.searchParams.get('action') === 'interpretation') {
      const code = (url.searchParams.get('code') ?? '').toUpperCase();
      if (!/^[RIASEC]{3}$/.test(code)) {
        return fail(400, 'INVALID_CODE', 'That is not a valid Holland Code.');
      }
      return ok({
        code,
        blocks: code.split('').map((letter) => ({
          letter,
          ...interpretations.letters[letter],
        })),
      });
    }

    if (req.method !== 'POST') {
      return fail(405, 'METHOD_NOT_ALLOWED', 'Unsupported request.');
    }

    // ---- POST scoring ----------------------------------------------------
    let body: { responses?: unknown };
    try {
      body = await req.json();
    } catch {
      return fail(400, 'INCOMPLETE_ASSESSMENT', 'Malformed request body.');
    }

    const check = validateResponses(body?.responses, bank);
    if (!check.ok) return fail(400, check.code, check.message);

    const responses = body.responses as { question_id: number; value: number }[];
    const scores = scoreResponses(responses, bank);
    const hollandCode = deriveHollandCode(scores);

    const { client, userId } = caller;

    // Item-level responses — needed to recompute if the key changes (§3.2).
    const { error: responsesError } = await client.from('riasec_responses').upsert(
      responses.map((r) => ({
        user_id: userId,
        question_id: r.question_id,
        response_value: r.value,
        answered_at: new Date().toISOString(),
      })),
      { onConflict: 'user_id,question_id' }
    );
    if (responsesError) throw responsesError;

    // One active row per user — PK is user_id, so upsert overwrites (§3.2, AC-15).
    const { error: resultError } = await client.from('riasec_results').upsert(
      {
        user_id: userId,
        ...scoresToRow(scores),
        holland_code: hollandCode,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (resultError) throw resultError;

    // §9.7 — recommendations are regenerated on RIASEC submission. Clearing the
    // stale set here keeps /recommendations honest until it is next generated.
    await client.from('recommendations').delete().eq('user_id', userId);

    return ok({
      scores,
      holland_code: hollandCode,
      dimensions: HEXAGON_ORDER.map((letter: Letter) => ({ letter, score: scores[letter] })),
    });
  } catch (err) {
    return serverError(err);
  }
});
