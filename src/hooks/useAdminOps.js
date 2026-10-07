import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { invokeFunction, normaliseError } from '@/lib/api';

/**
 * Operational data for the admin area (FR14, architecture.md §13.1).
 *
 * Everything here is reference or operational data. Nothing touches student
 * records: §13.1 grants administrators no access to profiles, RIASEC results,
 * academic results, recommendations or chat messages, and the RLS policies in
 * §4.4 enforce that regardless of what this code asks for.
 */

/** The four operational facts on the admin home (ui-spec §10.1). */
export function useAdminOverview() {
  const [stats, setStats] = useState(null);
  const [recentAudit, setRecentAudit] = useState([]);
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
      const [
        lastRun,
        active,
        flagged,
        expired,
        archived,
        courses,
        universities,
        careers,
        audit,
        crawlHistory,
      ] = await Promise.all([
        supabase
          .from('crawl_logs')
          .select('*')
          .order('started_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('scholarships')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('scholarships')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'flagged'),
        supabase
          .from('scholarships')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'expired'),
        supabase
          .from('scholarships')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'archived'),
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase
          .from('universities')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        supabase.from('careers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(8),
        supabase
          .from('crawl_logs')
          .select('*')
          .order('started_at', { ascending: false, nullsFirst: false })
          .limit(8),
      ]);

      const requests = [
        lastRun,
        active,
        flagged,
        expired,
        archived,
        courses,
        universities,
        careers,
        audit,
        crawlHistory,
      ];
      const failed = requests.find((request) => request.error);
      if (failed) throw failed.error;

      setStats({
        lastRun: lastRun.data ?? null,
        activeScholarships: active.count ?? 0,
        flaggedScholarships: flagged.count ?? 0,
        expiredScholarships: expired.count ?? 0,
        archivedScholarships: archived.count ?? 0,
        activeCourses: courses.count ?? 0,
        activeUniversities: universities.count ?? 0,
        activeCareers: careers.count ?? 0,
        crawlHistory: crawlHistory.data ?? [],
      });
      setRecentAudit(audit.data ?? []);
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, recentAudit, loading, error, reload: load };
}

/**
 * Crawler run history (FR-ADMIN-04: "updates, execution times and source
 * errors"). Readable by admins only — `crawl_logs` has an is_admin() SELECT
 * policy and no INSERT policy at all, so only the crawler's service role can
 * write to it (§4.6).
 */
export function useCrawlLogs(limit = 50) {
  const [logs, setLogs] = useState([]);
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
      const { data, error: err } = await supabase
        .from('crawl_logs')
        .select('*')
        .order('started_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (err) throw err;
      setLogs(data ?? []);
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { logs, loading, error, reload: load };
}

/**
 * The audit trail (NFR09 / FR-SEC-09). Append-only: there is no UPDATE or
 * DELETE policy on the table and the privileges are revoked, so this hook is
 * read-only by construction — there is deliberately no delete action anywhere
 * in the admin UI (ui-spec §10.5).
 */
export function useAuditLog({ action = 'all', limit = 100 } = {}) {
  const [entries, setEntries] = useState([]);
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
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (action !== 'all') q = q.like('action', `${action}%`);
      const { data, error: err } = await q;
      if (err) throw err;
      setEntries(data ?? []);
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, [action, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { entries, loading, error, reload: load };
}

/**
 * Trigger a crawler run out of schedule (FR-ADMIN-05, ui-spec §10.4).
 *
 * The browser never starts the scraper itself — it asks `fn:trigger-crawl`,
 * which checks `is_admin()` server-side and dispatches the GitHub Actions
 * workflow that runs the Python job. A run started here is recorded in
 * `crawl_logs` by the job within a minute or two, so the caller polls
 * `crawl_logs` afterwards rather than expecting an immediate row.
 *
 * `pending` is a local, best-effort indicator only. Whether a run is genuinely
 * in progress is decided by `crawl_logs.status = 'running'`, which
 * `useCrawlLogs` / `useAdminOverview` read.
 */
export function useTriggerCrawl() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const trigger = useCallback(async (mode = 'combined') => {
    setPending(true);
    setResult(null);
    setError(null);
    const { data, error: err } = await invokeFunction('trigger-crawl', { mode });
    setPending(false);
    if (err) {
      setError(err);
      return { error: err };
    }
    setResult(data);
    return { data };
  }, []);

  return { trigger, pending, result, error, reset: () => setError(null) };
}

/**
 * Whether a crawler run is currently in progress, from `crawl_logs`. Used to
 * disable the trigger button and show a live indicator. A run older than the
 * 30-minute stale window (migration 0012) is treated as finished.
 */
export function useCrawlRunning(pollMs = 15000) {
  const [running, setRunning] = useState(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!config.isConfigured) {
      setLoading(false);
      return;
    }
    try {
      const staleCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error: err } = await supabase
        .from('crawl_logs')
        .select('id, started_at, triggered_by, mode, request_id')
        .eq('status', 'running')
        .gt('started_at', staleCutoff)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (err) throw err;
      setRunning(data ?? null);
    } catch {
      setRunning(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    if (!pollMs) return undefined;
    const id = setInterval(check, pollMs);
    return () => clearInterval(id);
  }, [check, pollMs]);

  return { running, loading, refresh: check };
}

/**
 * Records needing a human decision (FR-ADMIN-06).
 *
 * `flagged` is set by the crawler's sanitiser when ingested text trips the
 * suspicion threshold (§10.4). Flagging rather than silently discarding is
 * deliberate: a dropped record hides an attack, a flagged one produces evidence.
 */
export function useFlaggedRecords() {
  const [records, setRecords] = useState([]);
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
      const { data, error: err } = await supabase
        .from('scholarships')
        .select('*')
        .eq('status', 'flagged')
        .order('last_scraped_at', { ascending: false, nullsFirst: false });
      if (err) throw err;
      setRecords(data ?? []);
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = useCallback(
    async (id, status) => {
      try {
        const { error: err } = await supabase.from('scholarships').update({ status }).eq('id', id);
        if (err) throw err;
        await load();
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      }
    },
    [load]
  );

  return {
    records,
    loading,
    error,
    reload: load,
    approve: (id) => setStatus(id, 'active'),
    archive: (id) => setStatus(id, 'archived'),
  };
}
