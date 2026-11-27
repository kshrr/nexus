import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  m,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { Icon } from '@/components/ui';
import { PlatformScene } from '@/components/landing/LandingScene';
import { departures, faqs } from '@/components/landing/landingContent';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@/styles/landing-station.css';

const ease = [0.22, 1, 0.36, 1];

export function Reveal({ children, className = '', delay = 0, as = 'div' }) {
  const reduce = useReducedMotion();
  const Tag = m[as];
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, delay: reduce ? 0 : delay, ease }}
    >
      {children}
    </Tag>
  );
}

/* ───────── Departure board ───────── */

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Letters flip through random glyphs before settling, like a split-flap display. */
function Flap({ text, delay = 0 }) {
  const reduce = useReducedMotion();
  const label = text.toUpperCase();
  const [shown, setShown] = useState(label);
  useEffect(() => {
    if (reduce) return undefined;
    let raf;
    const start = performance.now() + delay * 1000;
    const tick = (now) => {
      const step = (now - start) / 45;
      if (step < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (step >= label.length + 5) {
        setShown(label);
        return;
      }
      setShown(
        label
          .split('')
          .map((char, index) =>
            char === ' ' || step > index + 5
              ? char
              : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          )
          .join('')
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [label, delay, reduce]);
  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="st-sr">{text}</span>
    </>
  );
}

function clock() {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date());
}

function BoardClock() {
  const [time, setTime] = useState(clock);
  useEffect(() => {
    const id = window.setInterval(() => setTime(clock()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return <time>{time}</time>;
}

const WORDS = ['SPM', 'STPM', 'matriculation', 'your diploma'];

/** Types a word, pauses, deletes it, then moves on to the next. Static when motion is reduced. */
function TypedWord() {
  const reduce = useReducedMotion();
  const [text, setText] = useState('');
  useEffect(() => {
    if (reduce) return undefined;
    let word = 0;
    let length = 0;
    let deleting = false;
    let timer;
    const tick = () => {
      const target = WORDS[word];
      if (!deleting) {
        length += 1;
        setText(target.slice(0, length));
        if (length === target.length) {
          deleting = true;
          timer = setTimeout(tick, 1700);
          return;
        }
        timer = setTimeout(tick, 85);
      } else {
        length -= 1;
        setText(target.slice(0, length));
        if (length === 0) {
          deleting = false;
          word = (word + 1) % WORDS.length;
          timer = setTimeout(tick, 350);
          return;
        }
        timer = setTimeout(tick, 40);
      }
    };
    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, [reduce]);
  if (reduce) return <span className="st-typed">school</span>;
  return (
    <span className="st-typed" aria-hidden="true">
      {text}
      <i className="st-caret" />
    </span>
  );
}

function FloatingChips() {
  return (
    <>
      <div className="st-chip st-chip-a" aria-hidden="true">
        <span>Holland Code</span>
        <strong>I A S</strong>
      </div>
      <div className="st-chip st-chip-b" aria-hidden="true">
        <span>Scholarship</span>
        <strong>
          <b>✓</b> 2 of 3 met
        </strong>
      </div>
    </>
  );
}

function DepartureBoard() {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-6, 6]), {
    stiffness: 120,
    damping: 18,
  });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [5, -5]), {
    stiffness: 120,
    damping: 18,
  });
  const tilt = (event) => {
    if (reduce || event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - box.left) / box.width - 0.5);
    py.set((event.clientY - box.top) / box.height - 0.5);
  };
  const level = () => {
    px.set(0);
    py.set(0);
  };
  return (
    <div className="st-hero-art" onPointerMove={tilt} onPointerLeave={level}>
      <FloatingChips />
      <m.div
        className="st-board"
        style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
        role="region"
        aria-label="Nexus departures"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.25, ease }}
      >
        <div className="st-board-head">
          <span>Departures</span>
          <span>
            Nexus Central <BoardClock />
          </span>
        </div>
        <ol className="st-board-rows">
          {departures.map((row, index) => {
            const delay = 0.55 + index * 0.16;
            return (
              <m.li
                key={row.id}
                initial={reduce ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay, ease }}
              >
                <Link to={row.to} className="st-board-row">
                  <span className="st-board-no">{index + 1}</span>
                  <span className="st-board-main">
                    <strong>
                      <Flap text={row.destination} delay={delay} />
                    </strong>
                    <small>{row.note}</small>
                  </span>
                  <span className="st-board-tag">{row.tag}</span>
                </Link>
              </m.li>
            );
          })}
        </ol>
        <p className="st-board-foot">
          <i aria-hidden="true" /> Start anywhere.
        </p>
      </m.div>
    </div>
  );
}

