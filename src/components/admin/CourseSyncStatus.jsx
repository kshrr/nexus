import { Badge } from '@/components/ui';
import { COURSE_LEASE_MS } from '@/lib/courseSyncStatus';

export function CourseSyncStatus({ source, run, request }) {
  const running =
    run?.status === 'running' && Date.now() - Date.parse(run.started_at) < COURSE_LEASE_MS;
  const attention = run?.status === 'completed' &&
    ((run.incomplete ?? 0) > 0 || (run.fetch_failed ?? 0) > 0);
  const label =
    request?.status === 'expired'
      ? 'Queue timed out — retry available'
      : request?.error
        ? request.error.message
        : running
          ? 'Running'
          : request
            ? 'Refresh queued'
            : run?.status === 'running'
              ? 'Lease expired'
              : attention
                ? 'Completed with attention'
                : (run?.status ?? 'Not checked yet');
  return (
    <div className="rounded-input border border-ink-100 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{source.name}</strong>
        <Badge variant={attention ? 'warning' : run?.status === 'completed' && !request ? 'success' : 'info'}>
          {label}
        </Badge>
      </div>
      {request?.last_dispatch_error && (
        <p className="mt-2 text-body-sm text-rust-600">
          Latest refresh attempt: {request.last_dispatch_error.message}. The accepted refresh is still tracked.
        </p>
      )}
      {run && (
        <p className="mt-2 text-body-sm text-ink-600">
          {run.found ?? 0} found · {run.inserted ?? 0} added · {run.updated ?? 0} updated ·{' '}
          {run.incomplete ?? 0} need attention · {run.fetch_failed ?? 0} fetch failures
        </p>
      )}
      {run?.coverage_complete === false && run.status !== 'running' && (
        <p className="mt-2 text-body-sm text-rust-600">
          Source coverage is incomplete. Published courses are preserved.
        </p>
      )}
    </div>
  );
}
