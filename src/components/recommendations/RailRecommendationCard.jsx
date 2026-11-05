import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui';
import { ReasonList } from './ReasonList';
import { MatchScore } from './MatchScore';
import { getSectionReview, normaliseCareerEvidence } from '@/lib/careerEvidence';

export function RailRecommendationCard({ recommendation, type, rank, secondary = false }) {
  const detail = recommendation.detail;
  if (!detail) return null;
  const unmet = (recommendation.reasons ?? []).filter((reason) => !reason.satisfied).length;
  const isCourse = type === 'course';
  const evidence = normaliseCareerEvidence(detail);
  const reference = evidence.references.find(
    (ref) => ref.reference_id === recommendation.matched_reference?.reference_id
  );
  if (secondary && !reference) return null;
  const meta = isCourse
    ? [
        detail.university_name,
        detail.pathway_type,
        detail.duration_months ? `${detail.duration_months} months` : null,
      ]
    : [detail.field];
  return (
    <article className="rail-recommendation-card">
      <div className="rail-rec-topline">
        <span>
          {secondary ? 'INTEREST OVERLAP' : 'RULE MATCH'} / {String(rank).padStart(2, '0')}
        </span>
        {secondary ? (
          <span className="rail-interest-match-label">Exploratory interest overlap</span>
        ) : (
          <MatchScore score={recommendation.match_score} />
        )}
      </div>
      <h3>{detail.name}</h3>
      <p className="rail-rec-meta">{meta.filter(Boolean).join(' · ')}</p>
      <p className="rail-rec-signal">
        {secondary
          ? 'Based on shared RIASEC interests, not an academic rule.'
          : unmet
            ? `${unmet} ${unmet === 1 ? 'condition' : 'conditions'} not yet met · review the details`
            : 'Explore the checked conditions below'}
      </p>
      <details className="rail-match-disclosure">
        <summary>{secondary ? 'Why this interest match' : 'Why this match'}</summary>
        {detail.description && (isCourse || getSectionReview(detail, 'overview')) && (
          <p>{detail.description}</p>
        )}
        {isCourse && (
          <p>
            <strong>Entry requirements: </strong>
            {detail.entry_requirements || 'Check the official course requirements.'}
          </p>
        )}
        {secondary ? (
          <ul className="rail-point-list">
            <li>
              Shares {(recommendation.shared_letters ?? []).join(', ')} with your Holland Code.
            </li>
            <li>
              Reference occupation: {reference.name} ({reference.interest_code}).{' '}
              {reference.scope_note}
            </li>
            <li>
              Nexus exploratory heuristic, not a validated suitability score or admission decision.
            </li>
          </ul>
        ) : (
          <>
            <ReasonList reasons={recommendation.reasons} />
            <p className="rail-rule-id">
              Rule <span>{recommendation.rule_id ?? 'Not provided'}</span>
            </p>
          </>
        )}
      </details>
      <Link
        className="rail-card-link"
        to={
          isCourse
            ? `/courses/${detail.id || recommendation.target_id}`
            : `/careers/${detail.slug || detail.id || recommendation.target_id}`
        }
      >
        {isCourse ? 'Explore course' : 'Explore career pathway'}{' '}
        <Icon name="arrowRight" className="h-4 w-4" />
      </Link>
    </article>
  );
}
