import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, EmptyState } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/feedback';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useCrawlRunning, useFlaggedRecords, useTriggerCrawl } from '@/hooks/useAdminOps';
import { formatDate } from '@/lib/format';

/**
 * Manual updates (FR-ADMIN-05, FR-ADMIN-06).
 *
 * Two jobs an administrator does by hand:
 *   1. review records the crawler's sanitiser flagged as suspicious (§10.4)
 *   2. trigger a refresh out of schedule
 *
 * The review queue is the visible half of a security control. `sanitise.py`
 * flags rather than discards a record whose text trips the suspicion threshold,
 * because silently dropping it would hide an attack; this page is where a human
 * decides. That makes it worth a screenshot in the security chapter.
 */
export function AdminManualUpdates() {
  const { records, loading, error, reload, approve, archive } = useFlaggedRecords();
  const { trigger, pending, result, error: triggerError } = useTriggerCrawl();
  const { running, refresh: refreshRunning } = useCrawlRunning();
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function runCrawler() {
    const res = await trigger();
    // A fresh run shows up in crawl_logs shortly after; nudge the indicator.
    if (!res.error) setTimeout(refreshRunning, 4000);
  }

  async function act(id, fn) {
    setBusyId(id);
    setActionError(null);
    const res = await fn(id);
    if (res.error) setActionError(res.error);
    setBusyId(null);
  }

  return (
    <>
      <AdminPageHeader
        title="Manual updates"
        description="Review what the crawler flagged, and refresh data outside the weekly schedule."
      />

      {actionError && (
        <Alert variant="error" className="mb-4">
          {actionError.message}
        </Alert>
      )}

      {/* --- trigger a refresh ------------------------------------------ */}
      <Card variant="titled" title="Refresh scholarship data" className="mb-6">
        <p className="max-w-prose text-body-sm text-ink-700">
          A manual run dispatches the same weekly job that keeps scholarship records current. It
          skips any record marked as manually managed, so your corrections survive it. You can also
          correct records by hand in{' '}
          <Link to="/admin/scholarships" className="text-pine-700 underline">
            Scholarship management
          </Link>
          .
        </p>

        {running && (
          <Alert variant="info" className="mt-3">
            A run started {running.triggered_by === 'manual' ? 'manually' : 'on schedule'} is in
            progress. It will appear in{' '}
            <Link to="/admin/crawler" className="text-pine-700 underline">
              Crawler logs
            </Link>{' '}
            when it finishes.
          </Alert>
        )}

        {result && !running && (
          <Alert variant="success" className="mt-3">
            {result.run_hint ?? 'The run was started.'}
          </Alert>
        )}

        {triggerError && (
          <Alert variant="error" className="mt-3">
            {triggerError.message}
          </Alert>
        )}

        <Button
          className="mt-4 w-fit"
          onClick={runCrawler}
          disabled={pending || Boolean(running)}
        >
          {pending ? 'Starting…' : running ? 'Run in progress' : 'Run crawler now'}
        </Button>
      </Card>

      {/* --- flagged review queue --------------------------------------- */}
      <h2 className="mb-1 text-h2 font-serif">Flagged for review</h2>
      <p className="mb-3 max-w-prose text-body-sm text-ink-700">
        Records whose ingested text tripped the sanitiser. They are hidden from students until
        someone decides. Check the source page before approving anything.
      </p>

      {loading ? (
        <LoadingState rows={1} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : records.length === 0 ? (
        <EmptyState
          title="Nothing waiting"
          description="No scholarship record has been flagged. Anything the crawler finds suspicious will appear here rather than being published or silently dropped."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {records.map((record) => (
            <Card key={record.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-h3 font-sans">{record.name}</h3>
                    <Badge variant="warning">flagged</Badge>
                  </div>
                  <p className="mt-0.5 text-body-sm text-ink-500">{record.provider}</p>
                  {record.description && (
                    <p className="mt-2 max-w-prose whitespace-pre-line text-body-sm text-ink-700">
                      {record.description}
                    </p>
                  )}
                  <p className="mt-2 text-caption text-ink-500">
                    {record.source_url ? (
                      <a
                        href={record.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pine-700 underline"
                      >
                        Check the source page
                      </a>
                    ) : (
                      'No source URL recorded'
                    )}
                    {record.last_scraped_at && ` · scraped ${formatDate(record.last_scraped_at)}`}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === record.id}
                    onClick={() => act(record.id, approve)}
                  >
                    Publish
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busyId === record.id}
                    onClick={() => act(record.id, archive)}
                  >
                    Archive
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export default AdminManualUpdates;
