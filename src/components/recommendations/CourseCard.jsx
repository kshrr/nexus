import { Badge, Card } from '@/components/ui';
import { ReasonList } from './ReasonList';
import { MatchScore } from './MatchScore';

/**
 * A recommended course (FR08 / AC-22, ui-spec §3.9).
 *
 * Carries every field §3.4.2 specifies: course name, university, pathway type,
 * entry requirements, and the transparent list of reasons — plus the rule id
 * that produced it.
 *
 * @param {{ recommendation: { match_score: number, rule_id: string, reasons: any[],
 *   detail: { name: string, field_of_study: string, university_name: string | null,
 *   pathway_type: string | null, duration_months: number | null,
 *   entry_requirements: string } } }} props
 */
export function CourseCard({ recommendation }) {
  const { detail, match_score: score, reasons, rule_id: ruleId } = recommendation;
  if (!detail) return null;

  const years = detail.duration_months ? Math.round(detail.duration_months / 12) : null;
  const meta = [
    detail.university_name,
    detail.pathway_type
      ? detail.pathway_type[0].toUpperCase() + detail.pathway_type.slice(1)
      : null,
    years ? `${years} ${years === 1 ? 'year' : 'years'}` : null,
  ].filter(Boolean);

  return (
    <Card as="article" variant="elevated" className="flex flex-col gap-3 transition-transform duration-200 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-h3 font-sans text-ink-900">{detail.name}</h3>
          <p className="mt-0.5 text-body-sm text-ink-500">{meta.join(' · ')}</p>
        </div>
        <MatchScore score={score} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">{detail.field_of_study}</Badge>
      </div>

      <p className="text-body-sm text-ink-700">
        <span className="text-caption text-ink-500">Entry: </span>
        {detail.entry_requirements}
      </p>

      <ReasonList reasons={reasons} />

      <p className="text-caption text-ink-500">
        Rule <span className="tabular-nums">{ruleId}</span>
      </p>
    </Card>
  );
}

export default CourseCard;
