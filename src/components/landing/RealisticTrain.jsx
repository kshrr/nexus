import { m, useReducedMotion } from 'motion/react';

// A sleek electric express: two coaches and a long-nosed power car, drawn with a continuous
// glazing band, glossy body shading, recessed doors, a pantograph and bogies. Original artwork.
const HEAD_X = 1120;
const COACHES = [
  { x: 14, w: 552, name: 'tail' },
  { x: 574, w: 538, name: 'mid' },
];
const ORANGE = '#f26a21';
const NAVY = '#0a2342';

const coachD = (x, w) =>
  `M${x} 78Q${x} 56 ${x + 22} 56H${x + w - 22}Q${x + w} 56 ${x + w} 78V204Q${x + w} 222 ${x + w - 18} 222H${x + 18}Q${x} 222 ${x} 204Z`;
// Long, tapered nose: the roof falls away in one smooth line to a rounded tip.
const headD = `M${HEAD_X} 78Q${HEAD_X} 56 ${HEAD_X + 22} 56H${HEAD_X + 150}C${HEAD_X + 250} 56 ${HEAD_X + 318} 92 ${HEAD_X + 352} 150C${HEAD_X + 368} 178 ${HEAD_X + 374} 196 ${HEAD_X + 356} 210L${HEAD_X + 340} 222H${HEAD_X + 18}Q${HEAD_X} 222 ${HEAD_X} 204Z`;

const pillars = (x, w) => {
  const list = [];
  for (let px = x + 112; px < x + w - 40; px += 64) list.push(px);
  return list;
};

function Door({ x, open, reduce }) {
  const move = open ? 20 : 0;
  const t = { duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] };
  return (
    <g>
      <rect x={x} y="72" width="60" height="140" rx="5" fill="#1a2733" />
      <m.g animate={{ x: -move }} transition={t}>
        <rect x={x + 2} y="74" width="28" height="136" rx="3" fill="#f4f7fa" />
        <rect x={x + 6} y="82" width="20" height="50" rx="4" fill="#2c4259" />
        <rect x={x + 6} y="82" width="20" height="50" rx="4" fill="#ffd98a" opacity=".2" />
        <rect x={x + 27} y="74" width="3" height="136" fill={ORANGE} />
      </m.g>
      <m.g animate={{ x: move }} transition={t}>
        <rect x={x + 30} y="74" width="28" height="136" rx="3" fill="#f4f7fa" />
        <rect x={x + 34} y="82" width="20" height="50" rx="4" fill="#2c4259" />
        <rect x={x + 34} y="82" width="20" height="50" rx="4" fill="#ffd98a" opacity=".2" />
        <rect x={x + 30} y="74" width="3" height="136" fill={ORANGE} />
      </m.g>
    </g>
  );
}

function Bogie({ cx, moving }) {
  return (
    <g>
      <rect x={cx - 52} y="224" width="104" height="14" rx="5" fill="#222c37" />
      {[-26, 26].map((dx) => (
        <g key={dx}>
          <circle cx={cx + dx} cy="239" r="17" fill="#161d25" />
          <circle cx={cx + dx} cy="239" r="9.5" fill="#aab4bf" />
          <g
            className={`st-wheel${moving ? ' is-spinning' : ''}`}
            style={{ transformOrigin: `${cx + dx}px 239px` }}
          >
            <path
              d={`M${cx + dx - 8} 239H${cx + dx + 8}M${cx + dx} 231V247`}
              stroke="#5a6672"
              strokeWidth="3"
            />
          </g>
          <circle cx={cx + dx} cy="239" r="3" fill="#161d25" />
        </g>
      ))}
    </g>
  );
}

