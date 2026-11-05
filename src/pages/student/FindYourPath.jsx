import { useNavigate } from 'react-router-dom';
import { Button, Icon } from '@/components/ui';
import { LoadingState } from '@/components/feedback';
import { StationIllustration } from '@/components/journey/StationIllustration';
import { useJourneyState } from '@/components/journey/useJourneyState';
import { formatDate } from '@/lib/format';

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

  return (
    <div className="path-hub">
      <header className="path-hub-hero">
        <div className="path-hub-intro">
          <p className="path-eyebrow">
            <span aria-hidden="true">N</span> NEXUS EXPRESS / JOURNEY GUIDE
          </p>
          <h1>Find your path</h1>
          <p>
            A little curiosity.
            <br />A world of connections.
          </p>
          <p className="path-hero-description">
            Connect your interests and academic strengths to the possibilities ahead. Your next
            chapter starts here.
          </p>
        </div>
        <div className="path-hero-art">
          <StationIllustration />
          <span>DEPARTING FROM YOU. ARRIVING AT POSSIBILITY.</span>
        </div>
      </header>
      <div className="path-service-strip">
        <span>
          <i aria-hidden="true" /> NEXUS LINE · ALL STOPS
        </span>
        <span>INTERESTS → STRENGTHS → POSSIBILITIES</span>
      </div>
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
            <article className="path-station-card">
              <div className="path-card-top">
                <span className="path-station-number">01</span>
                <span className="path-card-kind">INTEREST STATION</span>
                <Icon name="target" />
              </div>
              <div className="path-card-status">
                {riasecError ? 'Status unavailable' : hasRiasec ? '✓ Completed' : 'Ready to depart'}
              </div>
              <h2>RIASEC test</h2>
              <p>
                Discover the kinds of activities and work environments that interest you. There are
                no right or wrong answers.
              </p>
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
            <article className="path-station-card path-station-academic">
              <div className="path-card-top">
                <span className="path-station-number">02</span>
                <span className="path-card-kind">STRENGTH STATION</span>
                <Icon name="chart" />
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
                  ? 'See how your subjects connect. Bring together results from three exam periods to explore your academic strengths.'
                  : 'This stop is for SPM leavers. Pre-university grading differs between programmes, so your journey uses interests and goals instead.'}
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
              <span>NEXT DESTINATION</span>
              <span className="path-destination-code">NX / 03</span>
            </div>
            <div className="path-destination-main">
              <div>
                <h2>Nexus recommendations</h2>
                <p>
                  {ready
                    ? 'Your interests are connected. Explore careers and courses that could become your next chapter.'
                    : 'Complete the RIASEC test to connect your interests with careers and courses. Academic results add another perspective for SPM leavers.'}
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
            <div className="path-destination-footer">
              <span id="path-recommendation-requirement">
                <i aria-hidden="true" />
                {ready
                  ? 'Connection ready · choose your next direction'
                  : riasecError
                    ? 'RIASEC status unavailable · refresh to try again'
                    : 'Awaiting connection · complete RIASEC first'}
              </span>
              <span>YOUR FUTURE, YOUR DIRECTION</span>
            </div>
          </article>
          <p className="path-hub-footnote">
            <Icon name="compass" className="h-4 w-4" /> A guide to possibilities, not a fixed route.
            Explore at your own pace.
          </p>
        </>
      )}
    </div>
  );
}

export default FindYourPath;
