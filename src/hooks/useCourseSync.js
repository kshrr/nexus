import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { FUNCTIONS, invokeFunction, normaliseError } from '@/lib/api';
import { reconcileCourseRequests, COURSE_LEASE_MS } from '@/lib/courseSyncStatus';

export function useCourseSync({ source = 'um', outcome = 'all', page = 1, pageSize = 20 } = {}) {
  const [catalogue, setCatalogue] = useState({ items: [], total: 0 });
  const [sourceChoices, setSourceChoices] = useState([]);
  const [runsBySource, setRuns] = useState({});
  const [requestsBySource, setRequestsState] = useState({});
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const alive = useRef(true),
    generation = useRef(0),
    flight = useRef(null),
    requests = useRef({});
  const setRequests = useCallback((value) => {
    requests.current = value;
    setRequestsState(value);
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current += 1;
    };
  }, []);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    if (!config.isConfigured) {
      setLoading(false);
      setError({ message: 'University course sync is not configured yet.' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ids = Object.values(requests.current)
        .map((request) => request.request_id)
        .filter(Boolean);
      const [records, runs, registry] = await Promise.all([
        supabase.rpc('list_course_sources', {
          p_outcome: outcome,
          p_page: page,
          p_page_size: pageSize,
          p_source: source,
        }),
        supabase.rpc('list_course_sync_runs', { p_request_ids: ids }),
        supabase.from('course_source_registry').select('source,name,levels').order('source'),
      ]);
      for (const response of [records, runs, registry]) if (response.error) throw response.error;
      if (!alive.current || current !== generation.current) return;
      setCatalogue(records.data ?? { items: [], total: 0 });
      setSourceChoices(registry.data ?? []);
      const latest = Object.fromEntries((runs.data?.latest ?? []).map((run) => [run.source, run]));
      const correlated = runs.data?.correlated ?? [];
      for (const run of correlated)
        if (requests.current[run.source]?.request_id === run.request_id) latest[run.source] = run;
      setRuns(latest);
      const unresolved = Object.fromEntries(
        Object.entries(requests.current).filter(([, request]) => !request.error)
      );
      const failed = Object.fromEntries(
        Object.entries(requests.current).filter(([, request]) => request.error)
      );
      setRequests({ ...failed, ...reconcileCourseRequests(unresolved, correlated, Date.now()) });
    } catch (caught) {
      if (alive.current && current === generation.current) {
        setError(normaliseError(caught));
        setRequests(reconcileCourseRequests(requests.current, [], Date.now()));
      }
    } finally {
      if (alive.current && current === generation.current) setLoading(false);
    }
  }, [source, outcome, page, pageSize, setRequests]);
  useEffect(() => {
    reload();
    return () => {
      generation.current += 1;
    };
  }, [reload]);
  const polling =
    Object.values(requestsBySource).some(
      (request) => !request.error && request.status !== 'expired'
    ) ||
    Object.values(runsBySource).some(
      (run) => run.status === 'running' && Date.now() - Date.parse(run.started_at) < COURSE_LEASE_MS
    );
  useEffect(() => {
    if (!polling) return undefined;
    const timer = window.setInterval(reload, 10000);
    return () => window.clearInterval(timer);
  }, [polling, reload]);
  const mutate = useCallback((operation) => {
    if (flight.current) return flight.current;
    const promise = Promise.resolve().then(async () => {
      if (alive.current) setBusy(true);
      try {
        return await operation();
      } catch (caught) {
        return { data: null, error: normaliseError(caught) };
      } finally {
        flight.current = null;
        if (alive.current) setBusy(false);
      }
    });
    flight.current = promise;
    return promise;
  }, []);
  const refresh = useCallback(
    (selected = source) =>
      mutate(async () => {
        const result = await invokeFunction(FUNCTIONS.TRIGGER_COURSE_CRAWL, { source: selected });
        if (!result.error && alive.current) {
          const next = { ...requests.current };
          for (const request of result.data?.requests ?? [result.data]) {
            if (!request?.source) continue;
            const previous = next[request.source];
            const pending = previous?.request_id && !previous.error &&
              previous.status !== 'expired' &&
              Date.now() - Date.parse(previous.requested_at) < COURSE_LEASE_MS;
            next[request.source] = request.dispatched
              ? request
              : pending
                ? { ...previous, last_dispatch_error: request.error }
                : { ...request, status: 'failed' };
          }
          setRequests(next);
        }
        return result;
      }),
    [source, mutate, setRequests]
  );
  const setSyncMode = useCallback(
    (id, mode) =>
      mutate(async () => {
        const response = await supabase.rpc('set_course_sync_mode', {
          p_course_id: id,
          p_mode: mode,
        });
        if (response.error) throw response.error;
        if (alive.current) await reload();
        return { data: response.data, error: null };
      }),
    [mutate, reload]
  );
  return {
    ...catalogue,
    sourceChoices,
    runsBySource,
    requestsBySource,
    lastRun: runsBySource[source] ?? null,
    queuedRequest: requestsBySource[source]?.error ? null : (requestsBySource[source] ?? null),
    loading,
    error,
    busy,
    reload,
    refresh,
    setSyncMode,
  };
}
