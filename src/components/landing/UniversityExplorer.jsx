import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate, useInView, useReducedMotion } from 'motion/react';
import { Icon } from '@/components/ui';
import { config } from '@/config/env';
import { supabase } from '@/lib/supabase';
import states from '@/assets/maps/malaysia-states.json';
import { KLANG, logoFor, universities as pins } from '@/components/landing/universityLogos';

const W = 920;
const H = 480;
const ASPECT = W / H;
const FULL = { x: 0, y: 0, w: W, h: H };
const CLUSTER_STATES = new Set(['Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya']);

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

const fit = (cx, cy, w) => ({ x: cx - w / 2, y: cy - w / ASPECT / 2, w, h: w / ASPECT });

const boxCache = new Map();
/** Bounding box of a state's main landmass: ignores far-flung islands via percentiles. */
function stateBox(state) {
  if (boxCache.has(state.name)) return boxCache.get(state.name);
  const numbers = (state.d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  const xs = [];
  const ys = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    xs.push(numbers[i]);
    ys.push(numbers[i + 1]);
  }
  const pick = (list, q) => {
    const sorted = [...list].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
  };
  const x0 = pick(xs, 0.03);
  const x1 = pick(xs, 0.97);
  const y0 = pick(ys, 0.03);
  const y1 = pick(ys, 0.97);
  const width = Math.max((x1 - x0) * 1.3, (y1 - y0) * 1.3 * ASPECT, 70);
  const view = fit((x0 + x1) / 2, (y0 + y1) / 2, width);
  boxCache.set(state.name, view);
  return view;
}

function viewFor(name) {
  if (CLUSTER_STATES.has(name)) return { mode: 'cluster', view: fit(KLANG.x, KLANG.y, 50) };
  if (name === 'W.P. Labuan') return { mode: 'state', view: fit(652, 157, 90) };
  const state = states.find((item) => item.name === name);
  return state ? { mode: 'state', view: stateBox(state) } : { mode: 'overview', view: FULL };
}

