import { normaliseStageReview } from '@/lib/careerEvidence';
const dateLabel = (value) =>
  new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
export function CareerSources({ review, sectionLabel = 'Guidance' }) {
  const checked = normaliseStageReview(review);
  if (!checked) return <p className="career-review-note">{sectionLabel}: review pending.</p>;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return (
    <div className="career-sources">
      <p className="career-review-note">
        {checked.kind === 'nexus_planning'
          ? 'Nexus planning suggestion'
          : checked.status === 'limited'
            ? 'Source coverage limited'
            : 'Sources checked ' + dateLabel(checked.checked_on)}
      </p>
      {checked.limitations.map((note) => (
        <p key={note} className="career-limitation">
          {note}
        </p>
      ))}
      {!!checked.sources.length && (
        <ul className="career-source-links">
          {checked.sources.map((source) => (
            <li key={source.source_id}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title} ↗<span className="sr-only"> (opens in a new tab)</span>
              </a>
              <span>
                {source.publisher} · {source.jurisdiction}
              </span>
              <span>{source.scope}</span>
              {source.access_note && <span>{source.access_note}</span>}
              {source.effective_on && (
                <span className="career-effective-date">
                  {source.effective_on > today ? 'Upcoming · effective ' : 'Effective from '}
                  {dateLabel(source.effective_on)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
