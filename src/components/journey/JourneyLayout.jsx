import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@/components/ui';
import { useAuth } from '@/context/useAuth';
import { useRiasecResult } from '@/hooks/useRiasec';
import { useSubjectStrengths } from '@/hooks/useSubjectStrengths';
import { JourneyContext } from './useJourneyState';
import '@/styles/rail-path.css';

/** Journey-only navigation, not a replacement for the global header. */
export function JourneyLayout({ children }) {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  const { profile } = useAuth();
  const riasec = useRiasecResult();
  const academics = useSubjectStrengths();
  const reloadRiasec = riasec.reload;
  const reloadAcademics = academics.reload;
  // The shell persists between stops. Re-read saved results on arrival.
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    reloadRiasec();
    reloadAcademics();
  }, [pathname, reloadRiasec, reloadAcademics]);
  const journey = {
    result: riasec.result,
    strengths: academics.strengths,
    isSpm: profile?.education_level === 'spm',
    hasRiasec: Boolean(riasec.result),
    hasAcademics: academics.strengths.length > 0,
    loadingRiasec: riasec.loading,
    loadingAcademics: academics.loading,
    riasecError: riasec.error,
    academicError: academics.error,
    reloadAcademics,
  };

  return (
    <JourneyContext.Provider value={journey}>
      <div className="path-layout">
        <JourneyRoute journey={journey} />
        <div className="path-content">{children}</div>
      </div>
    </JourneyContext.Provider>
  );
}

function JourneyRoute({ journey }) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const {
    hasRiasec,
    hasAcademics,
    isSpm,
    loadingRiasec,
    loadingAcademics,
    riasecError,
    academicError,
  } = journey;
  const canRecommend = !loadingRiasec && !riasecError && hasRiasec;
  const status = (loading, error, complete) =>
    loading ? 'Checking…' : error ? 'Status unavailable' : complete ? 'Completed' : 'Not started';
  const stops = [
    {
      number: '01',
      label: 'RIASEC test',
      to: hasRiasec ? '/find-your-path/results' : '/find-your-path/assessment',
      active: ['/find-your-path/assessment', '/find-your-path/results'].includes(pathname),
      complete: !loadingRiasec && !riasecError && hasRiasec,
      status: status(loadingRiasec, riasecError, hasRiasec),
    },
    {
      number: '02',
      label: 'Academic analysis',
      to: '/find-your-path/academic',
      active: pathname === '/find-your-path/academic',
      complete: isSpm && !loadingAcademics && !academicError && hasAcademics,
      status: isSpm ? status(loadingAcademics, academicError, hasAcademics) : 'SPM only · bypass',
    },
    {
      number: '03',
      label: 'Nexus recommendations',
      to: '/recommendations',
      active: pathname === '/recommendations',
      complete: false,
      disabled: !canRecommend,
      status: canRecommend ? 'Ready to explore' : 'Complete RIASEC first',
    },
  ];

  return (
    <aside
      className={`path-route-panel${expanded ? ' is-expanded' : ''}`}
      aria-label="Journey destination map"
    >
      <div className="path-route-heading">
        <span className="path-line-badge" aria-hidden="true">
          N
        </span>
        <div>
          <p>NEXUS LINE</p>
          <h2>Your route</h2>
        </div>
        <span className="path-route-direction" aria-hidden="true">
          ↓
        </span>
      </div>
      <button
        type="button"
        className="path-route-toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded(!expanded)}
      >
        <span>
          <span className="path-line-badge" aria-hidden="true">
            N
          </span>{' '}
          Your route · 3 stops
        </span>
        <span aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
      <div id={panelId} className="path-route-body">
        <Link
          className="path-route-overview"
          to="/find-your-path"
          aria-current={pathname === '/find-your-path' ? 'page' : undefined}
          onClick={() => setExpanded(false)}
        >
          Find your path <Icon name="arrowUpRight" className="h-3 w-3" />
        </Link>
        <nav aria-label="Find your path route">
          <ol className="path-route-stops">
            {stops.map((stop) => {
              const content = (
                <>
                  <span className="path-stop-marker" aria-hidden="true">
                    {stop.complete ? <Icon name="check" className="h-3 w-3" /> : stop.number}
                  </span>
                  <span className="path-stop-copy">
                    <strong>{stop.label}</strong>
                    <small>{stop.status}</small>
                    {stop.active && <em>You are here</em>}
                  </span>
                  {stop.active && (
                    <span className="path-mini-train" aria-hidden="true">
                      ▣
                    </span>
                  )}
                </>
              );
              return (
                <li
                  key={stop.number}
                  className={`${stop.active ? 'is-current ' : ''}${stop.complete ? 'is-complete' : ''}`}
                >
                  {stop.disabled ? (
                    <div className="path-stop-link is-unavailable" aria-disabled="true">
                      {content}
                    </div>
                  ) : (
                    <Link
                      className="path-stop-link"
                      to={stop.to}
                      aria-current={stop.active ? 'page' : undefined}
                      onClick={() => setExpanded(false)}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="path-route-legend">
          <span aria-hidden="true" /> Completed stop{' '}
          <span className="path-legend-current" aria-hidden="true" /> Current stop
        </div>
        <p className="path-route-note">
          One connection at a time.
          <br />
          Your future is not a fixed destination.
        </p>
      </div>
    </aside>
  );
}