export function UniversityExplorer() {
  const mapId = useId();
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState('Selangor');
  const [activePin, setActivePin] = useState(null);
  const [mode, setMode] = useState('overview');
  const [open, setOpen] = useState(false);
  const [catalogue, setCatalogue] = useState([]);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const frame = useRef(null);
  const svg = useRef(null);
  const pinEls = useRef(new Map());
  const view = useRef(FULL);
  const motion = useRef(null);
  const inView = useInView(frame, { once: true, amount: 0.25 });

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
          setCatalogue(data ?? []);
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

  // Display position of every pin for the current mode.
  const placed = useMemo(
    () =>
      pins.map((pin) => {
        let shown = true;
        let at = { x: pin.x, y: pin.y };
        if (pin.cluster) {
          if (mode === 'cluster') at = { x: pin.x + (pin.dx ?? 0), y: pin.y };
          else if (mode === 'state') shown = pin.state === selected;
        }
        return { pin, shown, at };
      }),
    [mode, selected]
  );

  const place = useCallback(() => {
    const v = view.current;
    svg.current?.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    pinEls.current.forEach((el) => {
      const x = Number(el.dataset.x);
      const y = Number(el.dataset.y);
      el.style.left = `${((x - v.x) / v.w) * 100}%`;
      el.style.top = `${((y - v.y) / v.h) * 100}%`;
    });
  }, []);
  useLayoutEffect(place, [place, placed]);

  const zoomTo = useCallback(
    (target) => {
      motion.current?.stop();
      const from = { ...view.current };
      motion.current = animate(0, 1, {
        duration: reduce ? 0 : 0.95,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (t) => {
          view.current = {
            x: from.x + (target.x - from.x) * t,
            y: from.y + (target.y - from.y) * t,
            w: from.w + (target.w - from.w) * t,
            h: from.h + (target.h - from.h) * t,
          };
          place();
        },
      });
    },
    [place, reduce]
  );
  useEffect(() => () => motion.current?.stop(), []);

  function choose(name, pinId = null) {
    setActivePin(pinId);
    setSelected(name);
    setOpen(true);
    const next = viewFor(name);
    setMode(next.mode);
    zoomTo(next.view);
  }
  function reset() {
    setActivePin(null);
    setOpen(false);
    setMode('overview');
    zoomTo(FULL);
  }

  const visible = catalogue.filter(
    (university) => normalizeState(university.state) === normalizeState(selected)
  );
  const selectedLabel = states.find((state) => state.name === selected)?.label;
  const handleKey = (event, name) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(name);
    }
  };
  const controlProps = (state) => ({
    role: 'button',
    tabIndex: 0,
    'aria-label': state.label,
    'aria-pressed': open && selected === state.name,
    'aria-controls': `${mapId}-list`,
    onClick: () => choose(state.name),
    onKeyDown: (event) => handleKey(event, state.name),
  });

  return (
    <section id="universities" className="st-map" aria-labelledby={`${mapId}-heading`}>
      <div className="st-shell">
        <div className="st-map-head">
          <div>
            <p className="st-label">Explore</p>
            <h2 id={`${mapId}-heading`}>A place for your next chapter.</h2>
          </div>
          <p>Pick a state or a logo to zoom in.</p>
        </div>
        <div className={`st-map-layout${open ? ' is-open' : ''}`}>
          <div
            ref={frame}
            className={`st-map-frame is-${mode}${inView ? ' is-live' : ''}`}
            data-mode={mode}
          >
            <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="st-map-art">
              <defs>
                <pattern id={`${mapId}-dots`} width="22" height="22" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.3" fill="#c9d6ea" />
                </pattern>
              </defs>
              <rect x="-400" y="-400" width="1800" height="1300" fill={`url(#${mapId}-dots)`} />
              <g className="st-map-labels" aria-hidden="true">
                <text x="40" y="28">
                  PENINSULAR MALAYSIA
                </text>
                <text x="590" y="28">
                  EAST MALAYSIA
                </text>
                <text x="385" y="425" className="st-sea">
                  SOUTH CHINA SEA
                </text>
              </g>
              {states.map((state) => (
                <path
                  key={state.name}
                  d={state.d}
                  fillRule="evenodd"
                  className={`st-state${open && selected === state.name ? ' is-selected' : ''}`}
                  {...(state.name.startsWith('W.P.')
                    ? { 'aria-hidden': true }
                    : controlProps(state))}
                >
                  <title>{state.label}</title>
                </path>
              ))}
              <g className="st-state-names" aria-hidden="true">
                {[
                  ['Kedah', 130, 131],
                  ['Perak', 161, 212],
                  ['Kelantan', 232, 151],
                  ['Terengganu', 279, 195],
                  ['Pahang', 256, 273],
                  ['Johor', 310, 365],
                  ['Sarawak', 532, 291],
                  ['Sabah', 782, 124],
                ].map(([label, x, y]) => (
                  <text key={label} x={x} y={y}>
                    {label}
                  </text>
                ))}
              </g>
              <g className="st-territories">
                {territoryPins.map((pin) => {
                  const state = states.find((item) => item.name === pin.name);
                  return (
                    <g
                      key={pin.name}
                      className={`st-territory${open && selected === pin.name ? ' is-selected' : ''}`}
                      {...controlProps(state)}
                    >
                      <path d={`M${pin.x},${pin.y}L${pin.labelX + 24},${pin.labelY - 3}`} />
                      <circle cx={pin.x} cy={pin.y} r="5" />
                      <rect
                        x={pin.labelX - 3}
                        y={pin.labelY - 12}
                        width={state.label.length * 6 + 12}
                        height="18"
                        rx="4"
                      />
                      <text x={pin.labelX + 4} y={pin.labelY}>
                        {state.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
            <div className="st-pins">
              {placed.map(({ pin, shown, at }, index) => (
                <button
                  type="button"
                  key={pin.id}
                  className={`st-pin${shown ? '' : ' is-hidden'}${activePin === pin.id ? ' is-active' : ''}`}
                  style={{ '--i': index }}
                  aria-label={pin.name}
                  title={pin.name}
                  data-x={at.x}
                  data-y={at.y}
                  tabIndex={shown ? 0 : -1}
                  ref={(el) => {
                    if (el) pinEls.current.set(pin.id, el);
                    else pinEls.current.delete(pin.id);
                  }}
                  onClick={() => choose(pin.state, pin.id)}
                >
                  <img src={pin.logo} alt="" draggable="false" />
                </button>
              ))}
            </div>
            <button type="button" className="st-map-reset" onClick={reset} hidden={!open}>
              Reset view
            </button>
          </div>
          <div className="st-map-panel">
            <div className="st-map-card">
              <label htmlFor={`${mapId}-state`}>State</label>
              <select
                id={`${mapId}-state`}
                value={selected}
                onChange={(event) => choose(event.target.value)}
              >
                {states.map((state) => (
                  <option key={state.name} value={state.name}>
                    {state.label}
                  </option>
                ))}
              </select>
              <div
                id={`${mapId}-list`}
                className="st-map-results"
                aria-live="polite"
                aria-busy={status === 'loading'}
              >
                <h3>{selectedLabel}</h3>
                {status === 'loading' && <p>Loading universities…</p>}
                {status === 'unavailable' && (
                  <p>The university catalogue is unavailable. You can still explore the map.</p>
                )}
                {status === 'error' && (
                  <div role="alert">
                    <p>We couldn’t load the university catalogue.</p>
                    <button
                      type="button"
                      className="st-stoplink"
                      onClick={() => setAttempt((value) => value + 1)}
                    >
                      Try again <Icon name="arrowRight" className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {status === 'ready' && (
                  <>
                    <p className="st-map-count">
                      {visible.length} {visible.length === 1 ? 'university' : 'universities'}
                    </p>
                    {visible.length ? (
                      <ul>
                        {visible.map((university) => {
                          const logo = logoFor(university.name);
                          return (
                            <li key={university.id}>
                              <Link to={`/courses?university=${university.id}`}>
                                {logo ? (
                                  <img src={logo} alt="" />
                                ) : (
                                  <span className="st-map-noimg" aria-hidden="true">
                                    <Icon name="scholarship" className="h-5 w-5" />
                                  </span>
                                )}
                                <div>
                                  <strong>{university.name}</strong>
                                  <span>
                                    {university.type === 'public'
                                      ? 'Public'
                                      : university.type === 'private'
                                        ? 'Private'
                                        : 'University'}
                                    {' · '}View courses
                                  </span>
                                </div>
                                <Icon name="arrowUpRight" className="st-map-go h-4 w-4" />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="st-map-empty">
                        No universities listed in Nexus for this state yet.
                      </p>
                    )}
                  </>
                )}
              </div>
              <Link to="/courses" className="st-stoplink">
                Browse all courses <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
