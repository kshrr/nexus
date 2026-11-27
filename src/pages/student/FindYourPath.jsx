import { useNavigate } from 'react-router-dom';
import { Button, Icon } from '@/components/ui';
import { LoadingState } from '@/components/feedback';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { useJourneyState } from '@/components/journey/useJourneyState';
import { formatDate } from '@/lib/format';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/700.css';

// Decorative previews. They show the shape of each result, not the student's data.
function MiniRadar({ done }) {
  const point = (i, r) => {
    const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
    return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`;
  };
  const ring = (r) => [0, 1, 2, 3, 4, 5].map((i) => point(i, r)).join(' ');
  const shape = [34, 22, 30, 16, 26, 20].map((r, i) => point(i, r)).join(' ');
  return (
    <svg className={`path-mini${done ? ' is-done' : ''}`} viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={ring(40)} className="path-mini-ring" />
      <polygon points={ring(22)} className="path-mini-ring" />
      <polygon points={shape} className="path-mini-shape" />
    </svg>
  );
}

function MiniBars({ done }) {
  return (
    <svg className={`path-mini${done ? ' is-done' : ''}`} viewBox="0 0 100 100" aria-hidden="true">
      {[78, 58, 70, 40].map((width, index) => (
        <g key={width}>
          <rect
            x="8"
            y={16 + index * 22}
            width="84"
            height="10"
            rx="5"
            className="path-mini-ring"
          />
          <rect
            x="8"
            y={16 + index * 22}
            width={width}
            height="10"
            rx="5"
            className="path-mini-shape"
          />
        </g>
      ))}
    </svg>
  );
}

export function FindYourPath() {
  const {
    result,
    strengths,
    isSpm,
    hasRiasec,
    hasAcademics,
    loadingRiasec,
    loadingAcademics,
    riasecError,
    academicError,
  } = useJourneyState();
  const navigate = useNavigate();
  const ready = hasRiasec && !riasecError;
  const total = isSpm ? 2 : 1;
  const done = (ready ? 1 : 0) + (isSpm && hasAcademics && !academicError ? 1 : 0);

  return (
    <div className="path-hub">
      <header className="path-hero">
        <Breadcrumbs tone="light" />
        <div className="path-hero-row">
          <div>
            <h1>Find your path</h1>
            <p>Connect your interests and strengths to what comes next.</p>
          </div>
          <div
            className="path-ticket"
            role="group"
            aria-label={`${done} of ${total} stops completed`}
          >
            <div className="path-ticket-main">
              <span>Stops completed</span>
              <strong>
                {done}
                <em> / {total}</em>
              </strong>
            </div>
            <div className="path-ticket-stub" aria-hidden="true">
              <b>BOARD</b>
              <i />
            </div>
          </div>
        </div>
      </header>

      {loadingRiasec || loadingAcademics ? (
        <LoadingState rows={2} />
      ) : (
        <>
          {(riasecError || academicError) && (
            <p className="path-data-notice" role="status">
              Some journey information could not be loaded. Completion status is unavailable;
              refresh to try again.
            </p>
          )}
          <div className="path-station-grid">
            <article className={`path-station-card${ready ? ' is-complete' : ''}`}>
              <div className="path-card-top">
                <span className="path-station-number">01</span>
                <MiniRadar done={ready} />
              </div>
              <div className="path-card-status">
                {riasecError ? 'Status unavailable' : hasRiasec ? '✓ Completed' : 'Ready to depart'}
              </div>
              <h2>RIASEC test</h2>
              <p>Find the activities and work you enjoy. There are no wrong answers.</p>
              <div className="path-card-meta">
                <Icon name="clock" className="h-4 w-4" />
                <span>
                  {hasRiasec && !riasecError
                    ? `${result.holland_code} · ${formatDate(result.completed_at)}`
                    : '36 questions · about 8 minutes'}
                </span>
              </div>
              <div className="path-card-actions">
                {hasRiasec ? (
                  <>
                    <Button
                      className="path-button"
                      onClick={() => navigate('/find-your-path/results')}
                    >
                      View results <Icon name="arrowRight" />
                    </Button>
                    <Button
                      variant="tertiary"
                      className="path-button-text"
                      onClick={() => navigate('/find-your-path/assessment')}
                    >
                      Retake
                    </Button>
                  </>
                ) : (
                  <Button
                    className="path-button"
                    onClick={() => navigate('/find-your-path/assessment')}
                  >
                    Start assessment <Icon name="arrowRight" />
                  </Button>
                )}
              </div>
            </article>

            <article
              className={`path-station-card${isSpm && hasAcademics && !academicError ? ' is-complete' : ''}${isSpm ? '' : ' is-bypass'}`}
            >
              <div className="path-card-top">
                <span className="path-station-number">02</span>
                <MiniBars done={isSpm && hasAcademics && !academicError} />
              </div>
              <div className="path-card-status">
                {!isSpm
                  ? 'SPM only · bypass this stop'
                  : academicError
                    ? 'Status unavailable'
                    : hasAcademics
                      ? '✓ Completed'
                      : 'Ready to explore'}
              </div>
              <h2>Academic analysis</h2>
              <p>
                {isSpm
                  ? 'See your strongest subjects across three exam periods.'
                  : 'This stop is for SPM leavers. Your journey uses your interests instead.'}
              </p>
              <div className="path-card-meta">
                <Icon name="book" className="h-4 w-4" />
                <span>
                  {!isSpm
                    ? 'Your journey continues without this stop'
                    : hasAcademics && !academicError
                      ? `${strengths.length} ${strengths.length === 1 ? 'subject' : 'subjects'} classified`
                      : 'SPM results · three exam periods'}
                </span>
              </div>
              <div className="path-card-actions">
                {isSpm ? (
                  <Button
                    className="path-button path-button-outline"
                    variant="secondary"
                    onClick={() => navigate('/find-your-path/academic')}
                  >
                    {hasAcademics ? 'View analysis' : 'Add your results'} <Icon name="arrowRight" />
                  </Button>
                ) : (
                  <span className="path-bypass-note">
                    No detour needed. Continue to your next stop.
                  </span>
                )}
              </div>
            </article>
          </div>

          <article className={`path-destination-card${ready ? ' is-ready' : ''}`}>
            <div className="path-destination-heading">
              <span className="path-station-number">03</span>
              <span>Next destination</span>
            </div>
            <div className="path-destination-main">
              <div>
                <h2>Nexus recommendations</h2>
                <p>
                  {ready
                    ? 'Your interests are connected. Explore careers and courses for you.'
                    : 'Complete the RIASEC test to unlock careers and courses for you.'}
                </p>
              </div>
              <Button
                className="path-button path-button-arrival"
                disabled={!ready}
                aria-describedby={!ready ? 'path-recommendation-requirement' : undefined}
                onClick={() => navigate('/recommendations')}
              >
                See my recommendations <Icon name="arrowRight" />
              </Button>
            </div>
            <p className="path-destination-footer" id="path-recommendation-requirement">
              <i aria-hidden="true" />
              {ready
                ? 'Ready · choose your next direction'
                : riasecError
                  ? 'RIASEC status unavailable · refresh to try again'
                  : 'Awaiting connection · complete RIASEC first'}
            </p>
          </article>
        </>
      )}
    </div>
  );
}

export default FindYourPath;
