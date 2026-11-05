import { Link } from 'react-router-dom';
import { Icon, Skeleton } from '@/components/ui';
import { firstName, greeting, pluralise } from '@/lib/format';
import { JourneyTicket } from './JourneyTicket';
import '@/styles/rail-dashboard.css';

/** Shares the live dashboard presentation with isolated visual previews and tests. */
export function JourneyDashboard({
  profile,
  user,
  riasec,
  strengths = [],
  careers = [],
  courses = [],
  loading = false,
  errors = [],
  justCompleted = false,
}) {
  const name = firstName(profile?.full_name) || firstName(user?.email?.split('@')[0]) || 'there';
  const isSpm = profile?.education_level === 'spm';
  const hasAcademics = strengths.length > 0;
  const hasRecommendations = careers.length > 0 || courses.length > 0;
  const recommendationSummary = `${pluralise(careers.length, 'career')} · ${pluralise(courses.length, 'course')}`;
  const steps = [
    {
      label: 'Your profile',
      note: 'Start with you',
      done: Boolean(profile),
      to: '/profile',
      color: '#C7503F',
    },
    {
      label: 'Your interests',
      note: riasec?.holland_code || 'Discover your RIASEC profile',
      done: Boolean(riasec),
      to: riasec ? '/find-your-path/results' : '/find-your-path/assessment',
      color: '#D19E39',
    },
    ...(isSpm
      ? [
          {
            label: 'Your academics',
            note: hasAcademics
              ? pluralise(strengths.length, 'subject') + ' analysed'
              : 'Connect your strengths',
            done: hasAcademics,
            to: '/find-your-path/academic',
            color: '#568F9F',
          },
        ]
      : []),
    {
      label: 'Your possibilities',
      note: hasRecommendations ? recommendationSummary : 'Explore your recommendations',
      done: hasRecommendations,
      to: '/recommendations',
      color: '#7A8D70',
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  const progress = Math.round((completed / steps.length) * 100);
  const next = !riasec
    ? {
        title: 'Your interests are the first connection.',
        body: 'Discover the activities and work environments you enjoy. The 36-question RIASEC assessment takes about eight minutes.',
        to: '/find-your-path/assessment',
        action: 'Start my assessment',
        station: 'Interest assessment',
        symbol: 'target',
      }
    : isSpm && !hasAcademics
      ? {
          title: 'Bring your academic strengths aboard.',
          body: 'Add your exam results so Nexus can consider both what interests you and where you perform well.',
          to: '/find-your-path/academic',
          action: 'Add my results',
          station: 'Academic analysis',
          symbol: 'chart',
        }
      : !hasRecommendations
        ? {
            title: 'See where your connections could lead.',
            body: 'Your profile is ready. Explore course and career recommendations and understand the reasons behind each match.',
            to: '/recommendations',
            action: 'See my recommendations',
            station: 'Recommendations',
            symbol: 'compass',
          }
        : {
            title: 'Find opportunities along your route.',
            body: 'Explore scholarships that could help fund your next step. Review requirements and confirm details with the provider.',
            to: '/scholarships',
            action: 'Browse scholarships',
            station: 'Scholarship discovery',
            symbol: 'scholarship',
          };

  return (
    <div className="journey-dashboard">
      <header className="journey-dashboard-header">
        <div>
          <p className="journey-eyebrow">
            <span>N</span>NEXUS CENTRAL / STUDENT CENTRE
          </p>
          <h1>
            {greeting()}, {name}.
          </h1>
          <p>Your future has connections. Here’s your ticket to explore them.</p>
        </div>
        <Link className="journey-profile-link" to="/profile">
          <Icon name="user" className="h-4 w-4" /> My profile{' '}
          <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
        </Link>
      </header>

      {justCompleted && (
        <p className="journey-success" role="status">
          <Icon name="check" className="h-4 w-4" /> Profile saved. Your journey pass is ready.
        </p>
      )}

      <JourneyTicket
        profile={profile}
        user={user}
        riasec={riasec}
        loading={loading}
        interestError={errors.some((item) => item.area === 'interest profile')}
      />

      {loading ? (
        <section className="journey-loading" aria-label="Loading your journey" aria-busy="true">
          <Skeleton variant="card" className="h-44" />
          <Skeleton variant="card" className="h-52" />
          <span className="sr-only">Checking your interests, strengths and recommendations.</span>
        </section>
      ) : errors.length ? (
        <section className="journey-error" role="alert">
          <h2>Your journey information couldn’t be loaded.</h2>
          <p>Your passenger details are still available. Retry the affected connection below.</p>
          {errors.map((item) => (
            <div key={item.area}>
              <span>
                {item.area}: {item.error.message}
              </span>
              {item.reload && (
                <button type="button" onClick={item.reload}>
                  Retry {item.area}
                  <Icon name="arrowRight" className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </section>
      ) : (
        <>
          <section className="journey-route-board" aria-labelledby="journey-route-title">
            <header>
              <div>
                <span className="journey-label">YOUR JOURNEY LINE</span>
                <h2 id="journey-route-title">A connection at every stop.</h2>
              </div>
              <span className="journey-progress-caption">
                {completed} of {steps.length} foundations complete
              </span>
            </header>
            <div
              className="journey-route-meter"
              role="progressbar"
              aria-label="Journey foundations"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-valuetext={`${completed} of ${steps.length} foundations complete`}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <ol className="journey-stations">
              {steps.map((step, index) => (
                <li
                  key={step.label}
                  className={step.done ? 'is-complete' : ''}
                  style={{ '--station-color': step.color }}
                >
                  <Link to={step.to}>
                    <span className="journey-station-dot" aria-hidden="true">
                      {step.done ? (
                        <Icon name="check" className="h-3 w-3" />
                      ) : (
                        String(index + 1).padStart(2, '0')
                      )}
                    </span>
                    <strong>{step.label}</strong>
                    <small>{step.note}</small>
                    <span className="journey-station-status">
                      {step.done ? 'Completed' : 'To explore'}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <section className="journey-departure" aria-labelledby="journey-departure-title">
            <div className="journey-departure-sign">
              <span>NEXT STOP</span>
              <Icon name={next.symbol} className="h-7 w-7" />
              <strong>{next.station}</strong>
              <small>AT YOUR OWN PACE</small>
            </div>
            <div className="journey-departure-copy">
              <span className="journey-label">YOUR NEXT DEPARTURE</span>
              <h2 id="journey-departure-title">{next.title}</h2>
              <p>{next.body}</p>
            </div>
            <Link to={next.to} className="journey-action">
              {next.action}
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </section>

          <section className="journey-explore" aria-labelledby="journey-explore-title">
            <header>
              <div>
                <span className="journey-label">THE CONNECTIONS YOU’RE MAKING</span>
                <h2 id="journey-explore-title">Your journey, at a glance.</h2>
              </div>
              <Link to="/find-your-path">
                View my path <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </header>
            <div className="journey-explore-grid">
              <ConnectionCard
                number="01"
                icon="target"
                title="Interest profile"
                value={riasec?.holland_code || 'Still to discover'}
                description={
                  riasec
                    ? 'Your Holland Code connects you with work environments you may enjoy.'
                    : 'Start with a little curiosity. Find the activities you enjoy.'
                }
                to={riasec ? '/find-your-path/results' : '/find-your-path/assessment'}
                color="#C7503F"
              />
              <ConnectionCard
                number="02"
                icon="chart"
                title="Academic strengths"
                value={
                  hasAcademics
                    ? pluralise(strengths.length, 'subject') + ' analysed'
                    : isSpm
                      ? 'Add your results'
                      : 'Interests & goals'
                }
                description={
                  hasAcademics
                    ? strengths
                        .slice(0, 2)
                        .map((s) => s.name)
                        .join(' · ')
                    : isSpm
                      ? 'Bring your subject strengths into the picture.'
                      : 'Academic analysis is for SPM students. Your route uses your interests and goals.'
                }
                to={isSpm ? '/find-your-path/academic' : '/find-your-path'}
                color="#568F9F"
              />
              <ConnectionCard
                number="03"
                icon="compass"
                title="Your possibilities"
                value={hasRecommendations ? recommendationSummary : 'Explore what fits'}
                description={
                  hasRecommendations
                    ? 'Your recommendations are ready to explore, with the reasons for each match.'
                    : 'Connect your profile to course and career recommendations.'
                }
                to="/recommendations"
                color="#7A8D70"
              />
            </div>
          </section>
          <div className="journey-help">
            <span>
              <Icon name="scholarship" className="h-4 w-4" /> Looking for support along the way?
            </span>
            <Link to="/scholarships">
              Discover scholarships
              <Icon name="arrowUpRight" className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function ConnectionCard({ number, icon, title, value, description, to, color }) {
  return (
    <Link to={to} className="journey-connection-card" style={{ '--connection-color': color }}>
      <div>
        <span>
          {number} / {title}
        </span>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <h3>{value}</h3>
      <p>{description}</p>
      <span className="journey-connection-arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}
