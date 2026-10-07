import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { normaliseError } from '@/lib/api';

/**
 * Reference subject list (`public.subjects`, public-read RLS).
 * @returns {{ subjects: { code: string, name: string, domain: string }[], loading: boolean, error: import('@/lib/api').ApiError | null }}
 */
export function useSubjects() {
  const [subjects, setSubjects] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {import('@/lib/api').ApiError | null} */ (null));

  useEffect(() => {
    let alive = true;
    if (!config.isConfigured) {
      setLoading(false);
      return () => {};
    }
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('subjects')
          .select('code, name, domain')
          .order('name');
        if (err) throw err;
        if (alive) setSubjects(data ?? []);
      } catch (err) {
        if (alive) setError(normaliseError(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { subjects, loading, error };
}

export default useSubjects;
