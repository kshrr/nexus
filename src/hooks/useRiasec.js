import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { FUNCTIONS, getFunction, invokeFunction, normaliseError } from '@/lib/api';
import { useAuth } from '@/context/useAuth';

/**
 * RIASEC assessment data access (FR05, architecture.md §7).
 *
 * Question text arrives from `fn:score-riasec?action=questions` WITHOUT the
 * dimension mapping — the answer key never reaches the browser (§3.3.2C /
 * AC-16). Scoring happens server-side; nothing here computes a score.
 */

/** The 36 items plus the response scale. */
export function useRiasecQuestions(enabled = true) {
  const [questions, setQuestions] = useState([]);
  const [scale, setScale] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!config.isConfigured) {
      setLoading(false);
      setError({ code: 'NOT_CONFIGURED', message: 'The assessment is not available yet.' });
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await getFunction(FUNCTIONS.SCORE_RIASEC, {
      action: 'questions',
    });
    if (err) setError(err);
    else {
      setQuestions(data?.questions ?? []);
      setScale(data?.scale ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  return { questions, scale, loading, error, reload: load };
}

/** The student's stored result, read straight from `riasec_results` under RLS. */
export function useRiasecResult() {
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!config.isConfigured || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('riasec_results')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (err) throw err;
      setResult(data ?? null);
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { result, loading, error, reload: load };
}

/** Per-letter interpretation blocks for a Holland Code (§7.5). */
export function useInterpretation(code) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(Boolean(code));

  useEffect(() => {
    let alive = true;
    if (!code || !config.isConfigured) {
      setLoading(false);
      return () => {};
    }
    setLoading(true);
    getFunction(FUNCTIONS.SCORE_RIASEC, { action: 'interpretation', code }).then(({ data }) => {
      if (!alive) return;
      setBlocks(data?.blocks ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [code]);

  return { blocks, loading };
}

/**
 * Submit a complete response set. Validation, scoring, the Holland Code and
 * persistence all happen inside the Edge Function.
 * @param {{ question_id: number, value: number }[]} responses
 */
export async function submitAssessment(responses) {
  return invokeFunction(FUNCTIONS.SCORE_RIASEC, { responses });
}

/** Convert stored column names back into the six dimension scores. */
export function resultToScores(result) {
  if (!result) return null;
  return {
    R: result.realistic_score,
    I: result.investigative_score,
    A: result.artistic_score,
    S: result.social_score,
    E: result.enterprising_score,
    C: result.conventional_score,
  };
}
