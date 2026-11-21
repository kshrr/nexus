import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LazyMotion, domAnimation, m, useInView, useReducedMotion } from 'motion/react';
import { Icon } from '@/components/ui';
import { NetworkMap, TrainDrawing } from '@/components/landing/RailIllustrations';
import { LandingOpening } from '@/components/landing/LandingOpening';
import { UniversityExplorer } from '@/components/landing/UniversityExplorer';
import '@/styles/rail-landing.css';
import '@/styles/landing-refresh.css';

const ease = [0.22, 1, 0.36, 1];
const stops = [
  {
    id: 'interests',
    number: '01',
    title: 'Discover your interests',
    line: 'Discovery line',
    color: '#D45D48',
    description:
      'Explore the activities and work environments you enjoy with the 36-question RIASEC assessment.',
    action: 'Find my interests',
    to: '/find-your-path/assessment',
  },
  {
    id: 'strengths',
    number: '02',
    title: 'Connect your strengths',
    line: 'Academic line',
    color: '#D1A53A',
    description:
      'Bring your academic results into the picture. See your strongest subjects and how they connect with the routes ahead.',
    action: 'Explore my strengths',
    to: '/find-your-path/academic',
  },
  {
    id: 'courses',
    number: '03',
    title: 'Explore your courses',
    line: 'Learning line',
    color: '#568F9F',
    description:
      'Discover study options shaped by your interests and available academic strengths, with reasons you can understand.',
    action: 'Explore recommendations',
    to: '/recommendations',
  },
  {
    id: 'careers',
    number: '04',
    title: 'See where it could lead',
    line: 'Career line',
    color: '#738A68',
    description:
      'Connect your current education to possible courses and careers. Explore different routes to the kind of work you want to do.',
    action: 'Discover career pathways',
    to: '/careers',
  },
  {
    id: 'scholarships',
    number: '05',
    title: 'Find your opportunity',
    line: 'Opportunity line',
    color: '#A18BBA',
    description:
      'Browse scholarships, check available eligibility requirements and save opportunities for the next step of your journey.',
    action: 'Browse scholarships',
    to: '/scholarships',
  },
];

function Reveal({ children, className = '', delay = 0 }) {
  const reduce = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.65, delay: reduce ? 0 : delay, ease }}
    >
      {children}
    </m.div>
  );
}

function RailButton({ to, children }) {
  return (
    <Link to={to} className="rail-button">
      {children}
      <Icon name="arrowRight" className="h-4 w-4" />
    </Link>
  );
}

