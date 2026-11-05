import { m } from 'motion/react';
import { Passenger } from './RailIllustrations';

const navy = '#293C4D';

function StationShell({ children, underground = false }) {
  return (
    <svg className="rail-station-art" viewBox="0 0 1200 720" fill="none" aria-hidden="true">
      <rect width="1200" height="720" fill={underground ? '#BDC9C9' : '#E6E7D9'} />
      <path d="M0 0H1200L830 175H360Z" fill="#E9E4D6" />
      <path d="M0 720L350 424H850L1200 720Z" fill="#D7D1BF" />
      <path d="M0 425H1200" stroke="#A7B2AC" strokeWidth="3" />
      <g stroke="#B5B5A5" strokeWidth="2">
        <path d="M600 424L210 720M600 424L-280 720M600 424L990 720M600 424L1480 720M0 634H1200M145 529H1054M254 462H944" />
      </g>
      <g stroke="#C8C5B4" strokeWidth="3">
        <path d="M600 175L135 0M600 175L1070 0M0 82H1200M263 144H941" />
      </g>
      <path d="M104 0L104 720M1096 0V720" stroke="#718580" strokeWidth="30" />
      <path d="M340 175V447M859 175V447" stroke="#8C9D95" strokeWidth="13" />
      <path
        d="M283 102L348 125M884 111L953 80"
        stroke="#FFFCEF"
        strokeWidth="13"
        strokeLinecap="round"
      />
      {children}
    </svg>
  );
}

function StationSign({ title, subtitle, x = 360, y = 150, width = 480, direction = '→' }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height="77" rx="3" fill={navy} />
      <rect width="9" height="77" fill="#E6BC55" />
      <text x="26" y="32" fontFamily="Arial" fontSize="21" fill="#FAF6E9" fontWeight="700">
        {title}
      </text>
      <text x="26" y="54" fontFamily="Arial" fontSize="11" fill="#CFD8D0" letterSpacing="1.5">
        {subtitle}
      </text>
      <text x={width - 49} y="48" fontSize="33" fill="#E6BC55" fontFamily="Arial">
        {direction}
      </text>
    </g>
  );
}

function TicketMachine({ x, color = '#D45D48' }) {
  return (
    <g transform={`translate(${x} 280)`}>
      <path d="M0 0H124L143 214H-14Z" fill="#68807F" stroke="#405865" strokeWidth="2" />
      <path d="M0 0L19-17H138L124 0Z" fill="#ADC0B8" />
      <path d="M124 0L138-17L158 194L143 214Z" fill="#486770" />
      <rect x="9" y="13" width="108" height="28" rx="2" fill={color} />
      <text
        x="63"
        y="32"
        textAnchor="middle"
        fontSize="11"
        fill="#FFF8EA"
        fontFamily="Arial"
        fontWeight="700"
      >
        TICKETS / きっぷ
      </text>
      <rect x="17" y="57" width="82" height="66" rx="3" fill="#243C4D" />
      <rect x="24" y="63" width="68" height="49" rx="2" fill="#DBE8DD" />
      <path d="M34 81H81M34 90H65" stroke="#789987" strokeWidth="5" />
      <rect x="27" y="141" width="62" height="8" rx="2" fill="#253C4B" />
      <circle cx="96" cy="155" r="5" fill="#E7BC58" />
      <rect x="25" y="179" width="67" height="18" rx="2" fill="#314B56" />
    </g>
  );
}

function Gateway({ x }) {
  return (
    <g transform={`translate(${x} 423)`}>
      <path d="M0 15L87 0L142 32L46 49Z" fill="#9FB5AE" stroke="#657F7D" strokeWidth="2" />
      <path d="M0 15L46 49V165L0 129Z" fill="#779994" />
      <path d="M46 49L142 32V151L46 165Z" fill="#BCCAC1" />
      <path d="M46 63L142 46V71L46 90Z" fill="#537988" />
      <circle cx="95" cy="117" r="14" fill="#FAF7E8" />
      <path d="M87 117H104M98 111L104 117L98 123" stroke="#4D826C" strokeWidth="3" />
      <path d="M70 50L93 45L108 50L84 55Z" fill="#C9503F" />
      <path d="M17 100L17 160L-55 182V130Z" fill="#CA6B54" opacity=".9" />
    </g>
  );
}

