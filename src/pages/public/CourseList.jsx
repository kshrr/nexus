import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Icon, Skeleton } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { CourseFilters } from '@/components/course/CourseFilters';
import { CourseBrowseCard } from '@/components/course/CourseBrowseCard';
import { useCourses, useCourseFacets } from '@/hooks/useCourses';
import { COURSE_PAGE_SIZE } from '@/lib/courseCatalogue';
import '@/styles/course-catalogue.css';

const FILTER_KEYS = ['state', 'university', 'field', 'pathway', 'type', 'duration'];
export default function CourseList() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const key = params.toString();
  const filters = useMemo(() => {
    const query = new URLSearchParams(key);
    const parsed = {
      search: query.get('q') ?? '',
      sort: ['name', 'name-desc', 'duration'].includes(query.get('sort'))
        ? query.get('sort')
        : 'name',
      page: Math.max(1, Math.min(100000, parseInt(query.get('page'), 10) || 1)),
    };
    FILTER_KEYS.forEach((name) => {
      parsed[name] = query.get(name) ?? '';
    });
    if (!['', 'under-24', '24-48', 'over-48'].includes(parsed.duration)) parsed.duration = '';
    return parsed;
  }, [key]);
  const courses = useCourses(filters),
    facets = useCourseFacets();
  const pages = Math.max(1, Math.ceil(courses.total / COURSE_PAGE_SIZE));
  function change(name, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
    setParams(next, { replace: name === 'q' });
  }
  useEffect(() => {
    if (!courses.loading && !courses.error && filters.page > pages) {
      const next = new URLSearchParams(key);
      next.set('page', String(pages));
      setParams(next, { replace: true });
    }
  }, [courses.loading, courses.error, filters.page, pages, key, setParams]);
  const active = FILTER_KEYS.filter((name) => filters[name]);
  const activeCount = active.length + (filters.search ? 1 : 0);
  function clear() {
    setParams({});
  }
  function changePage(page) {
    change('page', String(page));
    document.getElementById('course-results-title')?.scrollIntoView({ block: 'start' });
  }
  const from = location.pathname + location.search;

  return (
    <div className="course-directory course-design">
      <div className="course-hero-band">
        <div className="course-shell">
          <section className="course-directory-hero">
            <div>
              <p className="course-eyebrow">
                <span className="course-station-mark">N</span> NEXUS CENTRAL / COURSE DIRECTORY
              </p>
              <h1>
                Find a course.
                <br />
                <span>Choose your direction.</span>
              </h1>
              <p className="course-hero-copy">
                Explore university programmes across Malaysia. Start with what interests you, then
                find a place to take it further.
              </p>
              <div className="course-hero-route" aria-hidden="true">
                <i />
                <span>Explore</span>
                <b />
                <i />
                <span>Compare</span>
                <b />
                <i />
                <span>Your next chapter</span>
              </div>
            </div>
            <div className="course-directory-ticket">
              <div className="course-ticket-top">
                <span>YOUR NEXT STOP</span>
                <Icon name="book" className="h-5 w-5" />
              </div>
              <p>Study possibilities.</p>
              <span className="course-ticket-note">One directory. A world of directions.</span>
              <div className="course-ticket-counts">
                <div>
                  <strong>{facets.loading || facets.error ? '—' : facets.total}</strong>
                  <span>published courses</span>
                </div>
                <div>
                  <strong>
                    {facets.loading || facets.error ? '—' : facets.universities.length}
                  </strong>
                  <span>universities</span>
                </div>
              </div>
              <div className="course-ticket-foot">
                <span>NEXUS / MALAYSIA</span>
                <span className="course-barcode" aria-hidden="true" />
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className="course-shell">
        <div className="course-search-bar">
          <Icon name="search" className="h-5 w-5" />
          <label htmlFor="course-search" className="sr-only">
            Search course name
          </label>
          <input
            id="course-search"
            type="search"
            placeholder="Search Computer Science, Medicine, Architecture…"
            value={filters.search}
            onChange={(event) => change('q', event.target.value)}
          />
          <span>Find your next stop</span>
        </div>
        <div className="course-directory-body">
          <aside className={'course-filters' + (filtersOpen ? ' is-open' : '')}>
            <button
              className="course-mobile-filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls="course-filter-panel"
              onClick={() => setFiltersOpen((value) => !value)}
            >
              Filter your options{activeCount ? ' (' + activeCount + ')' : ''}
              <Icon name="menu" className="h-4 w-4" />
            </button>
            <div id="course-filter-panel" className="course-filter-panel">
              <div className="course-filter-title">
                <div>
                  <p className="course-kicker">MAKE IT YOURS</p>
                  <h2>Filter your options</h2>
                </div>
                <button onClick={clear} disabled={!activeCount}>
                  Reset
                </button>
              </div>
              <p className="course-filter-intro">
                A few preferences can help you find your direction.
              </p>
              {facets.error ? (
                <div role="alert" className="course-inline-error">
                  <p>Filter options couldn’t be loaded.</p>
                  <button onClick={facets.reload}>Retry filters</button>
                </div>
              ) : null}
              <CourseFilters facets={facets} value={filters} onChange={change} />
            </div>
          </aside>
          <section
            className="course-results"
            aria-labelledby="course-results-title"
            aria-busy={courses.loading || Boolean(courses.outOfRange)}
          >
            <div className="course-results-header">
              <div>
                <p className="course-kicker">EXPLORE YOUR OPTIONS</p>
                <h2 id="course-results-title">Courses to consider</h2>
                <p role="status">
                  {courses.loading
                    ? 'Finding courses…'
                    : courses.error
                      ? 'Results unavailable'
                      : courses.total +
                        ' ' +
                        (courses.total === 1 ? 'course' : 'courses') +
                        (activeCount ? ' matching your preferences' : ' in the directory')}
                </p>
              </div>
              <div className="course-control course-sort">
                <label htmlFor="course-sort">Sort by</label>
                <select
                  id="course-sort"
                  value={filters.sort}
                  onChange={(event) => change('sort', event.target.value)}
                >
                  <option value="name">Course name: A–Z</option>
                  <option value="name-desc">Course name: Z–A</option>
                  <option value="duration">Shortest duration</option>
                </select>
              </div>
            </div>
            {activeCount > 0 && (
              <div className="course-active-filters">
                {filters.search && (
                  <button onClick={() => change('q', '')} aria-label="Remove search filter">
                    {filters.search}
                    <span aria-hidden="true">×</span>
                  </button>
                )}
                {active.map((name) => (
                  <button
                    key={name}
                    onClick={() => change(name, '')}
                    aria-label={'Remove ' + name + ' filter'}
                  >
                    {name === 'university'
                      ? (facets.universities.find((u) => u.id === filters.university)?.name ??
                        'Selected university')
                      : filters[name]}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
                <button className="course-clear-link" onClick={clear}>
                  Clear all filters
                </button>
              </div>
            )}
            {courses.loading || courses.outOfRange ? (
              <div className="course-result-grid">
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} variant="card" />
                ))}
              </div>
            ) : courses.error ? (
              <ErrorState
                title="We couldn’t load courses"
                message={courses.error.message}
                onRetry={courses.reload}
              />
            ) : courses.items.length ? (
              <>
                <div className="course-result-grid">
                  {courses.items.map((course) => (
                    <CourseBrowseCard key={course.id} course={course} from={from} />
                  ))}
                </div>
                <nav className="course-pagination" aria-label="Course results pages">
                  <p>
                    Showing {(filters.page - 1) * COURSE_PAGE_SIZE + 1}–
                    {Math.min(filters.page * COURSE_PAGE_SIZE, courses.total)} of {courses.total}
                  </p>
                  <div>
                    <button
                      aria-label="Previous page"
                      disabled={filters.page <= 1}
                      onClick={() => changePage(filters.page - 1)}
                    >
                      ← Previous
                    </button>
                    <span>
                      Page {filters.page} of {pages}
                    </span>
                    <button
                      aria-label="Next page"
                      disabled={filters.page >= pages}
                      onClick={() => changePage(filters.page + 1)}
                    >
                      Next →
                    </button>
                  </div>
                </nav>
              </>
            ) : (
              <div className="course-empty">
                <Icon name="compass" className="h-9 w-9" />
                <h3>
                  {activeCount
                    ? 'No courses match your filters'
                    : 'The course directory is getting ready'}
                </h3>
                <p>
                  {activeCount
                    ? 'Try a different field, location or university to explore more possibilities.'
                    : 'Published university programmes will appear here as they are added to Nexus.'}
                </p>
                {activeCount > 0 && (
                  <button className="course-primary-button" onClick={clear}>
                    Reset preferences
                  </button>
                )}
              </div>
            )}
            <p className="course-directory-note">
              <Icon name="book" className="h-4 w-4" /> Open a course for its complete published
              details and university source. Entry requirements and intake information should be
              confirmed with the institution.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
