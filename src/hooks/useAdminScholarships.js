import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { normaliseError } from '@/lib/api';

/**
 * Administrator scholarship management (FR14 / FR-ADMIN-02, architecture.md §10.7).
 *
 * Writes go direct to PostgREST. Authorisation is NOT enforced here — it is
 * enforced by the `is_admin()` RLS policies on `scholarships` and
 * `scholarship_criteria` (§4.5). A student who reached this code would simply
 * have every write rejected by the database.
 *
 * Two things happen automatically in PostgreSQL on each write (migration 0010):
 *   * `is_manual` is set, so the weekly crawler will not overwrite the record
 *   * an `audit_log` row is appended naming the actor (FR-SEC-09)
 */
export function useAdminScholarships({ search = '', status = 'all' } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!config.isConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from('scholarships')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);
      if (status !== 'all') q = q.eq('status', status);
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        q = q.or(`name.ilike.${term},provider.ilike.${term}`);
      }
      const { data, error: err } = await q;
      if (err) throw err;
      setItems(data ?? []);
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (payload) => {
      try {
        const { data, error: err } = await supabase
          .from('scholarships')
          .insert(payload)
          .select()
          .single();
        if (err) throw err;
        await load();
        return { data, error: null };
      } catch (err) {
        return { data: null, error: normaliseError(err) };
      }
    },
    [load]
  );

  const update = useCallback(
    async (id, payload) => {
      try {
        const { error: err } = await supabase.from('scholarships').update(payload).eq('id', id);
        if (err) throw err;
        await load();
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      }
    },
    [load]
  );

  /** Archive rather than delete — the record keeps its audit history. */
  const archive = useCallback((id) => update(id, { status: 'archived' }), [update]);

  return { items, loading, error, reload: load, create, update, archive };
}

/** Eligibility criteria for one scholarship (admin CRUD). */
export function useAdminCriteria(scholarshipId) {
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!config.isConfigured || !scholarshipId) {
      setCriteria([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('scholarship_criteria')
        .select('*')
        .eq('scholarship_id', scholarshipId)
        .order('id');
      if (err) throw err;
      setCriteria(data ?? []);
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, [scholarshipId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (payload) => {
      try {
        const { error: err } = await supabase
          .from('scholarship_criteria')
          .insert({ ...payload, scholarship_id: scholarshipId });
        if (err) throw err;
        await load();
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      }
    },
    [scholarshipId, load]
  );

  const update = useCallback(
    async (id, payload) => {
      try {
        const { error: err } = await supabase
          .from('scholarship_criteria')
          .update(payload)
          .eq('id', id);
        if (err) throw err;
        await load();
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      }
    },
    [load]
  );

  const remove = useCallback(
    async (id) => {
      try {
        const { error: err } = await supabase.from('scholarship_criteria').delete().eq('id', id);
        if (err) throw err;
        await load();
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      }
    },
    [load]
  );

  return { criteria, loading, error, reload: load, add, update, remove };
}
