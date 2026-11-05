import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui';
import { config } from '@/config/env';
import { supabase } from '@/lib/supabase';
import states from '@/assets/maps/malaysia-states.json';

const territoryPins = [
  { name: 'W.P. Kuala Lumpur', x: 182, y: 283, labelX: 46, labelY: 264 },
  { name: 'W.P. Putrajaya', x: 183, y: 297, labelX: 47, labelY: 323 },
  { name: 'W.P. Labuan', x: 652, y: 157, labelX: 552, labelY: 132 },
];
const normalizeState = (state) =>
  (state ?? '')
    .trim()
    .replace(/^W\.?P\.?\s*/i, '')
    .toLowerCase();

export function UniversityExplorer() {
  const mapId = useId();
  const [selected, setSelected] = useState('Selangor');
  const [universities, setUniversities] = useState([]);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      if (!config.isConfigured) {
        setStatus('unavailable');
        return;
      }
      try {
        const { data, error } = await supabase
          .from('universities')
          .select('id, name, type, state')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        if (!cancelled) {
          setUniversities(data ?? []);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const visible = universities.filter(
    (university) => normalizeState(university.state) === normalizeState(selected)
  );
  const selectedLabel = states.find((state) => state.name === selected)?.label;
  const handleKey = (event, name) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelected(name);
    }
  };
  const controlProps = (state) => ({
    role: 'button',
    tabIndex: 0,
    'aria-label': state.label,
    'aria-pressed': selected === state.name,
    'aria-controls': `${mapId}-list`,
    onClick: () => setSelected(state.name),
    onKeyDown: (event) => handleKey(event, state.name),
  });

  return (
    <section id="universities" className="rail-universities" aria-labelledby={`${mapId}-heading`}>
      <div className="rail-shell">
        <div className="rail-section-heading">
          <div>
            <span className="rail-eyebrow">POSSIBILITIES, CLOSER TO HOME</span>
            <h2 id={`${mapId}-heading`}>
              A place for your
              <br />
              <em>next chapter.</em>
            </h2>
          </div>
          <p>
            A familiar place or somewhere new. Explore the universities in the Nexus catalogue, one
            state at a time.
          </p>
        </div>
        <div className="rail-university-layout">
          <div className="rail-malaysia-map">
            <div className="rail-map-topline">
              <span>MALAYSIA / UNIVERSITY EXPLORER</span>
              <span>
                SELECT A STATE <Icon name="arrowUpRight" className="h-3 w-3" />
              </span>
            </div>
            <svg
              viewBox="0 0 920 480"
              aria-label="Select a Malaysian state or federal territory"
              className="rail-malaysia-art"
            >
              <text x="40" y="28" className="rail-geography-label">
                PENINSULAR MALAYSIA
              </text>
              <text x="590" y="28" className="rail-geography-label">
                EAST MALAYSIA
              </text>
              <path d="M385 95Q325 200 390 365" className="rail-sea-divider" />
              <text x="385" y="425" className="rail-sea-label">
                SOUTH CHINA SEA
              </text>
              {states.map((state) => (
                <path
                  key={state.name}
                  d={state.d}
                  fillRule="evenodd"
                  className={`rail-state${selected === state.name ? ' is-selected' : ''}`}
                  {...(state.name.startsWith('W.P.')
                    ? { 'aria-hidden': true }
                    : controlProps(state))}
                >
                  <title>{state.label}</title>
                </path>
              ))}
              <g className="rail-state-labels" aria-hidden="true">
                <text x="130" y="131">
                  Kedah
                </text>
                <text x="161" y="212">
                  Perak
                </text>
                <text x="232" y="151">
                  Kelantan
                </text>
                <text x="279" y="195">
                  Terengganu
                </text>
                <text x="256" y="273">
                  Pahang
                </text>
                <text x="310" y="365">
                  Johor
                </text>
                <text x="130" y="283">
                  Selangor
                </text>
                <text x="532" y="291">
                  Sarawak
                </text>
                <text x="782" y="124">
                  Sabah
                </text>
              </g>
              {territoryPins.map((pin) => {
                const state = states.find((item) => item.name === pin.name);
                return (
                  <g
                    key={pin.name}
                    className={`rail-territory-pin${selected === pin.name ? ' is-selected' : ''}`}
                    {...controlProps(state)}
                  >
                    <path d={`M${pin.x},${pin.y}L${pin.labelX + 30},${pin.labelY - 5}`} />
                    <circle cx={pin.x} cy={pin.y} r="9" />
                    <rect
                      x={pin.labelX - 5}
                      y={pin.labelY - 21}
                      width={pin.name === 'W.P. Labuan' ? 77 : 106}
                      height="33"
                      rx="5"
                    />
                    <text x={pin.labelX + 4} y={pin.labelY}>
                      {state.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="rail-map-bottomline">
              <span>
                <i /> Select a state to explore
              </span>
              <a
                href="https://github.com/dosm-malaysia/data-open/blob/main/datasets/geodata/administrative_1_state.geojson"
                target="_blank"
                rel="noreferrer"
              >
                Map: DOSM
              </a>
            </div>
          </div>
          <div className="rail-university-panel">
            <label htmlFor={`${mapId}-state`}>Choose a state or federal territory</label>
            <select
              id={`${mapId}-state`}
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {states.map((state) => (
                <option key={state.name} value={state.name}>
                  {state.label}
                </option>
              ))}
            </select>
            <div
              id={`${mapId}-list`}
              className="rail-university-results"
              aria-live="polite"
              aria-busy={status === 'loading'}
            >
              <span className="rail-eyebrow">YOUR SELECTED DESTINATION</span>
              <h3>{selectedLabel}</h3>
              {status === 'loading' && <p>Loading the university catalogue…</p>}
              {status === 'unavailable' && (
                <p>
                  The university catalogue is currently unavailable. You can still explore every
                  state on the map.
                </p>
              )}
              {status === 'error' && (
                <div role="alert">
                  <p>We couldn’t load the university catalogue.</p>
                  <button
                    className="rail-detail-link"
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    Try again <Icon name="arrowRight" className="h-4 w-4" />
                  </button>
                </div>
              )}
              {status === 'ready' && (
                <>
                  <p className="rail-university-count">
                    {visible.length} {visible.length === 1 ? 'university' : 'universities'} in the
                    Nexus catalogue
                  </p>
                  {visible.length ? (
                    <ul>
                      {visible.map((university) => (
                        <li key={university.id}>
                          <Icon name="scholarship" className="h-5 w-5" />
                          <div>
                            <strong>{university.name}</strong>
                            <span>
                              {university.type === 'public'
                                ? 'Public university'
                                : university.type === 'private'
                                  ? 'Private university'
                                  : 'University'}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rail-university-empty">
                      No universities listed in Nexus for this state yet. Explore another state to
                      find more options.
                    </p>
                  )}
                </>
              )}
            </div>
            <Link to="/recommendations" className="rail-detail-link">
              Explore your study options <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
            <p className="rail-catalogue-note">
              A growing catalogue, not a complete directory of Malaysian universities.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