function Connections() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState('interests');
  const [paused, setPaused] = useState(false);
  const selected = stops.find((stop) => stop.id === active);
  return (
    <section
      id="features"
      className="rail-connections rail-compact-connections"
      aria-labelledby="rail-connections-title"
    >
      <div className="rail-shell">
        <Reveal className="rail-section-heading">
          <div>
            <span className="rail-eyebrow">THE CONNECTION IS THE POINT</span>
            <h2 id="rail-connections-title">
              Different lines.
              <br />
              <em>One connected future.</em>
            </h2>
          </div>
          <p>
            That’s what Nexus means: connection. A place where what you enjoy, what you’re good at
            and what comes next meet.
          </p>
        </Reveal>
        <div className="rail-map-layout">
          <Reveal className="rail-map">
            <NetworkMap active={active} paused={paused} />
            <div className="rail-map-legend">
              <span>
                <i style={{ background: '#D45D48' }} />
                Interests
              </span>
              <span>
                <i style={{ background: '#D1A53A' }} />
                Strengths
              </span>
              <span>
                <i style={{ background: '#568F9F' }} />
                Possibilities
              </span>
              {!reduce && (
                <button onClick={() => setPaused((value) => !value)}>
                  {paused ? 'Play map trains' : 'Pause map trains'}
                </button>
              )}
            </div>
          </Reveal>
          <div className="rail-map-detail">
            <div className="rail-map-tabs" aria-label="Explore the Nexus network">
              {stops.map((stop) => (
                <button
                  key={stop.id}
                  onClick={() => setActive(stop.id)}
                  aria-pressed={active === stop.id}
                  style={{ '--stop-color': stop.color }}
                >
                  <span>{stop.number}</span>
                  {stop.id === 'strengths'
                    ? 'Academics'
                    : stop.id.charAt(0).toUpperCase() + stop.id.slice(1)}
                  <Icon name="arrowUpRight" className="h-4 w-4" />
                </button>
              ))}
            </div>
            <div
              className="rail-selected-stop"
              style={{ '--stop-color': selected.color }}
              aria-live="polite"
            >
              <span className="rail-eyebrow">{selected.line}</span>
              <h3>{selected.title}</h3>
              <p>{selected.description}</p>
              <Link to={selected.to} className="rail-detail-link">
                {selected.action}
                <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const faqs = [
  [
    'Who is Nexus for?',
    'Nexus is designed for Malaysian students exploring their next education and career steps. Your profile, interests and available results help bring the possibilities together.',
  ],
  [
    'Do I need my exam results to get started?',
    'You can start with the interest assessment. Available academic results add context; without them, you can still explore interest-based guidance.',
  ],
  [
    'What is the RIASEC assessment?',
    'It is a 36-question assessment about the activities and work environments you enjoy. Your Holland Code summarises your strongest interest dimensions. There are no right or wrong answers.',
  ],
  [
    'Can I browse scholarships without an account?',
    'Yes. Scholarships are public to browse. Sign in for profile-based eligibility information and saved opportunities. Always confirm requirements and deadlines on the provider’s own page.',
  ],
];

function Arrival() {
  const reduce = useReducedMotion();
  const platform = useRef(null);
  const inView = useInView(platform, { once: true, amount: 0.2 });
  const [arrived, setArrived] = useState(reduce);
  return (
    <section className="rail-arrival rail-boarding" aria-labelledby="rail-arrival-title">
      <div className="rail-shell rail-arrival-content">
        <Reveal>
          <span className="rail-eyebrow">NEXT STOP: YOUR NEXT CHAPTER</span>
          <h2 id="rail-arrival-title">
            Your future is waiting.
            <br />
            <em>All aboard.</em>
          </h2>
          <p>
            You don’t have to have it all figured out.
            <br />
            You just need somewhere to begin.
          </p>
          <RailButton to="/register">Start your Nexus journey</RailButton>
        </Reveal>
        <Reveal className="rail-boarding-sign">
          <span className="rail-eyebrow">NEXUS CENTRAL / PLATFORM 01</span>
          <div>
            <i /> {arrived ? 'NOW BOARDING' : 'ARRIVING SOON'}
          </div>
          <strong>Your next chapter</strong>
          <span>Bring your curiosity. We’ll help with the connections.</span>
          <a href="#journey" className="rail-detail-link">
            Take another look around <Icon name="arrowRight" className="h-4 w-4" />
          </a>
        </Reveal>
      </div>
      <div ref={platform} className="rail-boarding-scene" aria-hidden="true">
        <div className="rail-boarding-canopy" />
        <div className="rail-boarding-skyline">
          {[90, 145, 110, 180, 125, 85].map((height, index) => (
            <span key={index} style={{ height }} />
          ))}
        </div>
        <m.div
          className="rail-boarding-train"
          initial={reduce ? false : { x: '-110%' }}
          animate={{ x: reduce || inView ? 0 : '-110%' }}
          transition={{ duration: reduce ? 0 : 2.6, ease }}
          onAnimationComplete={() => {
            if (inView) setArrived(true);
          }}
        >
          <TrainDrawing id="boarding-express" doorsOpen={Boolean(arrived)} />
        </m.div>
        <div className="rail-boarding-platform">
          <span>NEXUS EXPRESS</span>
          <span>YOUR JOURNEY STARTS HERE →</span>
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return undefined;
    const frame = window.requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <LazyMotion features={domAnimation} strict>
      <div className="nexus-rail-landing nexus-landing-refresh">
        <LandingOpening stops={stops} />
        <Connections />
        <UniversityExplorer />
        <section className="rail-faq rail-shell" aria-labelledby="rail-faq-title">
          <Reveal>
            <span className="rail-eyebrow">THE INFORMATION DESK</span>
            <h2 id="rail-faq-title">Before you board.</h2>
          </Reveal>
          <div>
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <Arrival />
      </div>
    </LazyMotion>
  );
}

export default Landing;
