import { useMemo } from 'react';
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

/**
 * Scholarship detail (FR-SCH-04 / FR10, ui-spec §3.11).
 *
 * Public route. On mobile the eligibility panel moves ABOVE the overview —
 * eligibility is what the student came for.
 *
 * The application timeline from Figure 4.5 is not built: there is no data model
 * for its stages anywhere in the documents (requirements.md §9.1 / M-09), and
 * inventing stages would put fabricated dates in front of a student.
 */
export function ScholarshipDetail() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const { scholarship, criteria, loading, error, reload } = useScholarship(id);

  const ids = useMemo(() => (id ? [id] : []), [id]);
  const {
    byId,
    loading: matching,
    error: matchError,
  } = useScholarshipMatches({ scholarshipIds: ids, enabled: isAuthenticated && Boolean(id) });
  const saved = useSavedItems('scholarship');

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
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
      <div className="mx-auto max-w-3xl px-4 py-8">
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
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-h1 font-serif">We can’t find that scholarship</h1>
        <p className="mt-3 text-body text-ink-700">
          It may have been removed, or the link may be wrong.
        </p>
        <Link
          to="/scholarships"
          className="mt-6 inline-flex h-10 items-center rounded-input bg-pine-700 px-4 text-body-sm font-medium text-white hover:bg-pine-500"
        >
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
    <div className="section-shell py-8 md:py-12">
      <Link to="/scholarships" className="text-body-sm text-pine-700 hover:underline">
        <span aria-hidden="true">‹</span> All scholarships
      </Link>

      <header className="relative mt-4 overflow-hidden rounded-modal bg-pine-900 p-6 text-white md:p-10">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[36px] border-pine-500/40" aria-hidden="true" />
        <p className="text-caption font-semibold text-lime">{s.provider}</p>
        <h1 className="mt-3 max-w-4xl text-display font-serif text-white">{s.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DeadlineBadge deadline={s.deadline} expired={expired} />
          {(s.education_levels ?? []).map((l) => (
            <Badge key={l} variant="neutral">
              {EDUCATION_LEVEL_LABELS[l] ?? l}
            </Badge>
          ))}
          {(s.field_of_study ?? []).map((f) => (
            <Badge key={f} variant="neutral">
              {f}
            </Badge>
          ))}
        </div>
      </header>

      {expired && (
        <Alert variant="warning" title="This round has closed." className="mt-4">
          The deadline was {formatDate(s.deadline)}. Providers often reopen annually — check their
          page for the next intake.
        </Alert>
      )}

      {s.status === 'flagged' && (
        <Alert variant="warning" title="This record is under review." className="mt-4">
          Our checks flagged something unusual in the source data. Treat the details below with
          caution and confirm everything on the provider&rsquo;s own page.
        </Alert>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,360px]">
        {/* eligibility first on mobile, sidebar on desktop */}
        <div className="lg:order-2">
          <div className="lg:sticky lg:top-28">{checklist}</div>
        </div>

        <div className="flex flex-col gap-4 lg:order-1">
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

          <Card variant="titled" title="Applying">
            <dl className="flex flex-col gap-2 text-body-sm">
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
                  className="inline-flex h-11 items-center gap-2 rounded-pill bg-pine-700 px-5 text-body-sm font-semibold text-white hover:bg-pine-900"
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

              {isAuthenticated && (
                <Button
                  variant="secondary"
                  onClick={() => saved.toggle('scholarship', s.id)}
                  disabled={saved.loading}
                >
                  {saved.isSaved('scholarship', s.id) ? 'Saved' : 'Save this'}
                </Button>
              )}
            </div>
          </Card>

          {s.source_url && (
            <p className="text-body-sm text-ink-500">
              Source:{' '}
              <a
                href={s.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-pine-700 underline"
              >
                {safeHost(s.source_url)}
              </a>
              {s.last_scraped_at && ` · last checked ${formatDate(s.last_scraped_at)}`}
            </p>
          )}
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
