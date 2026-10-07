import { Fragment, useState } from 'react';
import { Alert, Badge, Card, EmptyState } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/feedback';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useCrawlLogs, useCrawlRunning } from '@/hooks/useAdminOps';
import { formatDate } from '@/lib/format';

const STATUS_VARIANT = {
  success: 'success',
  partial: 'warning',
  failed: 'critical',
  running: 'info',
};

function duration(ms) {
  if (!ms && ms !== 0) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/**
 * Crawler run log (FR-ADMIN-04, ui-spec §10.4).
 *
 * One row per run recording what was touched, how long it took, the status and
 * any error — the fields §3.4.3 specifies. Failed and partial rows expand to
 * show the error message.
 *
 * Read-only: `crawl_logs` has an is_admin() SELECT policy and no INSERT policy,
 * so only the crawler's service role can write here (§4.6). Triggering a run is
 * a separate action and lives on Manual updates.
 */
export function AdminCrawler() {
  const { logs, loading, error, reload } = useCrawlLogs();
  const { running } = useCrawlRunning();
  const [expanded, setExpanded] = useState(null);

  return (
    <>
      <AdminPageHeader
        title="Crawler logs"
        description="Every scheduled and manual run, with what it touched and anything that failed."
      />

      {running && (
        <Alert variant="info" title="A run is in progress." className="mb-6">
          Started {formatDate(running.started_at)} ({running.triggered_by}). Its result will appear
          below when it finishes — refresh in a minute or two.
        </Alert>
      )}

      {loading ? (
        <LoadingState rows={2} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No runs recorded"
          description="Once the crawler runs, each pass appears here with its counts, duration and status."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-body-sm">
            <caption className="sr-only">Crawler run history</caption>
            <thead>
              <tr className="border-b border-ink-300 text-left text-caption text-ink-500">
                <th className="p-3">Started</th>
                <th className="p-3">Trigger</th>
                <th className="p-3">Mode</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Discovered</th>
                <th className="p-3 text-right">Monitored</th>
                <th className="p-3 text-right">Updated</th>
                <th className="p-3 text-right">Failed</th>
                <th className="p-3 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const open = expanded === log.id;
                const hasError = Boolean(log.error_message);
                return (
                  <Fragment key={log.id}>
                    <tr
                      className={`border-b border-ink-100 ${hasError ? 'cursor-pointer' : ''}`}
                      onClick={() => hasError && setExpanded(open ? null : log.id)}
                    >
                      <td className="p-3 tabular-nums text-ink-900">
                        {formatDate(log.started_at)}
                        {hasError && (
                          <span aria-hidden="true" className="ml-2 text-ink-500">
                            {open ? '▾' : '▸'}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-ink-700">{log.triggered_by}</td>
                      <td className="p-3 text-ink-700">{log.mode ?? 'Legacy scraper'}</td>
                      <td className="p-3">
                        <Badge variant={STATUS_VARIANT[log.status] ?? 'neutral'}>
                          {log.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right tabular-nums text-ink-700">
                        {log.candidates_created ?? log.records_inserted}
                      </td>
                      <td className="p-3 text-right tabular-nums text-ink-700">{log.monitored ?? '—'}</td>
                      <td className="p-3 text-right tabular-nums text-ink-700">
                        {log.records_updated}
                      </td>
                      <td className="p-3 text-right tabular-nums text-ink-700">
                        {log.records_failed}
                      </td>
                      <td className="p-3 text-right tabular-nums text-ink-500">
                        {duration(log.duration_ms)}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-ink-100 bg-rust-100">
                        <td colSpan={9} className="p-3 text-body-sm text-rust-600">
                          {log.error_message}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

export default AdminCrawler;
