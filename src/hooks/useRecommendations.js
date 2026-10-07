import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { FUNCTIONS, invokeFunction, normaliseError } from '@/lib/api';
import { useAuth } from '@/context/useAuth';

/**
 * Recommendations (FR07, FR08).
 *
 * On mount the cached `recommendations` rows are read directly under RLS
 * (ui-spec §3.9). "Regenerate" calls `fn:recommend`, where the rule base lives.
 * The rule base is never shipped to the browser (AC-26) and no model is
 * involved at any point — the engine is deterministic and knowledge-based.
 *
 * `target_id` is polymorphic (careers.id | courses.id) and therefore carries no
 * foreign key, so the catalog rows are fetched in a second pass and joined here.
 */
export function useRecommendations() {
  const { user } = useAuth();
  const [careers, setCareers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [secondaryCareers, setSecondaryCareers] = useState([]);
  const [degradedMode, setDegradedMode] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const loadCached = useCallback(async () => {
    if (!config.isConfigured || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: err } = await supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', user.id)
        .order('rank', { ascending: true });
      if (err) throw err;

      if (!rows?.length) {
        setCareers([]);
        setCourses([]);
        setSecondaryCareers([]);
        setGeneratedAt(null);
        return;
      }

      const careerIds = rows.filter((r) => r.rec_type === 'career').map((r) => r.target_id);
      const courseIds = rows.filter((r) => r.rec_type === 'course').map((r) => r.target_id);

      const [careerRes, courseRes] = await Promise.all([
        careerIds.length
          ? supabase
              .from('careers')
              .select('id, name, slug, field, description, riasec_profile')
              .in('id', careerIds)
          : Promise.resolve({ data: [], error: null }),
        courseIds.length
          ? supabase
              .from('courses')
              .select(
                'id, name, field_of_study, pathway_type, duration_months, entry_requirements, universities(name)'
              )
              .in('id', courseIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (careerRes.error) throw careerRes.error;
      if (courseRes.error) throw courseRes.error;

      const careerById = new Map((careerRes.data ?? []).map((c) => [c.id, c]));
      const courseById = new Map(
        (courseRes.data ?? []).map((c) => [
          c.id,
          { ...c, university_name: c.universities?.name ?? null },
        ])
      );

      const attach = (row, lookup) => ({ ...row, detail: lookup.get(row.target_id) ?? null });

      setCareers(rows.filter((r) => r.rec_type === 'career').map((r) => attach(r, careerById)));
      setCourses(rows.filter((r) => r.rec_type === 'course').map((r) => attach(r, courseById)));
      setDegradedMode(Boolean(rows[0]?.degraded_mode));
      setGeneratedAt(rows[0]?.generated_at ?? null);
      setSecondaryCareers([]); // only returned by a live generate
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCached();
  }, [loadCached]);

  const regenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    const { data, error: err } = await invokeFunction(FUNCTIONS.RECOMMEND, {});
    setGenerating(false);
    if (err) {
      setError(err);
      return { error: err };
    }
    setCareers(data?.careers ?? []);
    setCourses(data?.courses ?? []);
    setSecondaryCareers(data?.secondary_careers ?? []);
    setDegradedMode(Boolean(data?.degraded_mode));
    setGeneratedAt(data?.generated_at ?? null);
    return { error: null };
  }, []);

  return {
    careers,
    courses,
    secondaryCareers,
    degradedMode,
    generatedAt,
    loading,
    generating,
    error,
    regenerate,
    reload: loadCached,
    hasResults: careers.length > 0 || courses.length > 0,
  };
}

export default useRecommendations;
