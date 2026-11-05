import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Icon, Select } from '@/components/ui';
import { useCourseSync } from '@/hooks/useCourseSync';
import { CourseSyncStatus } from './CourseSyncStatus';
import { safeRegisteredCourseSource } from '@/lib/courseCatalogue';

const labels = {
  published: 'Published automatically',
  unchanged: 'Up to date',
  protected_manual: 'Manual correction protected',
  incomplete: 'Needs attention',
  fetch_failed: 'Source unavailable',
};
const reasons = {
  missing_entry_requirements: 'Entry requirements were not found.',
  empty_requirement_section: 'An advertised applicant tab or entry route had no requirements.',
  missing_requirement_sections: 'Entry requirement routes were not found.',
  ambiguous_requirement_categories: 'Applicant categories could not be separated reliably.',
  unmapped_field: 'The programme field needs a catalogue mapping.',
  missing_degree_name: 'The degree name could not be identified.',
  conflicting_source_identity: 'Another source already manages this course.',
  ambiguous_programme_identity: 'More than one existing course could match this programme.',
  suspicious_source_text: 'Source text needs inspection.',
  overlong_source_record: 'The source record exceeded extraction limits.',
  unsupported_requirement_host:
    'The linked requirement document cannot be crawled automatically. Check the official university page.',
  unavailable_requirement_document:
    'The university requirement document could not be retrieved. Review the official source before publishing.',
  ambiguous_requirement_table:
    'The published requirement table needs a verified programme mapping.',
  historical_source_session: 'The requirements advertise an older academic session.',
  conflicting_source_session: 'The source contains conflicting academic session labels.',
};
const dateLabel = (value) =>
  value
    ? new Date(value).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not checked yet';
const sourceLink = safeRegisteredCourseSource;

