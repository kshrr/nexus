import { Link } from 'react-router-dom';
import { Badge, Card, Icon } from '@/components/ui';
import { ReasonList } from './ReasonList';
import { MatchScore } from './MatchScore';

/**
 * A recommended career (FR07, ui-spec §3.9). Carries the match score, the
 * reason list (satisfied and unsatisfied), and the id of the rule that produced
 * it so the suggestion is fully traceable.
 *
 * @param {{ recommendation: { match_score: number, rule_id: string,
 *   reasons: any[], detail: { name: string, field: string, description?: string,
 *   riasec_profile?: string } } }} props
 */
export function CareerCard({ recommendation }) {
  const { detail, match_score: score, reasons, rule_id: ruleId } = recommendation;
  if (!detail) return null;

  return (
    <Card as="article" variant="elevated" className="flex flex-col gap-3 transition-transform duration-200 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-h3 font-sans text-ink-900">{detail.name}</h3>
          <p className="mt-0.5 text-body-sm text-ink-500">
            {detail.field}
            {detail.riasec_profile ? ` · ${detail.riasec_profile}` : ''}
          </p>
        </div>
        <MatchScore score={score} />
      </div>

      {detail.description && <p className="text-body-sm text-ink-700">{detail.description}</p>}

      <ReasonList reasons={reasons} />

      <Link
        to={`/careers/${detail.slug || detail.id}`}
        className="inline-flex min-h-11 items-center justify-between rounded-pill border border-ink-300 px-4 text-body-sm font-semibold text-pine-700 hover:border-pine-300 hover:bg-pine-50"
      >
        Explore career pathway <Icon name="arrowRight" className="h-4 w-4" />
      </Link>

      <p className="text-caption text-ink-500">
        Rule <span className="tabular-nums">{ruleId}</span>
      </p>
    </Card>
  );
}

/**
 * A career surfaced by RIASEC profile overlap rather than by a rule (§9.6).
 * Labelled differently so the student knows which signal produced it.
 */
export function SecondaryCareerCard({ entry }) {
  const { detail, shared_letters: shared } = entry;
  return (
    <Card as="article" variant="elevated" className="flex flex-col gap-2 transition-transform duration-200 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-h3 font-sans text-ink-900">{detail.name}</h3>
          <p className="mt-0.5 text-body-sm text-ink-500">
            {detail.field} · {detail.riasec_profile}
          </p>
        </div>
        <Badge variant="info">Interest match</Badge>
      </div>
      {detail.description && <p className="text-body-sm text-ink-700">{detail.description}</p>}
      <p className="text-body-sm text-ink-700">
        Shares {shared.join(', ')} with your Holland Code. This came from the career&rsquo;s own
        interest profile, not from a rule about your results.
      </p>
      <Link
        to={`/careers/${detail.slug || detail.id}`}
        className="mt-2 inline-flex min-h-11 items-center justify-between rounded-pill border border-ink-300 px-4 text-body-sm font-semibold text-pine-700 hover:border-pine-300 hover:bg-pine-50"
      >
        Explore career pathway <Icon name="arrowRight" className="h-4 w-4" />
      </Link>
    </Card>
  );
}

export default CareerCard;