export function TicketHallScene() {
  return (
    <StationShell>
      <rect x="355" y="251" width="495" height="172" fill="#CAD5CA" />
      <g stroke="#BAC6B9" strokeWidth="2">
        <path d="M356 290H849M356 327H849M356 364H849M356 401H849M402 250V423M461 250V423M520 250V423M579 250V423M638 250V423M697 250V423M756 250V423M815 250V423" />
      </g>
      <StationSign title="Your journey starts here" subtitle="TICKET HALL / 改札口" />
      <TicketMachine x={390} />
      <TicketMachine x={548} color="#568F9F" />
      <rect x="730" y="285" width="95" height="116" fill="#FBF6E7" stroke="#A6B6AB" />
      <text x="746" y="307" fontFamily="Arial" fontSize="11" fill={navy}>
        YOUR ROUTE
      </text>
      <path d="M751 325V373H801M751 337H785V351H801" stroke="#CF5946" strokeWidth="4" />
      <circle cx="751" cy="326" r="5" fill="#FBF6E7" stroke={navy} strokeWidth="2" />
      <Gateway x={228} />
      <Gateway x={457} />
      <Gateway x={686} />
      <Gateway x={915} />
      <Passenger x={832} y={373} scale={1.35} color="#C68F63" />
      <Passenger x={379} y={494} scale={1.65} />
      <rect x="145" y="633" width="886" height="13" rx="3" fill="#E6BC55" />
      <g fontFamily="Arial" fill={navy}>
        <text x="527" y="689" fontSize="14" letterSpacing="4">
          WELCOME TO NEXUS
        </text>
      </g>
    </StationShell>
  );
}

export function UndergroundScene() {
  return (
    <StationShell underground>
      <path d="M352 224H849V419H352Z" fill="#354F5C" />
      <path d="M411 247H794V419H411Z" fill="#223A4A" />
      <path d="M468 269H738V419H468Z" fill="#1A2E40" />
      <path d="M603 419L399 720H0L354 425Z" fill="#62828B" />
      <path d="M603 419L840 720H1200L849 425Z" fill="#62828B" />
      <path d="M470 425L182 720M738 425L1019 720" stroke="#D9C785" strokeWidth="12" />
      <path d="M493 425L274 720M713 425L925 720" stroke="#ADC0BE" strokeWidth="5" />
      <path d="M509 425L323 720M697 425L875 720" stroke="#29485A" strokeWidth="4" />
      <path d="M0 718L354 425H849L1200 718" stroke="#889F9D" strokeWidth="3" />
      <StationSign
        title="Platform 02 · Possibilities"
        subtitle="FIND YOUR CONNECTION / のりば"
        width={515}
        x={344}
        y={144}
      />
      <g fill="#E9E8DB" stroke="#889D9A" strokeWidth="2">
        <rect x="209" y="183" width="73" height="313" />
        <rect x="939" y="183" width="73" height="313" />
      </g>
      <g fontFamily="Arial" fill={navy} fontWeight="700">
        <text x="225" y="221" fontSize="24">
          02
        </text>
        <text x="955" y="221" fontSize="24">
          03
        </text>
      </g>
      <path d="M209 244H282M939 244H1012" stroke="#D45D48" strokeWidth="9" />
      <path d="M360 124H844M396 234H805M454 264H750" stroke="#F6EFCC" strokeWidth="7" />
      <Passenger x={286} y={449} scale={1.2} color="#CC9B69" />
      <Passenger x={980} y={433} scale={1.15} color="#315F70" />
      <g transform="translate(794 352)">
        <rect width="115" height="68" rx="3" fill="#F8F3E5" />
        <text x="15" y="24" fontFamily="Arial" fontSize="12" fill={navy}>
          NEXT STOP
        </text>
        <text x="15" y="48" fontFamily="Georgia" fontSize="16" fill="#C7503F">
          Your potential.
        </text>
      </g>
    </StationShell>
  );
}

