import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { normaliseError } from '@/lib/api';
import { fetchCourseFacets, fetchCoursePage } from '@/lib/courseCatalogue';

const EMPTY_FACETS = {
  fields: [],
  states: [],
  universities: [],
  pathways: [],
  types: [],
  total: 0,
};

export function useCourses(filters) {
  const [result, setResult] = useState({ items: [], total: 0, loading: true, error: null });
  const [revision, setRevision] = useState(0);
  const typedSearch = filters.search ?? '';
  const key = JSON.stringify({ ...filters, search: undefined });
  const queryFilters = useMemo(() => JSON.parse(key), [key]);
  const [search, setSearch] = useState(typedSearch);
  const queryKey = key + '|' + search;
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typedSearch), 250);
    return () => clearTimeout(timer);
  }, [typedSearch]);
  useEffect(() => {
    const controller = new AbortController();
    if (!config.isConfigured) {
      setResult({
        items: [],
        total: 0,
        loading: false,
        error: { message: 'Course browsing is not configured yet.' },
        queryKey,
      });
      return undefined;
    }
    setResult((previous) => ({ ...previous, loading: true, error: null }));
    fetchCoursePage(supabase, { ...queryFilters, search }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ ...data, queryKey, loading: false, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            items: [],
            total: 0,
            queryKey,
            loading: false,
            error: normaliseError(error),
          });
      });
    return () => controller.abort();
  }, [queryFilters, search, queryKey, revision]);
  return {
    ...result,
    loading: result.loading || search !== typedSearch || result.queryKey !== queryKey,
    reload: () => setRevision((value) => value + 1),
  };
}

export function useCourseFacets() {
  const [result, setResult] = useState({ ...EMPTY_FACETS, loading: true, error: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!config.isConfigured) {
      setResult({
        ...EMPTY_FACETS,
        loading: false,
        error: { message: 'Course filters are not configured yet.' },
      });
      return undefined;
    }
    setResult((previous) => ({ ...previous, loading: true, error: null }));
    fetchCourseFacets(supabase, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ ...data, loading: false, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ ...EMPTY_FACETS, loading: false, error: normaliseError(error) });
      });
    return () => controller.abort();
  }, [revision]);
  return { ...result, reload: () => setRevision((value) => value + 1) };
}
