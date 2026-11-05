import { useEffect, useId, useRef } from 'react';
import { m, useReducedMotion } from 'motion/react';

/** Original vector artwork: separately animated trains, doors and scenery. */
export function TrainDrawing({ doorsOpen = false, id = 'train', ...props }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 1060 230" fill="none" aria-hidden="true" {...props}>
      <defs>
        <linearGradient
          id={`${id}-body`}
          x1="0"
          y1="60"
          x2="0"
          y2="200"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFEF7" />
          <stop offset="1" stopColor="#D9E3E9" />
        </linearGradient>
      </defs>
      <ellipse cx="530" cy="214" rx="515" ry="12" fill="#24344B" opacity=".12" />
      {[85, 165, 390, 470, 695, 775].map((x) => (
        <g key={x}>
          <circle cx={x} cy="192" r="17" fill="#24344B" />
          <circle cx={x} cy="192" r="7" fill="#8F9AA8" />
        </g>
      ))}
      <path
        d="M14 68Q14 39 44 39H840Q894 39 933 77L1039 157Q1068 181 1039 191H27Q14 191 14 175Z"
        fill={`url(#${id}-body)`}
        stroke="#27394E"
        strokeWidth="2"
      />
      <path d="M18 55H849Q883 55 907 73" stroke="#C0CAD1" strokeWidth="3" />
      <path d="M15 141H978L1010 163H15Z" fill="#254A77" />
      <path d="M15 163H1010L1023 174H15Z" fill="#467EA0" />
      <path d="M892 64Q915 72 940 96L974 122H889Q870 122 867 107L861 74Z" fill="#25384C" />
      <path d="M883 74L906 78L937 106H891Z" fill="#70949D" />
      {[55, 126, 197, 359, 430, 501, 664, 735, 806].map((x) => (
        <g key={x}>
          <rect x={x} y="77" width="54" height="46" rx="7" fill="#25384C" />
          <rect x={x + 5} y="82" width="44" height="35" rx="4" fill="#8AA5AE" />
          <path d={`M${x + 8} 111L${x + 36} 85`} stroke="#B9CDD1" opacity=".5" strokeWidth="3" />
        </g>
      ))}
      {[269, 574].map((x) => (
        <g key={x}>
          <rect x={x} y="70" width="63" height="119" rx="3" fill="#25384C" />
          <m.g animate={{ x: doorsOpen ? -19 : 0 }} transition={{ duration: reduce ? 0 : 0.6 }}>
            <path d={`M${x + 2} 72H${x + 30}V188H${x + 2}Z`} fill="#E5ECEA" stroke="#7C8A95" />
            <rect x={x + 6} y="81" width="20" height="44" rx="3" fill="#547583" />
            <path d={`M${x + 2} 142H${x + 30}V163H${x + 2}`} fill="#254A77" />
          </m.g>
          <m.g animate={{ x: doorsOpen ? 19 : 0 }} transition={{ duration: reduce ? 0 : 0.6 }}>
            <path d={`M${x + 32} 72H${x + 61}V188H${x + 32}Z`} fill="#E5ECEA" stroke="#7C8A95" />
            <rect x={x + 37} y="81" width="20" height="44" rx="3" fill="#547583" />
            <path d={`M${x + 32} 142H${x + 61}V163H${x + 32}`} fill="#254A77" />
          </m.g>
        </g>
      ))}
      <path d="M345 45V186M650 45V186" stroke="#9EADB7" strokeWidth="2" />
      <path d="M952 177L1012 177" stroke="#F3BE55" strokeWidth="5" strokeLinecap="round" />
      <text x="848" y="184" fill="#254A77" fontSize="9" fontFamily="Arial" letterSpacing="2">
        NEXUS EXPRESS
      </text>
    </svg>
  );
}

