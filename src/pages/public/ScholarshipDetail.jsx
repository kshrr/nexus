import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Icon, Skeleton } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { DeadlineBadge } from '@/components/scholarship/DeadlineBadge';
import { EligibilityChecklist } from '@/components/scholarship/EligibilityChecklist';
import { useScholarship } from '@/hooks/useScholarships';
import { useScholarshipMatches } from '@/hooks/useScholarshipMatches';
import { useSavedItems } from '@/hooks/useSavedItems';
import { useAuth } from '@/context/useAuth';
import { formatDate } from '@/lib/format';
import { EDUCATION_LEVEL_LABELS } from '@/types';
import { RailTabs } from '@/components/journey/RailTabs';
import '@/styles/rail-scholarships.css';

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'applying', label: 'Applying' },
];

/**
 * Scholarship detail (FR-SCH-04 / FR10, ui-spec §3.11).
 *
 * Public route. Full information is grouped into keyboard-accessible tabs.
 *
 * The application timeline from Figure 4.5 is not built: there is no data model
 * for its stages anywhere in the documents (requirements.md §9.1 / M-09), and
 * inventing stages would put fabricated dates in front of a student.
 */
export function ScholarshipDetail() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const { scholarship, criteria, loading, error, reload } = useScholarship(id);
  const [active, setActive] = useState('overview');
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const tabId = useId();

  const ids = useMemo(() => (id ? [id] : []), [id]);
  const {
    byId,
    loading: matching,
    error: matchError,
  } = useScholarshipMatches({ scholarshipIds: ids, enabled: isAuthenticated && Boolean(id) });
  const saved = useSavedItems('scholarship');
  useEffect(() => {
    setActive('overview');
    setSaveError(null);
  }, [id]);

  async function toggleSave() {
    if (saving || saved.loading || saved.error) return;
    setSaving(true);
    setSaveError(null);
    try {
      const outcome = await saved.toggle('scholarship', id);
      if (outcome?.error) setSaveError(outcome.error.message);
    } catch (err) {
      setSaveError(err.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className="rail-scholarship-page scholarship-detail-shell section-shell"
        aria-busy="true"
      >
        <Skeleton variant="text" lines={2} />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,340px]">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rail-scholarship-page scholarship-detail-shell section-shell">
        <ErrorState
          title="We couldn’t load this scholarship"
          message={error.message}
          onRetry={reload}
        />
      </div>
    );
  }

  if (!scholarship) {
    return (
      <div className="rail-scholarship-page scholarship-detail-shell section-shell text-center">
        <h1 className="text-h1 font-serif">We can’t find that scholarship</h1>
        <p className="mt-3 text-body text-ink-700">
          It may have been removed, or the link may be wrong.
        </p>
        <Link to="/scholarships" className="scholarship-detail-link mt-6">
          Browse all scholarships
        </Link>
      </div>
    );
  }

  const s = scholarship;
  const expired = s.status === 'expired';
  const match = byId(s.id);
  const applyHost = s.application_link ? safeHost(s.application_link) : null;

  const checklist = (
    <EligibilityChecklist
      criteria={criteria}
      match={match}
      authenticated={isAuthenticated}
      loading={matching}
      error={matchError}
    />
  );

  return (
    <div className="rail-scholarship-page scholarship-detail-page">
      <div className="section-shell scholarship-detail-shell">
        <Link to="/scholarships" className="scholarship-back-link">
          <span aria-hidden="true">‹</span> All scholarships
        </Link>

        <header className="scholarship-detail-heading">
          <div>
            <p className="scholarship-eyebrow">
              <span aria-hidden="true">S</span> SCHOLARSHIP INFORMATION
            </p>
            <p className="scholarship-detail-provider">{s.provider}</p>
            <h1>{s.name}</h1>
            <div className="scholarship-detail-status">
              <DeadlineBadge deadline={s.deadline} expired={expired} />
            </div>
          </div>
          {isAuthenticated && (
            <Button
              variant="secondary"
              className="scholarship-save"
              onClick={toggleSave}
              disabled={saved.loading || Boolean(saved.error)}
              loading={saving}
              aria-pressed={saved.isSaved('scholarship', s.id)}
              iconLeft={<Icon name="bookmark" />}
            >
              {saved.isSaved('scholarship', s.id) ? 'Saved' : 'Save this'}
            </Button>
          )}
        </header>

        {saveError && (
          <Alert variant="error" title="Couldn’t update your saved scholarship" className="mt-4">
            {saveError}
          </Alert>
        )}
        {saved.error && (
          <Alert variant="warning" className="mt-4">
            Saved-item status is unavailable.{' '}
            <Button variant="link" onClick={saved.reload}>
              Retry saved status
            </Button>
          </Alert>
        )}

        {expired && (
          <Alert variant="warning" title="This round has closed." className="mt-4">
            {s.deadline ? `The deadline was ${formatDate(s.deadline)}. ` : ''}Check the provider’s
            page for the next intake.
          </Alert>
        )}

        {s.status === 'flagged' && (
          <Alert variant="warning" title="This record is under review." className="mt-4">
            Our checks flagged something unusual in the source data. Treat the details below with
            caution and confirm everything on the provider&rsquo;s own page.
          </Alert>
        )}

        <div className="scholarship-details-board">
          <RailTabs
            id={tabId}
            tabs={DETAIL_TABS}
            active={active}
            onChange={setActive}
            label="Scholarship details"
          />
          <section
            role="tabpanel"
            id={`${tabId}-eligibility-panel`}
            aria-labelledby={`${tabId}-eligibility`}
            hidden={active !== 'eligibility'}
            tabIndex={0}
            className="scholarship-tab-panel scholarship-eligibility-panel"
          >
            <p className="scholarship-small-label">02 / Check your route</p>
            {checklist}
          </section>

          <section
            role="tabpanel"
            id={`${tabId}-overview-panel`}
            aria-labelledby={`${tabId}-overview`}
            hidden={active !== 'overview'}
            tabIndex={0}
            className="scholarship-tab-panel"
          >
            <p className="scholarship-small-label">01 / About this opportunity</p>
            <div className="scholarship-overview-grid">
              <Card variant="titled" title="Overview">
                {s.description ? (
                  <p className="max-w-prose whitespace-pre-line text-body text-ink-900">
                    {s.description}
                  </p>
                ) : (
                  <p className="text-body-sm text-ink-500">
                    No description has been recorded for this scholarship. The provider&rsquo;s page
                    will have the full details.
                  </p>
                )}
              </Card>

              <Card variant="titled" title="Benefits and coverage">
                {s.funding_amount ? (
                  <p className="text-body text-ink-900">{s.funding_amount}</p>
                ) : (
                  <p className="text-body-sm text-ink-500">
                    The funding amount hasn&rsquo;t been recorded. Check the provider&rsquo;s page.
                  </p>
                )}
              </Card>
            </div>
            <div className="scholarship-detail-categories">
              <h2>Study routes</h2>
              <div className="scholarship-ticket-tags">
                {(s.education_levels ?? []).map((level) => (
                  <Badge key={`l-${level}`}>{EDUCATION_LEVEL_LABELS[level] ?? level}</Badge>
                ))}
                {(s.field_of_study ?? []).map((field) => (
                  <Badge key={`f-${field}`}>{field}</Badge>
                ))}
                {!s.education_levels?.length && !s.field_of_study?.length && (
                  <p>Study categories have not been recorded.</p>
                )}
              </div>
            </div>
          </section>

          <section
            role="tabpanel"
            id={`${tabId}-applying-panel`}
            aria-labelledby={`${tabId}-applying`}
            hidden={active !== 'applying'}
            tabIndex={0}
            className="scholarship-tab-panel"
          >
            <p className="scholarship-small-label">03 / Your next stop</p>
            <Card variant="titled" title="Applying">
              <dl className="scholarship-application-facts">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Deadline</dt>
                  <dd className="text-ink-900">
                    {s.deadline ? formatDate(s.deadline) : 'Rolling intake'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">Provider</dt>
                  <dd className="text-ink-900">{s.provider}</dd>
                </div>
                {s.updated_at && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">Record updated</dt>
                    <dd className="text-ink-900">{formatDate(s.updated_at)}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {s.application_link ? (
                  <a
                    href={s.application_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="scholarship-detail-link"
                  >
                    Apply on {applyHost}
                    <Icon name="arrowUpRight" className="h-4 w-4" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  <p className="text-body-sm text-ink-500">
                    No application link has been recorded for this scholarship yet.
                  </p>
                )}
              </div>
            </Card>

            {s.source_url && (
              <p className="scholarship-source">
                Source:{' '}
                <a href={s.source_url} target="_blank" rel="noopener noreferrer">
                  {safeHost(s.source_url)}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                {s.last_scraped_at && ` · last checked ${formatDate(s.last_scraped_at)}`}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "the provider's site";
  }
}

export default ScholarshipDetail;
