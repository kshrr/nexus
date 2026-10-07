import { useMemo, useState } from 'react';
import { Button, Icon, Skeleton } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { CareerCard } from '@/components/career/CareerCard';
import { useCareers } from '@/hooks/useCareers';

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
    () => `${careers.length} ${careers.length === 1 ? 'career' : 'careers'}`,
    [careers.length]
  );

  return (
    <>
      <section className="relative overflow-hidden rounded-modal bg-pine-900 px-5 py-8 text-white md:px-10 md:py-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[42px] border-pine-500/30" aria-hidden="true" />
        <div className="absolute -bottom-12 right-40 h-32 w-32 rounded-full bg-lime/10" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="text-caption font-semibold uppercase tracking-widest text-lime">Career discovery</p>
          <h1 className="mt-3 text-display font-serif text-white">Explore Career Pathways</h1>
          <p className="mt-4 max-w-2xl text-body text-pine-100">
            Discover where different fields can take you and the educational pathways to get there.
          </p>
          <div className="relative mt-7 max-w-2xl">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-ink-500" />
            <label htmlFor="career-search" className="sr-only">Search careers</label>
            <input
              id="career-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Try Software Engineer, Pharmacist, Graphic Designer…"
              className="h-14 w-full rounded-pill border border-white/20 bg-white pl-12 pr-5 text-body text-ink-900 shadow-overlay placeholder:text-ink-500 focus:border-lime focus:outline-none focus:ring-[3px] focus:ring-lime/30"
            />
          </div>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="career-fields-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="career-fields-heading" className="text-h2 font-serif">Browse by field</h2>
            <p className="mt-1 text-body-sm text-ink-500">Start broad, then open a pathway for the detail.</p>
          </div>
          {!loading && <p className="shrink-0 text-caption text-ink-500" aria-live="polite">{resultLabel}</p>}
        </div>
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Career categories">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
              className={`min-h-11 shrink-0 rounded-pill border px-4 text-body-sm font-medium transition-colors ${category === item ? 'border-pine-700 bg-pine-700 text-white' : 'border-ink-300 bg-surface text-ink-700 hover:border-pine-300 hover:bg-pine-50'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-label="Career results">
        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} variant="card" />)}
          </div>
        ) : error ? (
          <ErrorState title="We couldn’t load careers" message={error.message} onRetry={reload} />
        ) : careers.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {careers.map((career) => <CareerCard key={career.id} career={career} />)}
          </div>
        ) : (
          <div className="rounded-modal border border-dashed border-pine-300 bg-pine-50 px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pine-100 text-pine-700"><Icon name="search" /></div>
            <h2 className="mt-4 text-h2 font-serif">No careers found</h2>
            <p className="mx-auto mt-2 max-w-prose text-body-sm text-ink-700">Try searching another career or explore one of the career fields above.</p>
            <Button className="mt-5" variant="secondary" onClick={() => { setSearch(''); setCategory('All'); }}>Clear search and filters</Button>
          </div>
        )}
      </section>
    </>
  );
}

export default Careers;