export function InformationDeskScene() {
  return (
    <StationShell>
      <StationSign title="A little guidance, this way" subtitle="INFORMATION / ご案内" />
      <rect x="349" y="254" width="502" height="180" rx="3" fill="#D1DCCD" />
      <g transform="translate(403 281)">
        <rect width="180" height="114" fill="#FBF8EA" stroke="#859D91" />
        <path d="M23 33H70V83H146M30 87H109V43H154" stroke="#C95844" strokeWidth="6" />
        <path d="M54 17V56H155" stroke="#568F9F" strokeWidth="5" />
        <circle cx="109" cy="58" r="11" fill="#FBF8EA" stroke={navy} strokeWidth="3" />
        <text x="20" y="104" fill={navy} fontSize="9" fontFamily="Arial">
          NEXUS CONNECTIONS
        </text>
      </g>
      <g transform="translate(626 282)" fill="#66867B">
        <rect width="161" height="12" rx="3" />
        <rect y="25" width="122" height="7" rx="3" />
        <rect y="46" width="143" height="7" rx="3" />
        <rect y="68" width="111" height="7" rx="3" />
      </g>
      <Passenger x={629} y={386} scale={1.65} color="#315F70" />
      <path d="M357 417H846L872 465H332Z" fill="#7D9290" stroke="#506C74" strokeWidth="2" />
      <path d="M333 466H871V580H333Z" fill="#B5C9C0" />
      <path d="M333 466H871V490H333Z" fill="#6D9890" />
      <rect x="480" y="507" width="234" height="42" rx="3" fill="#FBF5E6" />
      <text
        x="595"
        y="535"
        textAnchor="middle"
        fontFamily="Arial"
        fontSize="18"
        fill={navy}
        fontWeight="700"
      >
        INFORMATION i
      </text>
      <rect x="525" y="382" width="88" height="49" rx="3" fill={navy} />
      <path d="M569 431V444M549 444H590" stroke={navy} strokeWidth="5" />
      <path d="M729 436L797 436L803 449H735Z" fill="#F0D08B" />
      <Passenger x={824} y={479} scale={1.9} />
      <g transform="translate(224 405)">
        <path
          d="M0 121V36M0 61Q-50 50-43 19Q-11 20 0 61M0 89Q46 60 41 35Q7 41 0 89M0 37Q29 7 9-15Q-8 2 0 37"
          fill="#7D9B7B"
          stroke="#62896E"
          strokeWidth="3"
        />
        <path d="M-28 120H30L22 177H-20Z" fill="#C28E69" />
      </g>
    </StationShell>
  );
}

export function StationExitScene() {
  return (
    <svg viewBox="0 0 1200 260" className="rail-exit-art" fill="none" aria-hidden="true">
      <path d="M0 260L457 32H743L1200 260Z" fill="#EEE5CE" />
      <path d="M0 210H1200M178 155H1022M316 96H884" stroke="#D4CEB9" strokeWidth="2" />
      <circle cx="635" cy="57" r="33" fill="#E8C071" />
      <g fill="#B4C9BD" stroke="#91ABA0" strokeWidth="2">
        <path d="M66 200V66H176V200M214 200V107H276V200M947 200V59H1048V200M1085 200V112H1165V200" />
        <path d="M80 86H161M80 113H161M80 140H161M962 80H1034M962 111H1034M962 140H1034" />
      </g>
      <path d="M455 207V41H476V207M735 207V41H755V207" fill="#6D8B82" />
      <rect x="438" y="15" width="334" height="57" rx="3" fill={navy} />
      <text
        x="605"
        y="51"
        textAnchor="middle"
        fontFamily="Arial"
        fontSize="21"
        fill="#FAF6E9"
        fontWeight="700"
      >
        YOUR FUTURE →
      </text>
      <Passenger x={591} y={149} scale={0.95} color="#315F70" />
      <Passenger x={641} y={161} scale={0.78} />
      <path d="M0 229H1200V260H0Z" fill="#D2CBB9" />
      <path d="M0 236H1200" stroke="#E5BC58" strokeWidth="10" />
    </svg>
  );
}