/* ───────── Hero ───────── */

const ROUTES = [
  'M-20 70H300Q340 70 340 110V190Q340 230 380 230H1220',
  'M-20 340H420Q460 340 460 300V270Q460 250 500 250H1220',
  'M1220 20H760Q720 20 720 60V120Q720 150 680 150H-20',
];

function RouteBackdrop() {
  return (
    <svg
      className="st-routes"
      viewBox="0 0 1200 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {ROUTES.map((d, index) => (
        <g key={d}>
          <path d={d} className="st-route-base" />
          <path d={d} className="st-route-flow" style={{ '--delay': `${index * -2.2}s` }} />
        </g>
      ))}
    </svg>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const line = (index, content) => (
    <span className="st-line">
      <m.span
        initial={reduce ? false : { y: '108%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, delay: 0.1 + index * 0.1, ease }}
      >
        {content}
      </m.span>
    </span>
  );
  return (
    <section className="st-hero" aria-labelledby="st-hero-title">
      <RouteBackdrop />
      <div className="st-shell st-hero-grid">
        <div className="st-hero-copy">
          <m.p
            className="st-kicker"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            For Malaysian students after SPM and beyond
          </m.p>
          <h1
            id="st-hero-title"
            aria-label="Work out what comes after SPM, STPM, matriculation or your diploma"
          >
            {line(0, 'Work out what')}
            {line(1, 'comes after')}
            {line(2, <TypedWord />)}
          </h1>
          <m.p
            className="st-lede"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease }}
          >
            Interests, results, courses, careers and scholarships on one map.
          </m.p>
          <m.div
            className="st-actions"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.62, ease }}
          >
            <Link to="/register" className="st-button">
              Start your journey <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
            <a href="#how" className="st-textlink">
              See how it works
            </a>
          </m.div>
        </div>
        <DepartureBoard />
      </div>
    </section>
  );
}

/* ───────── FAQ ───────── */

export function InformationDesk() {
  return (
    <section className="st-faq" aria-labelledby="st-faq-title">
      <div className="st-shell st-faq-grid">
        <Reveal>
          <p className="st-label">Information desk</p>
          <h2 id="st-faq-title">Before you board.</h2>
          <p className="st-faq-note">Nexus is a decision aid, not an application portal.</p>
        </Reveal>
        <div>
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Arrival: the one incoming train ───────── */

export function Arrival() {
  const reduce = useReducedMotion();
  const scene = useRef(null);
  const inView = useInView(scene, { once: true, amount: 0.35 });
  const [arrived, setArrived] = useState(false);
  return (
    <section className="st-arrival" aria-labelledby="st-arrival-title" ref={scene}>
      <div className="st-shell st-arrival-grid">
        <Reveal>
          <p className="st-label">Next stop: your next chapter</p>
          <h2 id="st-arrival-title">Ready to board?</h2>
          <div className="st-actions">
            <Link to="/register" className="st-button">
              Start your journey <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
            <Link to="/scholarships" className="st-textlink">
              Browse scholarships first
            </Link>
          </div>
        </Reveal>
        <div className="st-sign" aria-live="polite">
          <span>Platform 1</span>
          <strong>{arrived || reduce ? 'Now boarding' : 'Arriving'}</strong>
        </div>
      </div>
      <PlatformScene inView={inView} arrived={arrived} onArrive={() => setArrived(true)} />
    </section>
  );
}
