import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, EmptyState, Skeleton } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { ScholarshipCard } from '@/components/scholarship/ScholarshipCard';
import { RailPagination } from '@/components/journey/RailPagination';
import { useScholarships } from '@/hooks/useScholarships';
import { useScholarshipMatches } from '@/hooks/useScholarshipMatches';
import { useSavedItems } from '@/hooks/useSavedItems';

/** Reuses existing server-side eligibility checks; never claims a global rank. */
export function RailScholarshipPanel({ matchRevision = 0 }) {
  const catalog = useScholarships({});
  // The existing endpoint supports all active opportunities. Omitting IDs
  // avoids its 200-ID subset cap as the catalogue is incrementally loaded.
  const matches = useScholarshipMatches({ enabled: catalog.items.length > 0 });
  const previousRevision = useRef(matchRevision);
  const reloadMatches = matches.reload;
  useEffect(() => {
    if (previousRevision.current === matchRevision) return;
    previousRevision.current = matchRevision;
    reloadMatches();
  }, [matchRevision, reloadMatches]);
  const saved = useSavedItems('scholarship');
  const [page, setPage] = useState(1);
  const [saveError, setSaveError] = useState(null);
  const recommended = catalog.items
    .map((scholarship) => ({ scholarship, match: matches.byId(scholarship.id) }))
    .filter(({ match }) => match && match.checkable_count > 0 && match.eligibility_score >= 50)
    .sort((a, b) => b.match.eligibility_score - a.match.eligibility_score);
  const pages = Math.max(1, Math.ceil(recommended.length / 4));
  const current = Math.min(page, pages);
  const busy = catalog.loading || catalog.loadingMore || matches.loading;
  const error = catalog.error || matches.error;
  async function toggle(id) {
    setSaveError(null);
    const outcome = await saved.toggle('scholarship', id);
    if (outcome?.error) setSaveError(outcome.error.message);
  }
  return (
    <div className="rail-scholarship-panel">
      <p className="rail-inline-note">
        Profile-based eligibility checks—not a RIASEC career score or a guarantee of funding. These
        opportunities meet at least half of the requirements Nexus can check.
      </p>
      {saveError && (
        <Alert variant="error" title="Couldn’t update your saved scholarship">
          {saveError}
        </Alert>
      )}
      {saved.error && (
        <p className="rail-inline-note">
          Saved-item status is unavailable. Try again before changing bookmarks.
          <Button variant="secondary" onClick={saved.reload}>
            Retry saved status
          </Button>
        </p>
      )}
      {busy ? (
        <div className="rail-recommendation-grid">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      ) : error ? (
        <ErrorState
          title="We couldn’t check scholarship matches"
          message={error.message}
          onRetry={() => {
            catalog.reload();
            matches.reload();
          }}
        />
      ) : (
        <>
          <p className="rail-results-count" aria-live="polite">
            {recommended.length} matches among {catalog.items.length} loaded opportunities ·{' '}
            {catalog.total} active opportunities in the catalogue
          </p>
          {recommended.length ? (
            <div className="rail-recommendation-grid rail-scholarship-cards">
              {recommended.slice((current - 1) * 4, current * 4).map(({ scholarship, match }) => (
                <ScholarshipCard
                  key={scholarship.id}
                  scholarship={scholarship}
                  match={match}
                  authenticated
                  saved={saved.isSaved('scholarship', scholarship.id)}
                  onToggleSave={
                    saved.loading || saved.error ? undefined : () => toggle(scholarship.id)
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No matches in the loaded opportunities"
              description="Some requirements may be unavailable or unmet. Browse the catalogue or check more opportunities; this is not a final eligibility decision."
            />
          )}
          <RailPagination
            page={current}
            pages={pages}
            onChange={setPage}
            label="Scholarship match pages"
          />
        </>
      )}
      <div className="rail-scholarship-actions">
        {catalog.hasMore && !error && (
          <Button
            variant="secondary"
            loading={busy}
            onClick={() => {
              setPage(1);
              catalog.loadMore();
            }}
          >
            Check more opportunities
          </Button>
        )}
        <Link className="rail-card-link" to="/scholarships">
          Browse all scholarships →
        </Link>
      </div>
    </div>
  );
}
