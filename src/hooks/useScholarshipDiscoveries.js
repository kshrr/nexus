import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { normaliseError } from '@/lib/api';

const messages = {
  STALE_REVIEW: 'This candidate changed. Reload its details before saving.',
  NOT_READY: 'Review the missing details before adding this scholarship.',
  INVALID_SOURCE: 'Confirm a valid official HTTPS source.',
  INVALID_SETTINGS: 'Check the queries and discovery limits.',
  FORBIDDEN: 'An administrator account is required.',
};
function discoveryError(error) {
  const result = normaliseError(error);
  const code = Object.keys(messages).find((name) => result.message.includes(name));
  return code ? { code, message: messages[code] } : result;
}
function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}

export function useScholarshipDiscoveries({
  tab = 'discover',
  search = '',
  provider = '',
  reviewState = 'all',
  page = 1,
  pageSize = 20,
} = {}) {
  const [catalogue, setCatalogue] = useState({ items: [], total: 0, providers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const alive = useAlive();
  const flights = useRef(new Map());
  const reloadRef = useRef();
  const load = useCallback(async () => {
    const current = ++generation.current;
    if (!config.isConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await supabase.rpc('list_scholarship_discoveries', {
        p_tab: tab,
        p_search: search.trim(),
        p_provider: provider,
        p_review_state: reviewState,
        p_page: page,
        p_page_size: pageSize,
      });
      if (response.error) throw response.error;
      if (alive.current && current === generation.current)
        setCatalogue(response.data ?? { items: [], total: 0, providers: [] });
    } catch (caught) {
      if (alive.current && current === generation.current) setError(discoveryError(caught));
    } finally {
      if (alive.current && current === generation.current) setLoading(false);
    }
  }, [tab, search, provider, reviewState, page, pageSize, alive]);
  reloadRef.current = load;
  useEffect(() => {
    load();
    return () => {
      generation.current += 1;
    };
  }, [load]);
  const mutate = useCallback(
    (name, args, key) => {
      if (flights.current.has(key)) return flights.current.get(key);
      const operation = Promise.resolve().then(async () => {
        if (alive.current) setBusy(true);
        try {
          const response = await supabase.rpc(name, args);
          if (response.error) throw response.error;
          if (alive.current) await reloadRef.current();
          return { data: response.data, error: null };
        } catch (caught) {
          return { data: null, error: discoveryError(caught) };
        } finally {
          flights.current.delete(key);
          if (alive.current) setBusy(flights.current.size > 0);
        }
      });
      flights.current.set(key, operation);
      return operation;
    },
    [alive]
  );
  return {
    ...catalogue,
    loading,
    error,
    busy,
    reload: load,
    getCandidate: async (id) => {
      try {
        const response = await supabase
          .from('scholarship_discoveries')
          .select('*')
          .eq('id', id)
          .single();
        if (response.error) throw response.error;
        let data = response.data;
        if (data.scholarship_id) {
          const publication = await supabase
            .from('scholarships')
            .select('is_manual,status')
            .eq('id', data.scholarship_id)
            .single();
          if (publication.error) throw publication.error;
          data = {
            ...data,
            is_manual: publication.data.is_manual,
            publication_status: publication.data.status,
          };
        }
        return { data, error: null };
      } catch (caught) {
        return { data: null, error: discoveryError(caught) };
      }
    },
    saveReview: (candidate, draft) =>
      mutate(
        'save_discovery_review',
        {
          p_id: candidate.id,
          p_revision: candidate.revision,
          p_record: draft.record,
          p_criteria: draft.criteria,
          p_official_source_confirmed: draft.officialSourceConfirmed,
          p_approved_application_url: draft.approvedApplicationUrl,
        },
        'review:' + candidate.id
      ),
    publish: (candidate) =>
      mutate(
        'publish_scholarship_discovery',
        { p_id: candidate.id, p_revision: candidate.revision },
        'publish:' + candidate.id
      ),
    approveChanges: (candidate) =>
      mutate(
        'approve_scholarship_discovery_changes',
        { p_id: candidate.id, p_revision: candidate.revision },
        'approve:' + candidate.id
      ),
    ignore: (id, ignored = true) =>
      mutate('set_discovery_ignored', { p_id: id, p_ignored: ignored }, 'ignore:' + id),
    setMonitoring: (id, enabled) =>
      mutate('set_discovery_monitoring', { p_id: id, p_enabled: enabled }, 'monitor:' + id),
    linkAlias: (id, duplicateId) =>
      mutate('link_discovery_alias', { p_id: id, p_duplicate_id: duplicateId }, 'alias:' + id),
  };
}

export function useScholarshipDiscoverySettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const alive = useAlive();
  const load = useCallback(async () => {
    if (!config.isConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await supabase.from('scholarship_discovery_settings').select('*').single();
      if (response.error) throw response.error;
      if (alive.current) setSettings(response.data);
    } catch (caught) {
      if (alive.current) setError(discoveryError(caught));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [alive]);
  useEffect(() => {
    load();
  }, [load]);
  const save = useCallback(
    async (payload) => {
      try {
        const response = await supabase.rpc('save_scholarship_discovery_settings', {
          p_settings: payload,
        });
        if (response.error) throw response.error;
        if (alive.current) {
          setSettings(response.data);
          setError(null);
        }
        return { data: response.data, error: null };
      } catch (caught) {
        const failure = discoveryError(caught);
        if (alive.current) setError(failure);
        return { data: null, error: failure };
      }
    },
    [alive]
  );
  return { settings, loading, error, save, reload: load };
}

export function discoveryRunState(request, run, now = Date.now()) {
  if (!request) return 'idle';
  if (!run || run.request_id !== request.request_id)
    return now - new Date(request.requested_at).getTime() >= 180000 ? 'delayed' : 'queued';
  return run.status;
}

export function useDiscoveryRunStatus(request, onFinished) {
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(Date.now());
  const alive = useAlive();
  const requestRef = useRef(request);
  const finishRef = useRef(onFinished);
  const notified = useRef(null);
  requestRef.current = request;
  finishRef.current = onFinished;
  const reload = useCallback(async () => {
    const current = requestRef.current;
    if (!current || !config.isConfigured) return;
    try {
      const response = await supabase
        .from('crawl_logs')
        .select('*')
        .eq('request_id', current.request_id)
        .maybeSingle();
      if (response.error) throw response.error;
      if (!alive.current || requestRef.current?.request_id !== current.request_id) return;
      setRun(response.data);
      setTick(Date.now());
      setError(null);
      if (
        response.data?.request_id === current.request_id &&
        ['success', 'partial', 'failed'].includes(response.data.status) &&
        notified.current !== current.request_id
      ) {
        notified.current = current.request_id;
        finishRef.current?.(response.data);
      }
    } catch (caught) {
      if (alive.current) setError(discoveryError(caught));
    }
  }, [alive]);
  const requestId = request?.request_id;
  const state = discoveryRunState(request, run, tick);
  useEffect(() => {
    setRun(null);
    setError(null);
    notified.current = null;
    if (requestId) reload();
  }, [requestId, reload]);
  useEffect(() => {
    if (!requestId || ['success', 'partial', 'failed'].includes(state)) return;
    const timer = setInterval(reload, 15000);
    return () => clearInterval(timer);
  }, [requestId, state, reload]);
  return { run, state, error, reload };
}
