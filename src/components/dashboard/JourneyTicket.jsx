import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { EDUCATION_LEVEL_LABELS, RIASEC_DIMENSIONS } from '@/types';

/** A presentation of the student's existing profile; no invented ticket identifiers. */
export function JourneyTicket({ profile, user, riasec, loading, interestError }) {
  const name = profile?.full_name?.trim() || 'Your name';
  const level = EDUCATION_LEVEL_LABELS[profile?.education_level] || 'Not set yet';
  const industry = profile?.target_industry || 'Not set yet';
  const code = riasec?.holland_code;
  const dimensions = code
    ?.split('')
    .map((letter) => RIASEC_DIMENSIONS[letter])
    .filter(Boolean);
  const joined = formatDate(profile?.created_at);

  return (
    <article className="journey-ticket" aria-labelledby="journey-ticket-title">
      <div className="journey-ticket-main">
        <header className="journey-ticket-header">
          <div>
            <TrainEmblem />
            <h2 id="journey-ticket-title">Nexus Express</h2>
          </div>
          <span>PERSONAL JOURNEY PASS</span>
        </header>

        <div className="journey-ticket-body">
          <div className="journey-ticket-passenger">
            <span className="journey-label">PASSENGER NAME</span>
            <p>{name}</p>
            <span className="journey-ticket-contact">
              {profile?.email || user?.email || 'Email not available'}
            </span>
          </div>

          <dl className="journey-ticket-route">
            <div>
              <dt>DEPARTING FROM</dt>
              <dd>{level}</dd>
            </div>
            <div className="journey-ticket-connection" aria-hidden="true">
              <span />
              <Icon name="arrowRight" />
              <span />
            </div>
            <div>
              <dt>HEADING TOWARDS</dt>
              <dd>
                {profile?.career_goal?.trim() || 'Your possibilities'}
                {!profile?.career_goal?.trim() && (
                  <small>Your destination is yours to discover.</small>
                )}
              </dd>
            </div>
          </dl>

          <dl className="journey-ticket-details">
            <div>
              <dt>EDUCATION LEVEL</dt>
              <dd>{level}</dd>
            </div>
            <div>
              <dt>TARGET INDUSTRY</dt>
              <dd>{industry}</dd>
            </div>
            <div>
              <dt>JOURNEY STARTED</dt>
              <dd>{joined || 'Date not available'}</dd>
            </div>
          </dl>
        </div>

        <footer className="journey-ticket-footer">
          <span>
            <i /> YOUR FUTURE. YOUR PATH. YOUR NEXUS.
          </span>
          <Link to="/profile">
            Update passenger details <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
          </Link>
        </footer>
      </div>

      <div className="journey-ticket-stub">
        <span className="journey-ticket-stub-brand">
          N<span>NEXUS CENTRAL</span>
        </span>
        <span className="journey-label">YOUR HOLLAND CODE</span>
        <p className={`journey-ticket-code${!code ? ' is-empty' : ''}`}>
          {loading ? '…' : interestError ? '—' : code || '— — —'}
        </p>
        <p className="journey-ticket-dimensions">
          {loading
            ? 'Checking your interest profile'
            : interestError
              ? 'Interest profile unavailable'
              : dimensions?.length
                ? dimensions.join(' · ')
                : 'Discover what makes you, you.'}
        </p>
        {!loading && !interestError && (
          <Link
            to={code ? '/find-your-path/results' : '/find-your-path/assessment'}
            className="journey-ticket-result-link"
          >
            {code ? 'View my results' : 'Discover my interests'}
            <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </Link>
        )}
        <div className="journey-ticket-stamp" aria-hidden="true">
          YOUR PATH.
          <br />
          YOUR PACE.
        </div>
        <div className="journey-ticket-bars" aria-hidden="true" />
      </div>
    </article>
  );
}

function TrainEmblem() {
  return (
    <svg width="35" height="30" viewBox="0 0 35 30" fill="none" aria-hidden="true">
      <path
        d="M7 5Q7 1 17.5 1T28 5V21Q28 26 23 26H12Q7 26 7 21Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M7 14H28M12 26L9 29M23 26L26 29M17.5 4V12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="20" r="1.5" fill="currentColor" />
      <circle cx="23" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
}
