import { Link } from 'react-router-dom';
import { Badge, Button, Icon } from '@/components/ui';
import { DeadlineBadge } from './DeadlineBadge';
import { EDUCATION_LEVEL_LABELS } from '@/types';

/**
 * One scholarship in the list (ui-spec §3.10).
 *
 * The field order is FIXED and identical on every card — that positional
 * consistency IS the comparison mechanism. A student scanning a column compares
 * by position, which is why no separate compare tool is built (it has no FR).
 *
 * @param {{
 *   scholarship: any,
 *   match?: { satisfied_count: number, checkable_count: number } | null,
 *   authenticated?: boolean,
 *   saved?: boolean,
 *   onToggleSave?: () => void,
 * }} props
 */
export function ScholarshipCard({ scholarship, match, authenticated, saved, onToggleSave }) {
  const s = scholarship;
  const expired = s.status === 'expired';

  return (
    <article className="group relative flex flex-col gap-4 overflow-hidden rounded-card border border-ink-100 bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-pine-300 hover:shadow-card md:p-6">
      <div className="absolute right-0 top-0 h-16 w-16 translate-x-8 -translate-y-8 rounded-full bg-pine-100 transition-transform duration-200 group-hover:scale-125" aria-hidden="true" />
      {/* 1. name + provider */}
      <div>
        <p className="mb-2 text-caption font-semibold text-pine-700">{s.provider}</p>
        <h3 className="text-h3 font-sans">
          <Link to={`/scholarships/${s.id}`} className="text-ink-900 hover:text-pine-700">
            {s.name}
          </Link>
        </h3>
      </div>

      {/* 2. level + field badges */}
      {(s.education_levels?.length > 0 || s.field_of_study?.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {(s.education_levels ?? []).map((level) => (
            <Badge key={`l-${level}`} variant="neutral">
              {EDUCATION_LEVEL_LABELS[level] ?? level}
            </Badge>
          ))}
          {(s.field_of_study ?? []).map((field) => (
            <Badge key={`f-${field}`} variant="neutral">
              {field}
            </Badge>
          ))}
        </div>
      )}

      {/* 3. funding */}
      {s.funding_amount && <p className="font-serif text-h3 text-pine-900">{s.funding_amount}</p>}

      {/* 4. deadline */}
      <div>
        <DeadlineBadge deadline={s.deadline} expired={expired} />
      </div>

      {/* 5. eligibility summary — authenticated only */}
      {authenticated && match && match.checkable_count > 0 && (
        <p className="rounded-input bg-pine-50 px-3 py-2 text-body-sm text-pine-700">
          <Icon name="check" className="mr-1 inline h-4 w-4" /> You meet{' '}
          <span className="font-medium tabular-nums">
            {match.satisfied_count} of {match.checkable_count}
          </span>{' '}
          requirements we can check
        </p>
      )}

      {/* 6. actions */}
      <div className="mt-auto flex items-center gap-2 border-t border-ink-100 pt-4">
        <Link
          to={`/scholarships/${s.id}`}
          className="inline-flex h-9 items-center gap-1 rounded-pill bg-pine-700 px-4 text-body-sm font-semibold text-white transition-colors hover:bg-pine-900"
        >
          View details <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
        {authenticated && onToggleSave && (
          <Button variant="tertiary" size="sm" onClick={onToggleSave}>
            {saved ? 'Saved' : 'Save'}
          </Button>
        )}
      </div>
    </article>
  );
}

export default ScholarshipCard;
