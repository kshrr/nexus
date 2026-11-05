import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, EmptyState, Icon, Input, Skeleton } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { ScholarshipCard } from '@/components/scholarship/ScholarshipCard';
import { ScholarshipFilters } from '@/components/scholarship/ScholarshipFilters';
import { useScholarshipFacets, useScholarships } from '@/hooks/useScholarships';
import { useScholarshipMatches } from '@/hooks/useScholarshipMatches';
import { useSavedItems } from '@/hooks/useSavedItems';
import { useAuth } from '@/context/useAuth';
import { pluralise } from '@/lib/format';
import '@/styles/rail-scholarships.css';

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
  const [saveError, setSaveError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const sheetRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!sheetOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [sheetOpen]);

  function handleSheetKeys(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSheetOpen(false);
    }
    if (event.key !== 'Tab') return;
    const controls = sheetRef.current?.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), a[href]'
    );
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

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
  async function toggleSave(id) {
    if (savingId || saved.loading || saved.error) return;
    setSaveError(null);
    setSavingId(id);
    try {
      const outcome = await saved.toggle('scholarship', id);
      if (outcome?.error) setSaveError(outcome.error.message);
    } catch (err) {
      setSaveError(err.message || 'Please try again.');
    } finally {
      setSavingId(null);
    }
  }

  const activeCount = filters.fields.length + filters.providers.length + filters.levels.length;

  // "Recommended for you": the best-matching records among those on screen.
  const recommended = useMemo(() => {
    if (!isAuthenticated || loading || error || matching) return [];
    return items
      .map((s) => ({ s, m: byId(s.id) }))
      .filter(({ m }) => m && m.checkable_count > 0 && m.eligibility_score >= 50)
      .sort((a, b) => b.m.eligibility_score - a.m.eligibility_score)
      .slice(0, 3);
  }, [items, byId, isAuthenticated, loading, error, matching]);

  const filterPanel = (
    <ScholarshipFilters
      facets={facets}
      value={filters}
      onChange={setFilters}
      onClear={() => setFilters(EMPTY_FILTERS)}
    />
  );

  return (
    <div className="rail-scholarship-page">
      <section className="scholarship-hero">
        <div className="section-shell scholarship-hero-inner">
          <div className="scholarship-hero-content">
            <p className="scholarship-eyebrow">
              <span aria-hidden="true">S</span> OPPORTUNITY DISCOVERY
            </p>
            <h1>Scholarships</h1>
            <p className="scholarship-hero-description">Find suitable scholarships for you.</p>
          </div>
          <aside className="scholarship-directory-ticket" aria-label="Scholarship directory">
            <div className="scholarship-directory-ticket-top">
              <span>YOUR NEXT STOP</span>
              <Icon name="scholarship" className="h-5 w-5" />
            </div>
            <h2>Funding possibilities.</h2>
            <p className="scholarship-directory-ticket-note">One directory. More opportunities.</p>
            <dl
              className="scholarship-directory-ticket-counts"
              aria-live="polite"
              aria-atomic="true"
            >
              <div>
                <dt id="scholarship-ticket-total-label">
                  {search.trim() || activeCount
                    ? 'Matching scholarships'
                    : 'Published scholarships'}
                </dt>
                <dd aria-labelledby="scholarship-ticket-total-label">
                  {loading || error ? '—' : total}
                </dd>
              </div>
              <div>
                <dt id="scholarship-ticket-providers-label">Listed providers</dt>
                <dd aria-labelledby="scholarship-ticket-providers-label">
                  {facets.loading || error || !facets.providers.length
                    ? '—'
                    : facets.providers.length}
                </dd>
              </div>
            </dl>
            <div className="scholarship-directory-ticket-foot">
              <span>NEXUS / MALAYSIA</span>
              <span className="scholarship-directory-barcode" aria-hidden="true" />
            </div>
          </aside>
        </div>
      </section>

      <div className="section-shell scholarship-catalogue-shell">
        <div className="scholarship-catalogue-layout">
          {/* --- filter rail (desktop) ---------------------------------- */}
          <aside className="scholarship-filter-rail" aria-label="Filter scholarships">
            <div className="scholarship-filter-board">
              <p className="scholarship-small-label">Choose your route</p>
              {filterPanel}
            </div>
          </aside>

          {/* --- results ------------------------------------------------ */}
          <div className="min-w-0 flex-1">
            <div className="scholarship-search-board">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input
                  label="Search"
                  className="min-w-0 flex-1"
                  placeholder="Scholarship or provider name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  type="search"
                />
                <Button
                  variant="secondary"
                  className="lg:hidden"
                  iconLeft={<Icon name="search" className="h-4 w-4" />}
                  onClick={() => setSheetOpen(true)}
                >
                  Filters{activeCount > 0 ? ` (${activeCount})` : ''}
                </Button>
              </div>
              <p className="mt-3 text-body-sm text-ink-500" aria-live="polite">
                {loading ? 'Loading opportunities…' : pluralise(total, 'scholarship')}
              </p>
            </div>

            {saveError && (
              <Alert
                variant="error"
                title="Couldn’t update your saved scholarship"
                className="mt-4"
              >
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

            {/* --- recommended for you -------------------------------- */}
            {isAuthenticated && recommended.length > 0 && (
              <section className="mt-6">
                <div className="scholarship-section-heading">
                  <span aria-hidden="true">01</span>
                  <h2>Recommended for you</h2>
                </div>
                <p className="scholarship-results-note">
                  Matches among the loaded opportunities. Confirm eligibility in View details.
                </p>
                <div className="scholarship-card-grid">
                  {recommended.map(({ s, m }) => (
                    <ScholarshipCard
                      key={`rec-${s.id}`}
                      scholarship={s}
                      match={m}
                      authenticated
                      saved={saved.isSaved('scholarship', s.id)}
                      onToggleSave={() => toggleSave(s.id)}
                      saveDisabled={saved.loading || Boolean(saved.error) || Boolean(savingId)}
                    />
                  ))}
                </div>
              </section>
            )}

            {!isAuthenticated && !loading && items.length > 0 && (
              <Alert variant="info" className="mt-6">
                <strong>Check requirements against your profile.</strong>{' '}
                <Link to="/login" className="underline">
                  Sign in
                </Link>{' '}
                or{' '}
                <Link to="/register" className="underline">
                  create an account
                </Link>
                .
              </Alert>
            )}

            {/* --- all scholarships ------------------------------------ */}
            <section className="mt-6">
              <div className="scholarship-section-heading">
                <span aria-hidden="true">{recommended.length ? '02' : '01'}</span>
                <h2>All scholarships</h2>
              </div>

              {loading ? (
                <div className="scholarship-card-grid">
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
                    description="New opportunities will appear here when published. Check back soon."
                  />
                )
              ) : (
                <>
                  <div className="scholarship-card-grid">
                    {items.map((s) => (
                      <ScholarshipCard
                        key={s.id}
                        scholarship={s}
                        match={byId(s.id)}
                        authenticated={isAuthenticated}
                        saved={saved.isSaved('scholarship', s.id)}
                        onToggleSave={() => toggleSave(s.id)}
                        saveDisabled={saved.loading || Boolean(saved.error) || Boolean(savingId)}
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
          className="scholarship-filter-sheet"
          ref={sheetRef}
          onKeyDown={handleSheetKeys}
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          <div className="mx-auto flex h-full max-w-md flex-col">
            <div className="scholarship-sheet-heading">
              <span className="scholarship-small-label">Choose your route</span>
              <Button
                ref={closeRef}
                variant="secondary"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
              >
                Close ×
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="scholarship-filter-board">{filterPanel}</div>
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