export function PlatformBackdrop({ compact = false }) {
  return (
    <svg
      className="rail-platform-art"
      viewBox="0 0 1440 500"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0 380L135 308L267 357L439 274L640 350L846 293L1064 355L1266 271L1440 338V500H0Z"
        fill="#C9D8D4"
      />
      <path d="M0 403L206 369L433 395L696 348L988 399L1185 357L1440 390V500H0Z" fill="#A9C3BE" />
      <circle cx="1215" cy="144" r="56" fill="#E6A364" opacity=".65" />
      <g fill="#D8DDD3" stroke="#889C9A" strokeWidth="1.5">
        <path d="M969 285V189H1045V285M1075 288V221H1135V288M1190 288V177H1290V288" />
        {[987, 1010, 1029, 1205, 1230, 1255, 1275].map((x) => (
          <path key={x} d={`M${x} 201V213M${x} 225V238M${x} 249V262`} />
        ))}
      </g>
      <g stroke="#536968" strokeWidth="2" opacity=".7">
        <path d="M205 244V431M1261 244V431M0 259H1440M0 284H1440" />
        <path d="M180 257H230M1236 257H1286" strokeWidth="6" />
      </g>
      <path d="M0 111L154 78H589L644 110H0Z" fill="#293C4D" />
      <path d="M0 111H642V121H0Z" fill="#65817F" />
      <path d="M107 120V431M548 120V431" stroke="#667E7E" strokeWidth="10" />
      <path d="M126 126H528" stroke="#8AA09B" strokeWidth="4" />
      <g>
        <rect
          x="157"
          y="144"
          width="332"
          height="96"
          rx="2"
          fill="#FAF6E9"
          stroke="#344B57"
          strokeWidth="2"
        />
        <rect x="171" y="158" width="54" height="55" rx="2" fill="#CF5340" />
        <text
          x="198"
          y="196"
          textAnchor="middle"
          fontFamily="Arial"
          fontSize="31"
          fontWeight="700"
          fill="#FFF7E8"
        >
          N
        </text>
        <text x="240" y="183" fill="#24344B" fontSize="22" fontFamily="Arial" fontWeight="700">
          Nexus Central
        </text>
        <text x="240" y="204" fill="#536968" fontSize="11" fontFamily="Arial" letterSpacing="2">
          NEXT STOP: YOUR FUTURE
        </text>
        <path d="M158 226H489" stroke="#CF5340" strokeWidth="8" />
      </g>
      {!compact && (
        <g>
          <path
            d="M99 394H233M110 389V437M224 389V437"
            stroke="#6B4F3F"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path d="M96 369H235M98 382H233" stroke="#A77C58" strokeWidth="9" strokeLinecap="round" />
          <path d="M611 414Q601 388 611 370Q625 382 611 414" fill="#658A71" />
          <path d="M607 417Q580 394 584 380Q609 386 607 417" fill="#8EA477" />
          <path d="M596 414H625L621 438H600Z" fill="#B87555" />
        </g>
      )}
      <path d="M0 438H1440V500H0Z" fill="#D9D3C4" />
      <path d="M0 443H1440" stroke="#E8BE56" strokeWidth="12" />
      <path d="M0 463H1440" stroke="#B3AEA1" strokeWidth="2" />
      <path d="M0 491H1440" stroke="#596975" strokeWidth="3" />
      <g fill="#B4AFA2">
        {Array.from({ length: 48 }, (_, i) => (
          <rect key={i} x={i * 31} y="445" width="2" height="8" />
        ))}
      </g>
    </svg>
  );
}

