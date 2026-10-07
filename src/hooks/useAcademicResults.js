import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { normaliseError } from '@/lib/api';
import { useAuth } from '@/context/useAuth';

/**
 * The signed-in student's own `academic_results`, shaped for <GradeEntryTable>.
 * RLS guarantees only the caller's rows are ever returned (§4.4).
 *
 * @returns {{
 *   selectedCodes: string[],
 *   grades: Record<string, Record<string, string>>,
 *   loading: boolean,
 *   error: import('@/lib/api').ApiError | null,
 *   reload: () => Promise<void>,
 * }}
 */
export function useAcademicResults() {
  const { user } = useAuth();
  const [selectedCodes, setSelectedCodes] = useState(/** @type {string[]} */ ([]));
  const [grades, setGrades] = useState(/** @type {Record<string, Record<string, string>>} */ ({}));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {import('@/lib/api').ApiError | null} */ (null));

  const load = useCallback(async () => {
    if (!config.isConfigured || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('academic_results')
        .select('subject_code, exam_type, grade')
        .eq('user_id', user.id);
      if (err) throw err;
      const codes = [];
      const map = {};
      for (const row of data ?? []) {
        if (!codes.includes(row.subject_code)) codes.push(row.subject_code);
        map[row.subject_code] = { ...map[row.subject_code], [row.exam_type]: row.grade };
      }
      setSelectedCodes(codes);
      setGrades(map);
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { selectedCodes, grades, loading, error, reload: load, setSelectedCodes, setGrades };
}

export default useAcademicResults;
