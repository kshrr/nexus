import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { normaliseError } from '@/lib/api';

/**
 * Data management for the reference catalog (FR-ADMIN-03, architecture.md §13.1:
 * "CRUD courses, universities, careers").
 *
 * Authorisation is NOT enforced here. Every one of these tables carries a
 * public SELECT policy and `is_admin()` INSERT/UPDATE/DELETE policies (§4.5),
 * so a student reaching this code would have each write rejected by PostgreSQL.
 * Migration 0010 also appends an `audit_log` row for every write (FR-SEC-09).
 *
 * The recommendation rule base and the RIASEC question bank are deliberately
 * NOT editable here: §3.3.2C keeps them in server-side config precisely so they
 * cannot be inspected or manipulated, and requirements.md §18 lists a rule-base
 * editor under SHOULD NOT.
 */

const SELECT = {
  universities: 'id, name, type, state, is_active',
  courses:
    'id, name, field_of_study, university_id, pathway_type, duration_months, entry_requirements, required_subject_codes, is_active, universities(name)',
  careers:
    'id, name, slug, field, description, responsibilities, required_skills, useful_subjects, education_routes, riasec_profile, is_active',
};

const ORDER = { universities: 'name', courses: 'name', careers: 'name' };

/**
 * @param {'universities' | 'courses' | 'careers'} table
 * @param {{ search?: string }} [options]
 */
export function useAdminCatalog(table, { search = '' } = {}) {
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
      let q = supabase.from(table).select(SELECT[table]).order(ORDER[table]).limit(300);
      if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
      const { data, error: err } = await q;
      if (err) throw err;
      setItems(data ?? []);
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, [table, search]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (payload) => {
      try {
        const { error: err } = await supabase.from(table).insert(payload);
        if (err) throw err;
        await load();
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      }
    },
    [table, load]
  );

  const update = useCallback(
    async (id, payload) => {
      try {
        const { error: err } = await supabase.from(table).update(payload).eq('id', id);
        if (err) throw err;
        await load();
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      }
    },
    [table, load]
  );

  /**
   * Deactivate rather than delete. A course or career may already be referenced
   * by a stored recommendation, and `recommendations.target_id` is polymorphic
   * so no foreign key protects it (§3.5) — a hard delete would leave a student
   * looking at a card whose subject no longer exists.
   */
  const deactivate = useCallback((id) => update(id, { is_active: false }), [update]);
  const reactivate = useCallback((id) => update(id, { is_active: true }), [update]);

  return { items, loading, error, reload: load, create, update, deactivate, reactivate };
}

export default useAdminCatalog;
