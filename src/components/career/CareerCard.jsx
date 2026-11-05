import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui';
import { getSectionReview, normaliseCareerEvidence } from '@/lib/careerEvidence';
import { careerThemeStyle } from './careerThemes';
export function CareerCard({ career, stop }) {
  const evidence = normaliseCareerEvidence(career);
  const overview = getSectionReview(career, 'overview');
  return (
    <article className="career-ticket-card" style={careerThemeStyle(career.field)}>
      <div className="career-card-top">
        <span className="career-theme-label">
          <i aria-hidden="true" />
          {career.field || 'Other'}
        </span>
        <Icon name="career" aria-hidden="true" />
      </div>
      <p className="career-stop-label">
        CAREER LINE{stop ? ' / ' + String(stop).padStart(2, '0') : ''}
      </p>
      <h2>{career.name}</h2>
      {overview ? (
        <p className="career-card-description">{career.description}</p>
      ) : (
        <p className="career-review-note">
          Content review pending. Explore only as an unverified career direction.
        </p>
      )}
      {!!evidence.references.length && (
        <div className="career-card-interests">
          <p>Reference interests · U.S. occupations</p>
          <div>
            {evidence.references.map((ref) => (
              <span key={ref.reference_id} title={ref.name + ' — ' + ref.scope_note}>
                {ref.mapping_kind === 'example' ? 'Example: ' : ''}
                {ref.interest_code.split('').join(' · ')}
              </span>
            ))}
          </div>
        </div>
      )}
      <footer>
        <span>
          {evidence.status === 'limited'
            ? 'Source coverage limited'
            : overview
              ? 'Source-informed overview'
              : 'Review pending'}
        </span>
        <Link
          to={'/careers/' + (career.slug || career.id)}
          aria-label={'Explore ' + career.name + ' pathway'}
        >
          Explore pathway <Icon name="arrowRight" />
        </Link>
      </footer>
    </article>
  );
}
export default CareerCard;
