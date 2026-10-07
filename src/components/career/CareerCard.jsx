import { Link } from 'react-router-dom';
import { Badge, Icon } from '@/components/ui';
import { RIASEC_DIMENSIONS } from '@/types';

const ACCENTS = {
  'Computing & Technology': 'bg-sky',
  Engineering: 'bg-amber-100',
  'Business & Finance': 'bg-lime',
  Science: 'bg-pine-100',
  Healthcare: 'bg-coral',
  Education: 'bg-cream',
  'Creative & Design': 'bg-lilac',
  'Social Sciences': 'bg-slate-100',
};

export function CareerCard({ career }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-card border border-ink-100 bg-surface shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-pine-300 hover:shadow-lift">
      <div className={`h-2 ${ACCENTS[career.field] ?? 'bg-pine-300'}`} />
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-card ${ACCENTS[career.field] ?? 'bg-pine-100'} text-pine-900`}>
            <Icon name="career" />
          </div>
          <Badge>{career.field}</Badge>
        </div>
        <h2 className="text-h2 font-serif text-ink-900">{career.name}</h2>
        <p className="mt-2 flex-1 text-body-sm text-ink-700">{career.description}</p>

        <div className="mt-5 border-t border-ink-100 pt-4">
          <p className="text-caption uppercase tracking-wide text-ink-500">Interest profile</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...(career.riasec_profile ?? '')].map((letter) => (
              <span key={letter} className="rounded-pill bg-pine-50 px-2.5 py-1 text-caption text-pine-700">
                {letter} · {RIASEC_DIMENSIONS[letter]}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-4 text-caption text-ink-500">
          Related study: {(career.education_routes ?? []).slice(0, 2).join(' · ') || 'Explore suitable routes'}
        </p>
        <Link
          to={`/careers/${career.slug || career.id}`}
          className="mt-5 inline-flex min-h-11 items-center justify-between rounded-pill bg-pine-700 px-5 text-body-sm font-semibold text-white transition-colors hover:bg-pine-900"
        >
          Explore pathway <Icon name="arrowRight" className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}

export default CareerCard;

