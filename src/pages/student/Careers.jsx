import { useMemo, useState } from 'react';
import { Button, Icon, Skeleton } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { CareerCard } from '@/components/career/CareerCard';
import { careerThemeStyle } from '@/components/career/careerThemes';
import { useCareers } from '@/hooks/useCareers';
import '@/styles/rail-careers.css';
const CATEGORIES = [
  'All',
  'Computing & Technology',
  'Engineering',
  'Business & Finance',
  'Science',
  'Healthcare',
  'Education',
  'Creative & Design',
  'Social Sciences',
];
export function Careers() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const { careers, loading, error, reload } = useCareers({ search, category });
  const resultLabel = useMemo(
    () => careers.length + ' ' + (careers.length === 1 ? 'career' : 'careers'),
    [careers.length]
  );
  return (
    <div className="rail-career-page">
      <header className="career-discovery-hero">
        <div>
          <p className="career-eyebrow">NEXUS / CAREER CONNECTIONS</p>
          <h1>Explore Career Pathways</h1>
          <p>
            Explore careers in Malaysia. Connect your interests with local study options,
            qualifications and the work ahead.
          </p>
          <div className="career-connection-line" aria-hidden="true">
            <i />
            <span>INTEREST</span>
            <b />
            <i />
            <span>STUDY</span>
            <b />
            <i />
            <span>WORK</span>
          </div>
        </div>
        <div className="career-route-ticket">
          <p className="career-eyebrow">YOUR NEXT CONNECTION</p>
          <h2>More than one way forward.</h2>
          <p>A route to explore, not a guaranteed outcome.</p>
          <div className="career-ticket-count">
            <strong>{loading ? '—' : careers.length}</strong>
            <span>careers in this view</span>
          </div>
          <footer>
            <span>NEXUS / MALAYSIA</span>
            <i className="career-barcode" aria-hidden="true" />
          </footer>
        </div>
      </header>
      <div className="career-catalogue-body">
        <div className="career-search-board">
          <Icon name="search" aria-hidden="true" />
          <label className="sr-only" htmlFor="career-search">
            Search careers
          </label>
          <input
            id="career-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Try Software Engineer, Pharmacist, Graphic Designer…"
          />
        </div>
        <section className="career-theme-board" aria-labelledby="career-fields-heading">
          <div className="career-board-heading">
            <div>
              <p className="career-eyebrow">CHOOSE A LINE</p>
              <h2 id="career-fields-heading">Browse by theme</h2>
            </div>
            {!loading && !error && <p aria-live="polite">{resultLabel}</p>}
          </div>
          <div className="career-theme-options" role="group" aria-label="Career categories">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                style={careerThemeStyle(item)}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                <i aria-hidden="true" />
                {item}
              </button>
            ))}
          </div>
        </section>
        <p className="career-catalogue-note">
          Career guidance uses Malaysian sources. O*NET is used only for occupational RIASEC
          interests. Check programme admission and professional registration separately.
        </p>
        <section aria-label="Career results">
          {loading ? (
            <div className="career-card-grid">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Skeleton key={n} variant="card" />
              ))}
            </div>
          ) : error ? (
            <ErrorState title="We couldn’t load careers" message={error.message} onRetry={reload} />
          ) : careers.length ? (
            <div className="career-card-grid">
              {careers.map((career, index) => (
                <CareerCard key={career.id} career={career} stop={index + 1} />
              ))}
            </div>
          ) : (
            <div className="career-empty">
              <Icon name="compass" />
              <h2>No careers found</h2>
              <p>Try another search or explore a different theme.</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setCategory('All');
                }}
              >
                Clear search and filters
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
export default Careers;
