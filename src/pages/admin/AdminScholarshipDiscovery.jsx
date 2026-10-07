import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input, Select, Button } from '@/components/ui';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ScholarshipDiscoveryReview } from '@/components/admin/ScholarshipDiscoveryReview';
import { ScholarshipDiscoverySettings } from '@/components/admin/ScholarshipDiscoverySettings';
import { OfficialSourceLink } from '@/components/admin/DiscoveryDialog';
import {
  useScholarshipDiscoveries,
  useScholarshipDiscoverySettings,
  useDiscoveryRunStatus,
} from '@/hooks/useScholarshipDiscoveries';
import { useTriggerCrawl, useCrawlRunning } from '@/hooks/useAdminOps';
import { formatDate, pluralise } from '@/lib/format';

export default function AdminScholarshipDiscovery() {
  const [tab, setTab] = useState('discover');
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('');
  const [reviewState, setReviewState] = useState('all');
  const [page, setPage] = useState(1);
  const [review, setReview] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const catalogue = useScholarshipDiscoveries({ tab, search, provider, reviewState, page });
  const settings = useScholarshipDiscoverySettings();
  const trigger = useTriggerCrawl();
  const { running } = useCrawlRunning();
  const refreshStatus = useDiscoveryRunStatus(trigger.result, () => catalogue.reload());
  const waiting = ['queued', 'delayed', 'running'].includes(refreshStatus.state);
  const filter = (setter, value) => {
    setter(value);
    setPage(1);
  };
  async function publish(candidate) {
    setActionError('');
    const result = await catalogue.publish(candidate);
    if (result.error) setActionError(result.error.message);
    else {
      setMessage('Scholarship added to Nexus.');
      setPage(1);
    }
    return result;
  }
  async function action(work, message) {
    const result = await work;
    if (result.error) setActionError(result.error.message);
    else {
      setActionError('');
      setMessage(message);
    }
    return result;
  }
  const pages = Math.max(1, Math.ceil(catalogue.total / 20));
  return (
    <section className="min-w-0">
      <AdminPageHeader
        title="Scholarship discovery"
        description="Discover programmes across the web. Add the ones you want in Nexus."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowSettings(true)}
              disabled={!settings.settings}
            >
              Search settings
            </Button>
            <Button
              disabled={waiting || Boolean(running)}
              loading={trigger.pending}
              onClick={() => trigger.trigger('discovery')}
            >
              Refresh from web
            </Button>
          </>
        }
      />
      {trigger.error && (
        <p role="alert" className="mb-5 text-rust-600">
          {trigger.error.message}
        </p>
      )}
      {trigger.result && (
        <div className="mb-6 border-l-2 border-pine-700 pl-4 text-body-sm" role="status">
          {refreshStatus.state === 'queued' && <p>Refresh queued.</p>}
          {refreshStatus.state === 'running' && (
            <p>Searching the web and checking programme pages…</p>
          )}
          {refreshStatus.state === 'delayed' && (
            <p>The refresh is taking longer to start. Check the crawler logs.</p>
          )}
          {refreshStatus.state === 'success' && (
            <p>
              Refresh finished.{' '}
              {pluralise(
                refreshStatus.run?.candidates_created ?? 0,
                'new discovery',
                'new discoveries'
              )}{' '}
              found.
            </p>
          )}
          {refreshStatus.state === 'partial' && (
            <p>Refresh finished with some source errors. Available results have been saved.</p>
          )}
          {refreshStatus.state === 'failed' && (
            <p className="text-rust-600">
              {refreshStatus.run?.error_message || 'Refresh failed. Check crawler logs.'}
            </p>
          )}
          {refreshStatus.run?.error_message && refreshStatus.state === 'partial' && (
            <p className="mt-2 text-rust-600">{refreshStatus.run.error_message}</p>
          )}
          {refreshStatus.error && (
            <p className="mt-2 text-rust-600">Could not check the refresh status. Try again.</p>
          )}
          <div className="mt-2 flex gap-4">
            <Link className="text-pine-700 underline" to="/admin/crawler">
              Check logs
            </Link>
            <button className="text-pine-700 underline" onClick={refreshStatus.reload}>
              Check status
            </button>
          </div>
        </div>
      )}
      {!trigger.result && running && (
        <p className="mb-5 text-body-sm text-ink-500">
          A crawler run is in progress. New results appear after it finishes.
        </p>
      )}
      <div
        role="tablist"
        aria-label="Discovery catalogue"
        className="mb-6 flex gap-6 border-b border-ink-200"
      >
        {[
          ['discover', 'Discover'],
          ['added', 'Added to Nexus'],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            aria-controls="discovery-results"
            className={`border-b-2 pb-3 text-body-sm font-semibold ${tab === value ? 'border-pine-700 text-pine-700' : 'border-transparent text-ink-500'}`}
            onClick={() => filter(setTab, value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Input
          label="Search programmes"
          value={search}
          onChange={(event) => filter(setSearch, event.target.value)}
        />
        <Select
          label="Provider"
          value={provider}
          onChange={(event) => filter(setProvider, event.target.value)}
          options={[
            { value: '', label: 'All providers' },
            ...catalogue.providers.map((name) => ({ value: name, label: name })),
          ]}
        />
        <Select
          label="Review status"
          value={reviewState}
          onChange={(event) => filter(setReviewState, event.target.value)}
          options={[
            { value: 'all', label: 'All results' },
            { value: 'ready', label: 'Ready to add' },
            { value: 'needs_review', label: 'Needs review' },
            { value: 'ignored', label: 'Ignored' },
          ]}
        />
      </div>
      {message && (
        <p role="status" className="mb-4 text-body-sm text-pine-700">
          {message}
        </p>
      )}
      {actionError && (
        <p role="alert" className="mb-4 text-rust-600">
          {actionError}
        </p>
      )}
      <div
        id="discovery-results"
        role="tabpanel"
        aria-label={tab === 'discover' ? 'Discover' : 'Added to Nexus'}
      >
        <div className="mb-3 flex justify-between text-body-sm">
          <p>{pluralise(catalogue.total, 'scholarship')}</p>
          <button className="text-pine-700 underline" onClick={catalogue.reload}>
            Reload catalogue
          </button>
        </div>
        {catalogue.loading ? (
          <p className="py-12 text-ink-500" role="status">
            Loading scholarships…
          </p>
        ) : catalogue.error ? (
          <p role="alert" className="py-8 text-rust-600">
            {catalogue.error.message}
          </p>
        ) : !catalogue.items.length ? (
          <div className="border-t border-ink-200 py-12">
            <h2 className="text-h3 font-semibold">
              {search || provider || reviewState !== 'all'
                ? 'No matching scholarships'
                : tab === 'added'
                  ? 'No programmes added yet'
                  : 'No discoveries yet'}
            </h2>
            <p className="mt-2 text-body-sm text-ink-500">
              {tab === 'discover'
                ? 'Refresh from web to discover available programmes.'
                : 'Choose programmes from Discover to display them in Nexus.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-ink-200 border-y border-ink-200 bg-white">
            {catalogue.items.map((candidate) => {
              const record = { ...candidate.extracted_record, ...candidate.review_overrides };
              return (
                <article
                  key={candidate.id}
                  className="flex flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:gap-8"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-caption text-ink-500">
                      {candidate.provider || 'Provider needs review'}
                    </p>
                    <h2 className="mt-1 text-body font-semibold">
                      {candidate.name || 'Programme details need review'}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-ink-500">
                      <span>
                        {record.deadline
                          ? `Closes ${formatDate(record.deadline)}`
                          : 'Deadline unknown'}
                      </span>
                      <span>
                        {candidate.publication_status ??
                          (record.status === 'expired'
                            ? 'Closed'
                            : candidate.review_state === 'ready'
                              ? 'Ready to add'
                              : candidate.review_state === 'ignored'
                                ? 'Ignored'
                                : 'Needs review')}
                      </span>
                      <span>
                        {candidate.last_checked_at
                          ? `Checked ${formatDate(candidate.last_checked_at)}`
                          : 'Not checked yet'}
                      </span>
                      {candidate.is_manual && <span>Manual edits protected</span>}
                      {candidate.pending_review && <span>Changes await approval</span>}
                    </div>
                    <div className="mt-2">
                      <OfficialSourceLink
                        url={
                          candidate.approved_source_url ||
                          record.source_url ||
                          candidate.canonical_url
                        }
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {tab === 'discover' && candidate.review_state === 'ready' && (
                      <Button
                        size="sm"
                        disabled={catalogue.busy}
                        onClick={() => publish(candidate)}
                      >
                        Add to Nexus
                      </Button>
                    )}
                    <Button
                      id={`review-${candidate.id}`}
                      variant="secondary"
                      size="sm"
                      disabled={catalogue.busy}
                      onClick={() => setReview(candidate)}
                    >
                      Review details
                    </Button>
                    {tab === 'discover' ? (
                      <Button
                        variant="tertiary"
                        size="sm"
                        disabled={catalogue.busy}
                        onClick={() =>
                          action(
                            catalogue.ignore(candidate.id, candidate.review_state !== 'ignored'),
                            candidate.review_state === 'ignored'
                              ? 'Returned to review.'
                              : 'Discovery ignored.'
                          )
                        }
                      >
                        {candidate.review_state === 'ignored' ? 'Restore' : 'Ignore'}
                      </Button>
                    ) : (
                      <Button
                        variant="tertiary"
                        size="sm"
                        disabled={catalogue.busy}
                        onClick={() =>
                          action(
                            catalogue.setMonitoring(candidate.id, !candidate.monitoring_enabled),
                            'Monitoring updated.'
                          )
                        }
                      >
                        {candidate.monitoring_enabled ? 'Stop monitoring' : 'Resume monitoring'}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {catalogue.total > 20 && (
          <div className="mt-5 flex items-center justify-between">
            <p className="text-body-sm text-ink-500">
              Page {page} of {pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || catalogue.loading}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pages || catalogue.loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      {review && (
        <ScholarshipDiscoveryReview
          key={review.id}
          candidate={review}
          onSave={catalogue.saveReview}
          onPublish={publish}
          onApprove={(candidate) =>
            action(catalogue.approveChanges(candidate), 'Changes approved.')
          }
          onReload={catalogue.getCandidate}
          onAlias={catalogue.linkAlias}
          onClose={() => setReview(null)}
          busy={catalogue.busy}
          duplicateOptions={catalogue.items.filter((item) => item.id !== review.id)}
        />
      )}
      {showSettings && settings.settings && (
        <ScholarshipDiscoverySettings
          settings={settings.settings}
          onSave={settings.save}
          onClose={() => setShowSettings(false)}
        />
      )}
    </section>
  );
}