export function CardTapIllustration() {
  return (
    <svg className="rail-entry-art" viewBox="0 0 800 450" fill="none" aria-hidden="true">
      <ellipse cx="403" cy="407" rx="289" ry="24" fill="#DDDACA" />
      <path d="M161 143L265 113L320 143L214 178Z" fill="#9AAFA9" stroke="#5B7777" strokeWidth="2" />
      <path d="M161 143L214 178V388L161 352Z" fill="#6D8F8D" />
      <path d="M214 178L320 143V360L214 388Z" fill="#C5D1C5" />
      <path d="M214 182L320 147V189L214 225Z" fill="#46728A" />
      <path d="M490 143L594 113L649 143L544 178Z" fill="#9AAFA9" stroke="#5B7777" strokeWidth="2" />
      <path d="M490 143L544 178V388L490 352Z" fill="#6D8F8D" />
      <path d="M544 178L649 143V360L544 388Z" fill="#C5D1C5" />
      <path d="M544 182L649 147V189L544 225Z" fill="#46728A" />
      <m.path
        d="M320 217L399 241V341L320 319Z"
        fill="#C95846"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0.08 }}
        transition={{ delay: 1.05, duration: 0.45 }}
        style={{ originX: 0 }}
      />
      <m.path
        d="M490 217L412 241V341L490 319Z"
        fill="#C95846"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0.08 }}
        transition={{ delay: 1.05, duration: 0.45 }}
        style={{ originX: 1 }}
      />
      <path d="M536 151L566 141L590 152L558 163Z" fill={navy} />
      <m.ellipse
        cx="559"
        cy="153"
        rx="13"
        ry="5"
        initial={{ fill: '#D9AA5B' }}
        animate={{ fill: '#7DAA81' }}
        transition={{ delay: 0.8, duration: 0.2 }}
      />
      <circle cx="592" cy="272" r="25" fill="#FAF7E8" />
      <m.path
        d="M579 272H605M596 264L605 272L596 280"
        stroke="#497B69"
        strokeWidth="5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.95 }}
      />
      <m.g
        initial={{ x: 74, y: -70, rotate: -12 }}
        animate={{ x: [74, 0, 0, 35], y: [-70, 0, 0, -50], rotate: [-12, 0, 0, 4] }}
        transition={{ duration: 1.5, times: [0, 0.4, 0.68, 1], ease: 'easeInOut' }}
        style={{ originX: 0.7, originY: 0.4 }}
      >
        <rect x="523" y="90" width="107" height="66" rx="6" fill="#293C4D" />
        <rect x="535" y="102" width="22" height="22" rx="11" fill="#CF5946" />
        <text x="546" y="118" textAnchor="middle" fontFamily="Arial" fontSize="14" fill="#FFF7E8">
          N
        </text>
        <text x="566" y="119" fontFamily="Arial" fontSize="13" fontWeight="700" fill="#FFF7E8">
          NEXUS
        </text>
        <text x="536" y="142" fontFamily="Arial" fontSize="7" letterSpacing="1.2" fill="#CFD8D0">
          YOUR FUTURE PASS
        </text>
      </m.g>
      <path d="M336 396H471" stroke="#E2B453" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