export function CourseSyncPanel() {
  const id = useId();
  const [outcome, setOutcome] = useState('attention'),
    [source, setSource] = useState('um'),
    [page, setPage] = useState(1),
    [actionError, setActionError] = useState(null);
  const sync = useCourseSync({ source, outcome, page, pageSize: 20 });
  const running =
    sync.lastRun?.status === 'running' &&
    Date.now() - Date.parse(sync.lastRun.started_at) < 30 * 60 * 1000;
  const queued =
    sync.queuedRequest &&
    sync.queuedRequest.status !== 'expired' &&
    Date.now() - Date.parse(sync.queuedRequest.requested_at) < 30 * 60 * 1000;
  async function action(operation) {
    setActionError(null);
    const result = await operation();
    if (result.error) setActionError(result.error);
    else if (result.data?.requests?.some((request) => !request.dispatched))
      setActionError({
        message:
          'Some universities could not be queued. Accepted refreshes are still tracked below.',
      });
  }
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mb-8 rounded-card border border-ink-200 bg-paper p-5 md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="book" className="h-5 w-5 text-pine-700" />
            <h2 id={`${id}-title`} className="font-serif text-h2">
              University course sync
            </h2>
            <Badge variant="success">Automatic publication</Badge>
          </div>
          <p className="mt-2 max-w-2xl text-body-sm text-ink-500">
            Valid foundation, diploma and degree programmes publish automatically. Incomplete
            extractions and protected manual corrections appear here for attention.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            loading={sync.busy}
            disabled={Boolean(running || queued)}
            onClick={() => action(() => sync.refresh(source))}
          >
            Refresh selected university
          </Button>
          <Button
            variant="secondary"
            loading={sync.busy}
            onClick={() => action(() => sync.refresh('all'))}
          >
            Refresh all supported universities
          </Button>
          <Button variant="secondary" onClick={sync.reload} disabled={sync.loading}>
            Check status
          </Button>
        </div>
      </div>
      <div className="mt-4 max-w-md">
        <Select
          label="University"
          value={source}
          options={(sync.sourceChoices ?? []).map((university) => ({
            value: university.source,
            label: university.name,
          }))}
          onChange={(event) => {
            setSource(event.target.value);
            setPage(1);
          }}
        />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {(sync.sourceChoices ?? []).map((university) => (
          <CourseSyncStatus
            key={university.source}
            source={university}
            run={sync.runsBySource?.[university.source]}
            request={sync.requestsBySource?.[university.source]}
          />
        ))}
      </div>
      {actionError && (
        <Alert variant="error" className="mt-4">
          {actionError.message}
        </Alert>
      )}
      {sync.error && (
        <Alert variant="error" className="mt-4">
          {sync.error.message}
          <Button variant="link" onClick={sync.reload}>
            Try again
          </Button>
        </Alert>
      )}
      {sync.queuedRequest && (
        <div
          role="status"
          className="mt-4 rounded-input border border-pine-100 bg-pine-50 px-4 py-3 text-body-sm text-pine-900"
        >
          {queued
            ? 'Refresh queued. Waiting for its university crawl; status updates automatically.'
            : 'This queued refresh has not completed yet. Check its status or try a new request.'}
        </div>
      )}
      {!sync.loading && !sync.lastRun && !sync.error && (
        <p className="mt-5 text-body-sm text-ink-500">No university sync has run yet.</p>
      )}
      {sync.lastRun && (
        <div className="mt-5 rounded-input border border-ink-100 bg-surface p-4">
          <div className="flex flex-wrap justify-between gap-3">
            <span className="text-body-sm font-medium">
              Latest {source.toUpperCase()} sync{' '}
              <Badge
                variant={
                  sync.lastRun.status === 'completed'
                    ? 'success'
                    : sync.lastRun.status === 'running'
                      ? 'info'
                      : 'warning'
                }
              >
                {running
                  ? 'Running'
                  : sync.lastRun.status === 'running'
                    ? 'Lease expired'
                    : sync.lastRun.status}
              </Badge>
            </span>
            <span className="text-caption text-ink-500">
              {dateLabel(sync.lastRun.finished_at ?? sync.lastRun.started_at)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-body-sm">
            <span>{sync.lastRun.found ?? 0} programmes found</span>
            <span>{sync.lastRun.inserted ?? 0} added</span>
            <span>{sync.lastRun.updated ?? 0} updated</span>
            <span>{sync.lastRun.unchanged ?? 0} unchanged</span>
            <span>{sync.lastRun.incomplete ?? 0} incomplete</span>
            <span>{sync.lastRun.fetch_failed ?? 0} fetch failures</span>
            <span>{sync.lastRun.protected_manual ?? 0} manual records protected</span>
          </div>
          {sync.lastRun.errors?.length > 0 && (
            <details className="mt-3 text-body-sm">
              <summary className="cursor-pointer text-ink-700">Run details</summary>
              <ul className="mt-2 space-y-1 text-ink-500">
                {sync.lastRun.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <Select
          label="Source records"
          className="w-full sm:w-64"
          value={outcome}
          options={[
            { value: 'attention', label: 'Needs attention' },
            { value: 'all', label: 'All source records' },
            { value: 'published', label: 'Published automatically' },
            { value: 'unchanged', label: 'Up to date' },
            { value: 'protected_manual', label: 'Manual corrections' },
            { value: 'incomplete', label: 'Incomplete extraction' },
            { value: 'fetch_failed', label: 'Fetch failures' },
          ]}
          onChange={(event) => {
            setOutcome(event.target.value);
            setPage(1);
          }}
        />
        <span className="text-caption text-ink-500">{sync.total} source records</span>
      </div>
      {sync.loading ? (
        <p className="mt-4 text-body-sm text-ink-500">Loading course source records…</p>
      ) : !sync.error && sync.items.length === 0 ? (
        <p className="mt-4 text-body-sm text-ink-500">No source records in this view.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {sync.items.map((record) => (
            <Card key={record.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-body font-semibold">
                    {record.course_name || record.candidate?.name || record.programme_key}
                  </h3>
                  <p className="mt-1 text-caption text-ink-500">
                    Last successful source check: {dateLabel(record.last_success_at)}
                  </p>
                </div>
                <Badge
                  variant={
                    ['published', 'unchanged'].includes(record.outcome) ? 'success' : 'warning'
                  }
                >
                  {labels[record.outcome] ?? 'Needs attention'}
                </Badge>
              </div>
              {record.issues?.length > 0 && (
                <ul className="mt-3 space-y-1 text-body-sm text-ink-700">
                  {record.issues.map((issue, index) => (
                    <li key={index}>{reasons[issue] ?? issue.replaceAll('_', ' ')}</li>
                  ))}
                </ul>
              )}
              {record.last_error && (
                <p className="mt-3 break-words text-body-sm text-rust-600">{record.last_error}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {sourceLink(record.canonical_url) && (
                  <a
                    className="inline-flex min-h-11 items-center gap-1 text-body-sm text-pine-700 hover:underline"
                    href={record.canonical_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Official source
                    <Icon name="arrowUpRight" className="h-4 w-4" />
                  </a>
                )}
                {record.course_id && (
                  <Link
                    className="inline-flex min-h-11 items-center text-body-sm text-pine-700 hover:underline"
                    to={`/courses/${record.course_id}`}
                  >
                    View course
                  </Link>
                )}
                {record.course_id &&
                  (record.sync_mode === 'automatic' || record.last_success_at) && (
                    <Button
                      variant="tertiary"
                      disabled={sync.busy}
                      onClick={() =>
                        action(() =>
                          sync.setSyncMode(
                            record.course_id,
                            record.sync_mode === 'automatic' ? 'manual' : 'automatic'
                          )
                        )
                      }
                    >
                      {record.sync_mode === 'automatic'
                        ? 'Pause automatic updates'
                        : 'Resume automatic updates'}
                    </Button>
                  )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-end gap-3">
        <Button
          variant="secondary"
          size="sm"
          disabled={page === 1 || sync.loading}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </Button>
        <span className="text-caption text-ink-500">Page {page}</span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page * 20 >= sync.total || sync.loading}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </Button>
      </div>
    </section>
  );
}