export function RealisticTrain({ id = 'train', doorsOpen = false, moving = false, ...props }) {
  const reduce = useReducedMotion();
  const cars = [
    ...COACHES.map((car) => ({ ...car, d: coachD(car.x, car.w) })),
    { x: HEAD_X, w: 374, name: 'head', d: headD },
  ];
  return (
    <svg viewBox="0 0 1500 270" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient
          id={`${id}-body`}
          x1="0"
          y1="56"
          x2="0"
          y2="222"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffffff" />
          <stop offset=".5" stopColor="#edf2f7" />
          <stop offset="1" stopColor="#c3cfdc" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#355270" />
          <stop offset="1" stopColor="#0f1f30" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-beam`}>
          <stop stopColor="#fff6cf" stopOpacity=".9" />
          <stop offset="1" stopColor="#fff6cf" stopOpacity="0" />
        </radialGradient>
        {cars.map((car) => (
          <clipPath id={`${id}-clip-${car.name}`} key={car.name}>
            <path d={car.d} />
          </clipPath>
        ))}
      </defs>

      <ellipse cx="750" cy="258" rx="740" ry="8" fill="#0a2342" opacity=".18" />

      {/* Gangways between cars */}
      {[566, 1112].map((x) => (
        <g key={x}>
          <rect x={x} y="68" width="9" height="150" fill="#1d2630" />
          {[84, 104, 124, 144, 164, 184, 204].map((y) => (
            <path key={y} d={`M${x} ${y}H${x + 9}`} stroke="#3a4552" />
          ))}
        </g>
      ))}

      {/* Pantograph */}
      <g>
        <path
          d="M790 56L812 22H850L872 56"
          stroke="#2f3a46"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M806 22H856" stroke="#2f3a46" strokeWidth="6" strokeLinecap="round" />
        <rect x="750" y="50" width="150" height="8" rx="3" fill="#8794a1" />
      </g>

      {cars.map((car) => (
        <g key={car.name}>
          <path d={car.d} fill={`url(#${id}-body)`} stroke="#27323d" strokeWidth="1.6" />
          <g clipPath={`url(#${id}-clip-${car.name})`}>
            <rect x={car.x} y="56" width={car.w} height="10" fill="#dde5ee" />
            <rect x={car.x} y="152" width={car.w} height="24" fill={ORANGE} />
            <rect x={car.x} y="176" width={car.w} height="30" fill={NAVY} />
            <rect x={car.x} y="206" width={car.w} height="16" fill="#27323d" />
            <rect
              x={car.x + 60}
              y="56"
              width="170"
              height="166"
              fill={`url(#${id}-shine)`}
              opacity=".45"
            />
          </g>
        </g>
      ))}

      {/* Continuous glazing band with pillars, and doors */}
      {COACHES.map((car) => (
        <g key={car.name}>
          <rect
            x={car.x + 20}
            y="80"
            width={car.w - 40}
            height="58"
            rx="12"
            fill={`url(#${id}-glass)`}
          />
          <rect
            x={car.x + 20}
            y="80"
            width={car.w - 40}
            height="58"
            rx="12"
            fill="#ffd98a"
            opacity=".1"
          />
          <path
            d={`M${car.x + 60} 136L${car.x + 120} 82H${car.x + 138}L${car.x + 78} 136Z`}
            fill="#fff"
            opacity=".14"
          />
          {pillars(car.x, car.w).map((px) => (
            <rect key={px} x={px} y="80" width="6" height="58" fill="#f1f5f9" />
          ))}
          <Door x={car.x + 104} open={doorsOpen} reduce={reduce} />
          <Door x={car.x + car.w - 168} open={doorsOpen} reduce={reduce} />
          <text
            x={car.x + car.w / 2}
            y="196"
            textAnchor="middle"
            fill="#fff"
            fontFamily="Barlow Condensed, Arial, sans-serif"
            fontWeight="700"
            fontSize="16"
            letterSpacing="4"
          >
            NEXUS EXPRESS
          </text>
        </g>
      ))}

      {/* Power car */}
      <g transform={`translate(${HEAD_X} 0)`}>
        <rect x="20" y="80" width="150" height="58" rx="12" fill={`url(#${id}-glass)`} />
        <rect x="20" y="80" width="150" height="58" rx="12" fill="#ffd98a" opacity=".1" />
        <rect x="92" y="80" width="6" height="58" fill="#f1f5f9" />
        <Door x={196} open={doorsOpen} reduce={reduce} />
        <path
          d="M270 62C318 62 346 92 364 132L372 148H270Z"
          fill={`url(#${id}-glass)`}
          stroke="#0d1a28"
          strokeWidth="2.5"
        />
        <path d="M284 72C312 74 332 92 344 124L350 142H304Z" fill="#fff" opacity=".18" />
        <text
          x="40"
          y="196"
          fill="#fff"
          fontFamily="Barlow Condensed, Arial, sans-serif"
          fontWeight="700"
          fontSize="16"
          letterSpacing="4"
        >
          NEXUS
        </text>
        <path d="M356 168C366 180 368 192 358 204L346 212H300L350 168Z" fill={ORANGE} />
        <rect x="344" y="186" width="22" height="7" rx="3.5" fill="#fff6cf" />
        <m.ellipse
          cx="392"
          cy="190"
          rx="80"
          ry="30"
          fill={`url(#${id}-beam)`}
          animate={reduce ? undefined : { opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </g>

      <rect x="14" y="222" width="1470" height="6" fill="#1d2630" />
      {[84, 478, 650, 1030, 1210, 1380].map((cx) => (
        <Bogie key={cx} cx={cx} moving={moving} />
      ))}
    </svg>
  );
}

export default RealisticTrain;