export function Passenger({ color = '#C7503F', x = 0, y = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-10 2Q-14-17 0-20Q14-20 11-4L7 3Z" fill="#293C4D" />
      <circle cy="-7" r="9" fill="#DDA980" />
      <path d="M-10 8Q0 1 11 8L15 43H-15Z" fill={color} />
      <path d="M-7 43L-8 68M8 43L12 68" stroke="#293C4D" strokeWidth="7" strokeLinecap="round" />
      <path d="M-14 19L-20 40M13 18L24 33" stroke="#DDA980" strokeWidth="5" strokeLinecap="round" />
      <path d="M-14 17Q-32 10-31 39L-15 42Z" fill="#D7B660" />
      <path d="M-12 71H-3M8 71H19" stroke="#293C4D" strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}

export function CarriageScene({ landscapeX = 0 }) {
  const windowId = `nexus-window-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 1200 590" className="rail-carriage-art" fill="none" aria-hidden="true">
      <defs>
        <clipPath id={windowId}>
          <rect x="276" y="126" width="648" height="290" rx="46" />
        </clipPath>
      </defs>
      <rect width="1200" height="590" fill="#D4DED9" />
      <path d="M0 0H1200V72H0Z" fill="#F1EBDC" />
      <path d="M0 74H1200" stroke="#A6B2AC" strokeWidth="3" />
      <rect x="248" y="102" width="704" height="339" rx="59" fill="#7D9495" />
      <rect x="263" y="115" width="674" height="313" rx="49" fill="#283C4C" />
      <g clipPath={`url(#${windowId})`}>
        <rect x="276" y="126" width="648" height="290" fill="#D7E7E3" />
        <circle cx="762" cy="195" r="35" fill="#F0C978" />
        <m.g style={{ x: landscapeX }}>
          <path
            d="M-450 421L-198 226L-20 337L200 155L353 335L574 222L801 389L1022 183L1283 426Z"
            fill="#A6C1BD"
          />
          <path d="M132 216L200 155L263 221L219 202L200 211L176 196Z" fill="#F8F4E8" />
          <path
            d="M-400 437L-192 360L86 386L372 298L588 369L799 309L1073 377L1312 336V460H-400Z"
            fill="#7EAAA0"
          />
          <path d="M-390 395Q-160 322 97 396T544 370T1001 378T1460 345V460H-390Z" fill="#BDCCA4" />
          <path d="M-400 439Q0 355 350 411T1050 379T1600 398" stroke="#80987B" strokeWidth="3" />
          <g fill="#F9F1DE" stroke="#628C83" strokeWidth="2">
            <path d="M539 360V310H604V362Z" />
            <path d="M529 311L571 282L615 311Z" fill="#C38466" />
            <path d="M561 332H584V360M547 322H557V336M591 322H600V336" />
          </g>
          <path d="M722 391V280M709 291H736" stroke="#527A74" strokeWidth="3" />
        </m.g>
      </g>
      <path d="M120 75V515M1080 75V515" stroke="#97A6A0" strokeWidth="3" />
      <path d="M64 520H1136" stroke="#7C8D85" strokeWidth="3" />
      <path d="M0 411Q73 389 161 434L218 590H0Z" fill="#315F70" />
      <path d="M0 415Q76 400 151 444L184 590" stroke="#568191" strokeWidth="7" />
      <path d="M1200 411Q1127 389 1039 434L982 590H1200Z" fill="#315F70" />
      <path d="M1200 415Q1124 400 1049 444L1016 590" stroke="#568191" strokeWidth="7" />
      <path d="M386 38H815" stroke="#B9B2A3" strokeWidth="7" strokeLinecap="round" />
      {[425, 575, 725].map((x) => (
        <g key={x}>
          <path d={`M${x} 40V84`} stroke="#697E7E" strokeWidth="4" />
          <rect
            x={x - 17}
            y="84"
            width="34"
            height="29"
            rx="9"
            stroke="#697E7E"
            strokeWidth="4"
            fill="#F4EEDD"
          />
        </g>
      ))}
      <rect x="57" y="140" width="125" height="92" rx="4" fill="#FFF8E9" />
      <text x="71" y="164" fontFamily="Arial" fontSize="11" fill="#536968" letterSpacing="2">
        NEXT STOP
      </text>
      <text x="71" y="195" fontFamily="Arial" fontSize="18" fontWeight="700" fill="#293C4D">
        Possibility.
      </text>
      <path d="M71 211H166" stroke="#CF5340" strokeWidth="5" />
    </svg>
  );
}

export function NetworkMap({ active = 'interests', paused = false }) {
  const ink = '#293C4D';
  const reduce = useReducedMotion();
  const moving = !reduce && !paused;
  const map = useRef(null);
  useEffect(() => {
    // Start at insertion time; a declarative begin="0s" can precede React's
    // insertion into an SVG whose animation timeline has already started.
    if (moving)
      map.current
        ?.querySelectorAll('animateMotion')
        .forEach((animation) => animation.beginElement?.());
  }, [moving]);
  const routes = [
    {
      path: 'M95 186H305Q335 186 335 216V284Q335 314 365 314H551',
      x: 217,
      y: 186,
      color: '#D45D48',
    },
    {
      path: 'M111 490H328Q365 490 365 453V387Q365 350 402 350H551',
      x: 233,
      y: 490,
      color: '#D1A53A',
    },
    {
      path: 'M552 329H664Q700 329 700 293V186Q700 150 736 150H988',
      x: 817,
      y: 150,
      color: '#568F9F',
    },
    {
      path: 'M550 330H684Q727 330 758 362L817 419Q842 444 880 444H1000',
      x: 885,
      y: 444,
      color: '#738A68',
    },
    {
      path: 'M553 333V477Q553 512 588 512H696Q732 512 732 548V577H918',
      x: 817,
      y: 577,
      color: '#A18BBA',
    },
  ];
  return (
    <svg
      viewBox="0 0 1100 660"
      className="rail-network-art"
      ref={map}
      role="img"
      aria-labelledby="network-title network-desc"
    >
      <title id="network-title">Nexus connection map</title>
      <desc id="network-desc">
        Your interests and academic strengths connect through Nexus to courses, careers and
        scholarships. A schematic journey, not a geographical rail map.
      </desc>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M95 186H305Q335 186 335 216V284Q335 314 365 314H551"
          stroke="#D45D48"
          strokeWidth="13"
        />
        <path
          d="M111 490H328Q365 490 365 453V387Q365 350 402 350H551"
          stroke="#D1A53A"
          strokeWidth="13"
        />
        <path
          d="M552 329H664Q700 329 700 293V186Q700 150 736 150H988"
          stroke="#568F9F"
          strokeWidth="13"
        />
        <path
          d="M550 330H684Q727 330 758 362L817 419Q842 444 880 444H1000"
          stroke="#738A68"
          strokeWidth="13"
        />
        <path
          d="M553 333V477Q553 512 588 512H696Q732 512 732 548V577H918"
          stroke="#A18BBA"
          strokeWidth="13"
        />
        <path
          d="M95 186H305Q335 186 335 216V284Q335 314 365 314H551"
          stroke="#FFF4E2"
          strokeWidth="3"
        />
      </g>
      <g fill="#FCF8ED" stroke={ink} strokeWidth="3">
        {[
          [95, 186],
          [217, 186],
          [111, 490],
          [233, 490],
          [817, 150],
          [982, 150],
          [885, 444],
          [999, 444],
          [817, 577],
          [914, 577],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="9" />
        ))}
        <circle cx="550" cy="331" r="35" fill="#FCF8ED" strokeWidth="6" />
        <circle cx="550" cy="331" r="25" strokeWidth="2" />
      </g>
      <g fontFamily="Arial, sans-serif" fill={ink}>
        <text x="550" y="339" textAnchor="middle" fontSize="23" fontWeight="700">
          N
        </text>
        <text x="550" y="405" textAnchor="middle" fontSize="24" fontWeight="700">
          Nexus Central
        </text>
        <text
          x="76"
          y="149"
          fontSize="24"
          fontWeight="700"
          opacity={active === 'interests' ? 1 : 0.7}
        >
          Your interests
        </text>
        <text
          x="93"
          y="539"
          fontSize="24"
          fontWeight="700"
          opacity={active === 'strengths' ? 1 : 0.7}
        >
          Your strengths
        </text>
        <text
          x="817"
          y="111"
          fontSize="24"
          fontWeight="700"
          opacity={active === 'courses' ? 1 : 0.7}
        >
          Courses
        </text>
        <text
          x="880"
          y="409"
          fontSize="24"
          fontWeight="700"
          opacity={active === 'careers' ? 1 : 0.7}
        >
          Careers
        </text>
        <text
          x="795"
          y="626"
          fontSize="24"
          fontWeight="700"
          opacity={active === 'scholarships' ? 1 : 0.7}
        >
          Scholarships
        </text>
        <text x="340" y="107" fontSize="11" letterSpacing="3" fill="#8F9D99">
          THE NEXUS NETWORK
        </text>
      </g>
      <g transform="translate(768 225) rotate(-5)">
        <rect width="239" height="70" fill="#EDE6D7" rx="3" />
        <text x="20" y="30" fill={ink} fontFamily="Georgia" fontStyle="italic" fontSize="17">
          Different routes.
        </text>
        <text x="20" y="53" fill={ink} fontFamily="Georgia" fontStyle="italic" fontSize="17">
          A future that feels like you.
        </text>
      </g>
      {routes.map((route, index) => (
        <g
          key={`${index}-${moving}`}
          transform={moving ? undefined : `translate(${route.x} ${route.y})`}
          aria-hidden="true"
          className="rail-network-train"
        >
          {moving && (
            <animateMotion
              path={route.path}
              dur={`${14 + index * 2}s`}
              begin="indefinite"
              repeatCount="indefinite"
              rotate="auto"
              keyPoints="0;1;0"
              keyTimes="0;0.5;1"
              calcMode="linear"
            />
          )}
          <rect
            x="-27"
            y="-13"
            width="54"
            height="26"
            rx="7"
            fill="#FCF8ED"
            stroke="#293C4D"
            strokeWidth="2.5"
          />
          <rect x="-19" y="-7" width="9" height="8" rx="2" fill="#568F9F" />
          <rect x="-5" y="-7" width="9" height="8" rx="2" fill="#568F9F" />
          <rect x="9" y="-7" width="9" height="8" rx="2" fill="#568F9F" />
          <path d="M-21 6H21" stroke={route.color} strokeWidth="3" />
        </g>
      ))}
    </svg>
  );
}
