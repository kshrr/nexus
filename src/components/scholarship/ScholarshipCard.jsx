import { Link } from 'react-router-dom';
import { Badge, Button, Icon } from '@/components/ui';
import { DeadlineBadge } from './DeadlineBadge';
import { EDUCATION_LEVEL_LABELS } from '@/types';
import '@/styles/rail-scholarships.css';

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
export function ScholarshipCard({
  scholarship,
  match,
  authenticated,
  saved,
  onToggleSave,
  saveDisabled = false,
}) {
  const s = scholarship;
  const expired = s.status === 'expired';
  const tags = [
    ...(s.education_levels ?? []).map((level) => ({
      key: `l-${level}`,
      label: EDUCATION_LEVEL_LABELS[level] ?? level,
    })),
    ...(s.field_of_study ?? []).map((field) => ({ key: `f-${field}`, label: field })),
  ];

  return (
    <article className="scholarship-ticket">
      {/* 1. name + provider */}
      <div className="scholarship-ticket-heading">
        <p className="scholarship-ticket-provider">{s.provider}</p>
        <h3>
          <Link to={`/scholarships/${s.id}`}>{s.name}</Link>
        </h3>
      </div>

      {/* 2. level + field badges */}
      {tags.length > 0 && (
        <div className="scholarship-ticket-tags">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag.key} variant="neutral">
              {tag.label}
            </Badge>
          ))}
          {tags.length > 3 && (
            <span className="scholarship-ticket-more">+{tags.length - 3} more</span>
          )}
        </div>
      )}

      {/* 3. funding */}
      <div className="scholarship-ticket-funding">
        <span className="scholarship-small-label">Funding</span>
        <p>{s.funding_amount || 'See provider for coverage'}</p>
      </div>

      {/* 4. deadline */}
      <div className="scholarship-ticket-deadline">
        <Icon name="clock" className="h-4 w-4" />
        <DeadlineBadge deadline={s.deadline} expired={expired} />
      </div>

      {/* 5. eligibility summary — authenticated only */}
      {authenticated && match && match.checkable_count > 0 && (
        <p className="scholarship-ticket-match">
          <Icon name="check" className="h-4 w-4" />
          <span>
            {match.satisfied_count}/{match.checkable_count} checked requirements met
          </span>
        </p>
      )}

      {/* 6. actions */}
      <div className="scholarship-ticket-actions">
        <Link to={`/scholarships/${s.id}`} className="scholarship-detail-link">
          View details <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
        {authenticated && onToggleSave && (
          <Button
            variant="tertiary"
            size="sm"
            className="scholarship-save"
            onClick={onToggleSave}
            aria-pressed={Boolean(saved)}
            disabled={saveDisabled}
          >
            <Icon name="bookmark" className="h-4 w-4" />
            {saved ? 'Saved' : 'Save'}
          </Button>
        )}
      </div>
    </article>
  );
}

export default ScholarshipCard;
