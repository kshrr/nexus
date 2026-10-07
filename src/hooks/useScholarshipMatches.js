import { useCallback, useEffect, useState } from 'react';
import { FUNCTIONS, invokeFunction } from '@/lib/api';
import { useAuth } from '@/context/useAuth';

/**
 * Eligibility matching (FR10, architecture.md §10.5).
 *
 * Runs in `fn:match-scholarship` under the caller's JWT. The evaluation rules
 * are business logic and stay server-side (§3.3.2C); the browser only ever
 * receives the resulting checklist.
 *
 * Anonymous visitors get nothing — matching needs a profile, which is why
 * browsing is public but the checklist is gated (Conflict C-09 resolution).
 *
 * @param {{ scholarshipIds?: string[], enabled?: boolean }} options
 */
export function useScholarshipMatches({ scholarshipIds, enabled = true } = {}) {
  const { isAuthenticated } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const key = JSON.stringify(scholarshipIds ?? null);

  const load = useCallback(async () => {
    if (!enabled || !isAuthenticated) {
      setMatches([]);
      return;
    }
    setLoading(true);
    setError(null);
    const body = scholarshipIds?.length ? { scholarship_ids: scholarshipIds } : {};
    const { data, error: err } = await invokeFunction(FUNCTIONS.MATCH_SCHOLARSHIP, body);
    if (err) setError(err);
    else setMatches(data?.matches ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isAuthenticated, key]);

  useEffect(() => {
    load();
  }, [load]);

  /** @returns {import('@/lib/api').ApiError | null} */
  const byId = useCallback((id) => matches.find((m) => m.scholarship_id === id) ?? null, [matches]);

  return { matches, byId, loading, error, reload: load };
}

export default useScholarshipMatches;
