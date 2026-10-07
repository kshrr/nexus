import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { normaliseError } from '@/lib/api';

export const PAGE_SIZE = 20;

/**
 * Scholarship browsing (FR09, architecture.md §10.1).
 *
 * A direct PostgREST query under public-read RLS — no Edge Function is needed
 * because nothing here is business logic (§1.2). Anonymous visitors get the
 * same list; only the eligibility matching requires a session.
 *
 * Filters are exactly the three FR09 names: field of study, provider and
 * education level. "Budget" (§1.5.2) and "scholarship type" (Figure 4.4) are
 * deliberately absent — there are no such columns and no requirement for them
 * (D-26).
 *
 * @param {{ search?: string, fields?: string[], providers?: string[], levels?: string[],
 *   includeExpired?: boolean }} filters
 */
export function useScholarships(filters) {
  const { search = '', fields = [], providers = [], levels = [], includeExpired = false } = filters;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  // Stable dependency for the effect without re-running on every render.
  const key = JSON.stringify({ search, fields, providers, levels, includeExpired });

  const buildQuery = useCallback(
    (from, to) => {
      let q = supabase
        .from('scholarships')
        .select(
          'id, name, provider, description, funding_amount, field_of_study, education_levels, deadline, status, application_link, updated_at',
          { count: 'exact' }
        );

      // Expired records drop out of the default list but stay reachable by
      // direct link (§10.2). Flagged/archived records are never browsable.
      q = includeExpired ? q.in('status', ['active', 'expired']) : q.eq('status', 'active');

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        q = q.or(`name.ilike.${term},provider.ilike.${term}`);
      }
      if (fields.length) q = q.overlaps('field_of_study', fields);
      if (levels.length) q = q.overlaps('education_levels', levels);
      if (providers.length) q = q.in('provider', providers);

      // Soonest deadline first; rolling intakes (null) last.
      return q.order('deadline', { ascending: true, nullsFirst: false }).range(from, to);
    },
    [search, fields, providers, levels, includeExpired]
  );

  const load = useCallback(
    async (nextPage = 0, append = false) => {
      if (!config.isConfigured) {
        setLoading(false);
        return;
      }
      append ? setLoadingMore(true) : setLoading(true);
      setError(null);
      try {
        const from = nextPage * PAGE_SIZE;
        const { data, error: err, count } = await buildQuery(from, from + PAGE_SIZE - 1);
        if (err) throw err;
        setTotal(count ?? 0);
        setItems((prev) => (append ? [...prev, ...(data ?? [])] : (data ?? [])));
        setPage(nextPage);
      } catch (err) {
        setError(normaliseError(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    load(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const hasMore = items.length < total;

  return {
    items,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore: () => load(page + 1, true),
    reload: () => load(0, false),
  };
}

/**
 * The distinct provider / field / level values present in the data, used to
 * populate the filter panel. Derived from the records themselves so the panel
 * never offers a filter that returns nothing.
 */
export function useScholarshipFacets() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!config.isConfigured) {
      setLoading(false);
      return () => {};
    }
    (async () => {
      const { data } = await supabase
        .from('scholarships')
        .select('provider, field_of_study, education_levels')
        .eq('status', 'active');
      if (!alive) return;
      setRows(data ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return useMemo(() => {
    const providers = new Set();
    const fields = new Set();
    const levels = new Set();
    for (const row of rows) {
      if (row.provider) providers.add(row.provider);
      for (const f of row.field_of_study ?? []) fields.add(f);
      for (const l of row.education_levels ?? []) levels.add(l);
    }
    const sorted = (s) => [...s].sort((a, b) => a.localeCompare(b));
    return {
      providers: sorted(providers),
      fields: sorted(fields),
      levels: sorted(levels),
      loading,
    };
  }, [rows, loading]);
}

/** One scholarship plus its eligibility criteria (public read). */
export function useScholarship(id) {
  const [scholarship, setScholarship] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!config.isConfigured || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [sRes, cRes] = await Promise.all([
        supabase.from('scholarships').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('scholarship_criteria')
          .select('id, criterion_type, operator, value, label, is_checkable')
          .eq('scholarship_id', id)
          .order('id'),
      ]);
      if (sRes.error) throw sRes.error;
      if (cRes.error) throw cRes.error;
      setScholarship(sRes.data ?? null);
      setCriteria(cRes.data ?? []);
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { scholarship, criteria, loading, error, reload: load };
}
