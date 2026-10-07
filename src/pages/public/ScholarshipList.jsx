import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, EmptyState, Icon, Input, Skeleton } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { ScholarshipCard } from '@/components/scholarship/ScholarshipCard';
import { ScholarshipFilters } from '@/components/scholarship/ScholarshipFilters';
import { useScholarshipFacets, useScholarships } from '@/hooks/useScholarships';
import { useScholarshipMatches } from '@/hooks/useScholarshipMatches';
import { useSavedItems } from '@/hooks/useSavedItems';
import { useAuth } from '@/context/useAuth';
import { pluralise } from '@/lib/format';

const EMPTY_FILTERS = { fields: [], providers: [], levels: [] };

/**
 * Scholarship list (FR09, ui-spec §3.10). Public route — browsing needs no
 * session (§4.5 public read / Conflict C-09), but the "Recommended for you"
 * block and per-card eligibility summary require one, because matching needs a
 * profile.
 */
export function ScholarshipList() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const facets = useScholarshipFacets();
  const { items, total, loading, loadingMore, error, hasMore, loadMore, reload } = useScholarships({
    search,
    ...filters,
  });

  const visibleIds = useMemo(() => items.map((s) => s.id), [items]);
  const { byId, loading: matching } = useScholarshipMatches({
    scholarshipIds: visibleIds,
    enabled: isAuthenticated && visibleIds.length > 0,
  });
  const saved = useSavedItems('scholarship');

  const activeCount = filters.fields.length + filters.providers.length + filters.levels.length;

  // "Recommended for you": the best-matching records among those on screen.
  const recommended = useMemo(() => {
    if (!isAuthenticated) return [];
    return items
      .map((s) => ({ s, m: byId(s.id) }))
      .filter(({ m }) => m && m.checkable_count > 0 && m.eligibility_score >= 50)
      .sort((a, b) => b.m.eligibility_score - a.m.eligibility_score)
      .slice(0, 3);
  }, [items, byId, isAuthenticated]);

  const filterPanel = (
    <ScholarshipFilters
      facets={facets}
      value={filters}
      onChange={setFilters}
      onClear={() => setFilters(EMPTY_FILTERS)}
    />
  );

  return (
    <div>
      <section className="bg-pine-900 py-12 text-white md:py-16">
        <div className="section-shell grid gap-8 md:grid-cols-[1fr,auto] md:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-caption font-semibold text-lime"><Icon name="scholarship" className="h-4 w-4" /> OPPORTUNITY DISCOVERY</p>
            <h1 className="mt-3 text-display font-serif text-white">Scholarships for your next chapter.</h1>
            <p className="mt-4 max-w-2xl text-body text-pine-100">Explore published opportunities from trusted records. Sign in to see eligibility indicators shaped by your profile.</p>
          </div>
          <div className="hidden h-24 w-24 rotate-6 place-items-center rounded-[28px] bg-lime text-pine-900 md:grid"><Icon name="scholarship" className="h-10 w-10" /></div>
        </div>
      </section>

      <div className="section-shell py-8 md:py-12">

      <div className="lg:flex lg:gap-8">
        {/* --- filter rail (desktop) ---------------------------------- */}
        <aside className="hidden w-64 shrink-0 lg:block"><div className="sticky top-28 rounded-card border border-pine-100 bg-surface p-5 shadow-sm">{filterPanel}</div></aside>

        {/* --- results ------------------------------------------------ */}
        <div className="min-w-0 flex-1">
          <div className="rounded-card border border-pine-100 bg-surface p-4 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              label="Search"
              className="flex-1"
              placeholder="Scholarship or provider name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="search"
            />
            <Button variant="secondary" className="lg:hidden" iconLeft={<Icon name="search" className="h-4 w-4" />} onClick={() => setSheetOpen(true)}>
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </Button>
            </div>
            <p className="mt-3 text-body-sm text-ink-500" aria-live="polite">{loading ? 'Loading opportunities…' : pluralise(total, 'scholarship')}</p>
          </div>

          {/* --- recommended for you -------------------------------- */}
          {isAuthenticated && recommended.length > 0 && (
            <section className="mt-6">
              <div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-lime text-pine-900"><Icon name="sparkles" className="h-4 w-4" /></span><h2 className="text-h2 font-serif">Recommended for you</h2></div>
              <div className="grid gap-4 md:grid-cols-2">
                {recommended.map(({ s, m }) => (
                  <ScholarshipCard
                    key={`rec-${s.id}`}
                    scholarship={s}
                    match={m}
                    authenticated
                    saved={saved.isSaved('scholarship', s.id)}
                    onToggleSave={() => saved.toggle('scholarship', s.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {!isAuthenticated && !loading && items.length > 0 && (
            <Alert variant="info" className="mt-6">
              <strong>Sign in to see which scholarships you qualify for.</strong>{' '}
              <Link to="/login" className="text-pine-700 underline">
                Sign in
              </Link>{' '}
              or{' '}
              <Link to="/register" className="text-pine-700 underline">
                create an account
              </Link>
              .
            </Alert>
          )}

          {/* --- all scholarships ------------------------------------ */}
          <section className="mt-6">
            {isAuthenticated && recommended.length > 0 && (
              <h2 className="mb-4 text-h2 font-serif">All scholarships</h2>
            )}

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton variant="card" />
                <Skeleton variant="card" />
                <Skeleton variant="card" />
                <Skeleton variant="card" />
              </div>
            ) : error ? (
              <ErrorState
                title="We couldn’t load the scholarships"
                message={error.message}
                onRetry={reload}
              />
            ) : items.length === 0 ? (
              activeCount > 0 || search ? (
                <EmptyState
                  title="No scholarships match these filters"
                  description="Try removing a filter or searching for a different provider."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setFilters(EMPTY_FILTERS);
                        setSearch('');
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="No scholarships listed yet"
                  description="Records are added by an administrator and refreshed by the weekly crawler. Nothing has been published yet — check back soon."
                />
              )
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {items.map((s) => (
                    <ScholarshipCard
                      key={s.id}
                      scholarship={s}
                      match={byId(s.id)}
                      authenticated={isAuthenticated && !matching}
                      saved={saved.isSaved('scholarship', s.id)}
                      onToggleSave={() => saved.toggle('scholarship', s.id)}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="mt-6 flex justify-center">
                    <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                      Load more opportunities
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
      </div>

      {/* --- mobile filter sheet ------------------------------------- */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-surface p-4 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          <div className="mx-auto flex h-full max-w-md flex-col">
            <div className="flex-1 overflow-y-auto">
              <Card>{filterPanel}</Card>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                }}
              >
                Clear
              </Button>
              <Button fullWidth onClick={() => setSheetOpen(false)}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScholarshipList;
