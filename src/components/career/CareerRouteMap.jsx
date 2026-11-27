import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHECKED_ON } from '@/data/careerRoutes';
import '@/styles/career-route-map.css';

const checkedLabel = new Intl.DateTimeFormat('en-MY', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(CHECKED_ON));

function SourceLinks({ sources }) {
  if (!sources?.length) return null;
  return (
    <ul className="route-sources">
      {sources.map((source) => (
        <li key={source.id}>
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.title} ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
          <span>{source.publisher}</span>
        </li>
      ))}
    </ul>
  );
}

const MAX_PROGRAMMES = 5;

function Programmes({ courses, pathwayType }) {
  if (!pathwayType) return null;
  const matches = courses.filter((course) => course.pathway_type === pathwayType);
  if (!matches.length) return null;
  const more = matches.length - MAX_PROGRAMMES;
  return (
    <div className="route-programmes">
      <p>Programmes in Nexus</p>
      <ul>
        {matches.slice(0, MAX_PROGRAMMES).map((course) => (
          <li key={course.id}>
            <Link to={`/courses/${course.id}`}>
              {course.name}
              {course.university_name ? ` · ${course.university_name}` : ''}
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Link to="/courses">
          +{more} more {pathwayType} {more === 1 ? 'programme' : 'programmes'} in the course
          catalogue →
        </Link>
      )}
    </div>
  );
}

function StepDetail({ step, number, courses }) {
  return (
    <li className={`route-step route-step--${step.kind}`}>
      <span className="route-step__number" aria-hidden="true">
        {String(number).padStart(2, '0')}
      </span>
      <div>
        <h4>{step.label}</h4>
        {step.duration && <p className="route-step__duration">{step.duration}</p>}
        {step.apply && (
          <p className="route-step__apply">
            <strong>Apply:</strong> {step.apply}
          </p>
        )}
        {step.note && <p>{step.note}</p>}
        <Programmes courses={courses} pathwayType={step.pathwayType} />
        <SourceLinks sources={step.sources} />
      </div>
    </li>
  );
}

/**
 * Branching route map from the student's starting level to a career
 * (data: src/data/careerRoutes.js, logic: src/lib/careerRoutes.js).
 *
 * The diagram is a set of buttons, one per route; the panel below lists the
 * selected route in full as text, so the map never carries information that
 * is only available visually.
 *
 * @param {{ map: ReturnType<typeof import('@/lib/careerRoutes').buildCareerRouteMap>,
 *   careerName: string, courses?: any[] }} props
 */
export function CareerRouteMap({ map, careerName, courses = [] }) {
  const firstCommon = map.routes.find((r) => r.status === 'common') ?? map.routes[0];
  const [selectedId, setSelectedId] = useState(firstCommon?.id);
  const detailId = useId();
  const selected = map.routes.find((r) => r.id === selectedId) ?? firstCommon;
  const branching = map.routes.length > 1;

  const steps = [...selected.steps, ...map.afterDegree];

  return (
    <div className="route-map">
      <div className="route-map__scroll">
        <div
          className={`route-map__diagram${branching ? ' is-branching' : ''}`}
          role="group"
          aria-label={`Routes from ${map.start.label} to ${careerName}`}
        >
          <div className="route-node route-node--start">
            <span className="route-node__kicker">You are here</span>
            <strong>{map.start.label}</strong>
            {!branching && selected.workExit && (
              <span className="route-node__exit">or start work</span>
            )}
          </div>
          <span className="route-link" aria-hidden="true" />

          {branching && (
            <>
              <ul className="route-map__lanes">
                {map.routes.map((route) => {
                  const active = route.id === selected.id;
                  return (
                    <li key={route.id} className={`route-lane${active ? ' is-active' : ''}`}>
                      <button
                        type="button"
                        aria-pressed={active}
                        aria-controls={detailId}
                        onClick={() => setSelectedId(route.id)}
                        className={`route-lane__button route-lane__button--${route.status}`}
                      >
                        <span className="route-lane__status">{route.statusLabel}</span>
                        <strong>{route.label}</strong>
                        {route.duration && (
                          <span className="route-lane__time">{route.duration}</span>
                        )}
                        {route.workExit && (
                          <span className="route-lane__exit">↳ can lead to work</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <span className="route-link" aria-hidden="true" />
            </>
          )}

          <div className="route-node route-node--degree">
            <span className="route-node__kicker">Degree</span>
            <strong>{map.degree.label}</strong>
            <span className="route-node__time">{map.degree.duration}</span>
          </div>

          {!!map.afterDegree.length && (
            <>
              <span className="route-link" aria-hidden="true" />
              <div className="route-node route-node--after">
                <span className="route-node__kicker">After the degree</span>
                <ol>
                  {map.afterDegree.map((step) => (
                    <li key={step.label}>{step.label}</li>
                  ))}
                </ol>
              </div>
            </>
          )}

          <span className="route-link" aria-hidden="true" />
          <div className="route-node route-node--career">
            <span className="route-node__kicker">Career</span>
            <strong>{careerName}</strong>
          </div>
        </div>
      </div>

      {branching && (
        <p className="route-map__hint">
          {map.routes.length} routes from {map.start.label}. Select a route to see its steps.
        </p>
      )}

      <section id={detailId} className="route-detail" aria-live="polite">
        <div className="route-detail__heading">
          <div>
            <p className="career-eyebrow">
              {branching ? `ROUTE / ${selected.statusLabel.toUpperCase()}` : 'YOUR ROUTE'}
            </p>
            <h3>
              {map.start.label} → {branching ? `${selected.label} → ` : ''}Degree → {careerName}
            </h3>
          </div>
          {selected.totalLabel && <p className="route-detail__total">{selected.totalLabel}</p>}
        </div>

        <ol className="route-steps">
          {steps.map((step, index) => (
            <StepDetail key={step.label} step={step} number={index + 1} courses={courses} />
          ))}
        </ol>

        {selected.workExit && (
          <div className="route-exit">
            <h4>{selected.workExit.label}</h4>
            <p>{selected.workExit.note}</p>
            <SourceLinks sources={selected.workExit.sources} />
          </div>
        )}

        <p className="career-review-note">
          Typical full-time durations, sources checked {checkedLabel}. Entry requirements, places
          and credit transfer are decided by each institution and body; confirm with them before you
          apply.
        </p>
      </section>
    </div>
  );
}

export default CareerRouteMap;
