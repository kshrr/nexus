import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { normaliseError } from '@/lib/api';

/** Admin-only editor for the existing career_courses relationship table. */
export function useAdminCareerCourses(careerId) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(Boolean(careerId));

  const load = useCallback(async () => {
    if (!careerId) {
      setSelectedIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('career_courses')
      .select('course_id')
      .eq('career_id', careerId);
    setSelectedIds((data ?? []).map((row) => row.course_id));
    setLoading(false);
  }, [careerId]);

  useEffect(() => {
    load();
  }, [load]);

  const replace = useCallback(
    async (courseIds) => {
      if (!careerId) return { error: null };
      try {
        const { error: deleteError } = await supabase
          .from('career_courses')
          .delete()
          .eq('career_id', careerId);
        if (deleteError) throw deleteError;
        if (courseIds.length) {
          const { error: insertError } = await supabase
            .from('career_courses')
            .insert(courseIds.map((courseId) => ({ career_id: careerId, course_id: courseId })));
          if (insertError) throw insertError;
        }
        setSelectedIds(courseIds);
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      }
    },
    [careerId]
  );

  return { selectedIds, loading, replace };
}
