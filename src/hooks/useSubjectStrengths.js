import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { normaliseError } from '@/lib/api';
import { useAuth } from '@/context/useAuth';

/**
 * The student's own `subject_strengths`, joined to `subjects` for display names
 * and domains (FR-ACAD-04). RLS confines the rows to the caller (§4.4).
 *
 * The classification itself is computed in PostgreSQL by
 * `compute_subject_strengths()`, so there is exactly one definition of the rule
 * (architecture.md §8.1). Nothing is classified here.
 */
export function useSubjectStrengths() {
  const { user } = useAuth();
  const [strengths, setStrengths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!config.isConfigured || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('subject_strengths')
        .select('subject_code, strength, average_points, exam_count, subjects(name, domain)')
        .eq('user_id', user.id);
      if (err) throw err;
      setStrengths(
        (data ?? [])
          .map((row) => ({
            subjectCode: row.subject_code,
            name: row.subjects?.name ?? row.subject_code,
            domain: row.subjects?.domain ?? null,
            strength: row.strength,
            averagePoints: Number(row.average_points),
            examCount: row.exam_count,
          }))
          .sort((a, b) => b.averagePoints - a.averagePoints || a.name.localeCompare(b.name))
      );
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { strengths, loading, error, reload: load };
}

export default useSubjectStrengths;
