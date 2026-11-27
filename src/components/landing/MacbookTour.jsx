import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { m, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { Icon } from '@/components/ui';
import { universities } from '@/components/landing/universityLogos';

const ease = [0.22, 1, 0.36, 1];
const compact = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 960px)').matches);
const logo = (id) => universities.find((item) => item.id === id)?.logo;

/** Each step: the copy beside the laptop, and the product screen shown inside it. */
const tourSteps = [
  {
    id: 'account',
    title: 'Create your account',
    line: 'Sign up, verify, add a short profile.',
    to: '/register',
    action: 'Create an account',
    path: 'nexus.my/register',
    tab: null,
  },
  {
    id: 'interests',
    title: 'Discover your interests',
    line: '36 questions. No wrong answers.',
    to: '/find-your-path/assessment',
    action: 'Find my interests',
    path: 'nexus.my/find-your-path',
    tab: 'Find Your Path',
  },
  {
    id: 'strengths',
    title: 'Connect your strengths',
    line: 'Add SPM grades. See your best subjects.',
    to: '/find-your-path/academic',
    action: 'Explore my strengths',
    path: 'nexus.my/find-your-path/academic',
    tab: 'Find Your Path',
  },
  {
    id: 'courses',
    title: 'Explore your courses',
    line: 'Ranked for you, with reasons.',
    to: '/recommendations',
    action: 'See recommendations',
    path: 'nexus.my/recommendations',
    tab: 'Courses',
  },
  {
    id: 'careers',
    title: 'See where it leads',
    line: 'A roadmap from study to work.',
    to: '/careers',
    action: 'Explore careers',
    path: 'nexus.my/careers',
    tab: 'Careers',
  },
  {
    id: 'scholarships',
    title: 'Find your funding',
    line: 'Check requirements. Save and track.',
    to: '/scholarships',
    action: 'Browse scholarships',
    path: 'nexus.my/scholarships',
    tab: 'Scholarships',
  },
];

const popIn = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease },
});

function Account() {
  return (
    <div className="mb-split">
      <div>
        <m.h4 {...popIn()}>Create your account</m.h4>
        <m.i className="mb-field" {...popIn(0.08)}>
          Email
        </m.i>
        <m.i className="mb-field" {...popIn(0.14)}>
          Password
        </m.i>
        <m.b className="mb-button" {...popIn(0.22)}>
          Create account
        </m.b>
      </div>
      <div>
        <m.h4 {...popIn(0.3)}>Enter your code</m.h4>
        <div className="mb-code">
          {['4', '8', '1', '9', '0', '2'].map((digit, index) => (
            <m.span
              key={index}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.5 + index * 0.12, ease }}
            >
              {digit}
            </m.span>
          ))}
        </div>
        <m.small {...popIn(1.3)}>Verified. Welcome aboard.</m.small>
      </div>
    </div>
  );
}

const AXES = [
  ['R', 'Realistic', 38],
  ['I', 'Investigative', 88],
  ['A', 'Artistic', 76],
  ['S', 'Social', 62],
  ['E', 'Enterprising', 34],
  ['C', 'Conventional', 28],
];
const CENTER = 100;
const RADIUS = 78;
const spoke = (index, value = 100) => {
  const angle = -Math.PI / 2 + (index / AXES.length) * Math.PI * 2;
  const r = (RADIUS * value) / 100;
  return [CENTER + Math.cos(angle) * r, CENTER + Math.sin(angle) * r];
};
const ring = (value) => AXES.map((_, i) => spoke(i, value).join(',')).join(' ');
const shape = AXES.map(([, , value], i) => spoke(i, value).join(',')).join(' ');

function Interests() {
  return (
    <div className="mb-radar-wrap">
      <div>
        <m.h4 {...popIn()}>Your interest profile</m.h4>
        <m.p className="mb-code-label" {...popIn(0.1)}>
          Holland Code
        </m.p>
        <div className="mb-holland">
          {['I', 'A', 'S'].map((letter, index) => (
            <m.b
              key={letter}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.5 + index * 0.18, ease }}
            >
              {letter}
            </m.b>
          ))}
        </div>
        <m.small {...popIn(1.1)}>Investigative, Artistic, Social</m.small>
      </div>
      <svg
        viewBox="0 0 200 200"
        className="mb-radar"
        role="img"
        aria-label="Example interest radar chart"
      >
        {[100, 66, 33].map((value) => (
          <polygon key={value} points={ring(value)} className="mb-radar-ring" />
        ))}
        {AXES.map(([letter], i) => {
          const [x, y] = spoke(i);
          return (
            <line key={letter} x1={CENTER} y1={CENTER} x2={x} y2={y} className="mb-radar-axis" />
          );
        })}
        <m.polygon
          points={shape}
          className="mb-radar-shape"
          style={{ transformOrigin: '100px 100px' }}
          initial={{ scale: 0.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.1, delay: 0.2, ease }}
        />
        {AXES.map(([letter, , value], i) => {
          const [x, y] = spoke(i, value);
          const [lx, ly] = spoke(i, 118);
          return (
            <g key={letter}>
              <m.circle
                cx={x}
                cy={y}
                r="3.2"
                className="mb-radar-dot"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 + i * 0.05 }}
              />
              <text x={lx} y={ly + 4} textAnchor="middle" className="mb-radar-label">
                {letter}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const SUBJECTS = [
  ['Mathematics', 'A', 90],
  ['Science', 'A-', 82],
  ['English', 'B+', 70],
  ['History', 'B', 58],
];

function Strengths() {
  return (
    <div className="mb-stack">
      <m.h4 {...popIn()}>Your strongest subjects</m.h4>
      {SUBJECTS.map(([name, grade, value], index) => (
        <div className="mb-bar" key={name}>
          <span>{name}</span>
          <i>
            <m.b
              initial={{ width: 0 }}
              animate={{ width: `${value}%` }}
              transition={{ duration: 0.9, delay: 0.15 + index * 0.12, ease }}
            />
          </i>
          <em>{grade}</em>
        </div>
      ))}
    </div>
  );
}

const COURSES = [
  ['Computer Science', 'Universiti Malaya', 'um', 'Investigative'],
  ['Software Engineering', 'Universiti Teknologi Malaysia', 'utm', 'Investigative'],
  ['Digital Media', 'Multimedia University', 'mmu', 'Artistic'],
];

function Courses() {
  return (
    <div className="mb-stack">
      <m.h4 {...popIn()}>Recommended for you</m.h4>
      {COURSES.map(([course, , id, type], index) => (
        <m.div className="mb-course" key={course} {...popIn(0.12 + index * 0.14)}>
          <b>{index + 1}</b>
          <span>
            <strong>{course}</strong>
            <small>Matches {type}</small>
          </span>
          <img src={logo(id)} alt="" />
        </m.div>
      ))}
    </div>
  );
}

const ROAD = ['SPM', 'Diploma', 'Degree', 'Developer'];

function Careers() {
  return (
    <div className="mb-stack">
      <m.h4 {...popIn()}>Roadmap: Software Developer</m.h4>
      <div className="mb-road">
        <i>
          <m.b
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.3, delay: 0.2, ease }}
          />
        </i>
        {ROAD.map((step, index) => (
          <m.span
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 + index * 0.32, ease }}
          >
            <u />
            {step}
          </m.span>
        ))}
      </div>
      <m.div className="mb-chips" {...popIn(1.5)}>
        <span>Computer Science</span>
        <span>Information Technology</span>
      </m.div>
    </div>
  );
}

const CHECKS = [
  ['Malaysian citizen', true],
  ['Studying a degree', true],
  ['Household income', false],
];

function Scholarships() {
  return (
    <div className="mb-stack">
      <m.h4 {...popIn()}>Your eligibility</m.h4>
      {CHECKS.map(([label, met], index) => (
        <m.div
          className={`mb-check${met ? '' : ' is-unknown'}`}
          key={label}
          {...popIn(0.15 + index * 0.16)}
        >
          <span aria-hidden="true">{met ? '✓' : '?'}</span>
          {label}
          <small>{met ? 'Met' : 'Check'}</small>
        </m.div>
      ))}
      <m.b className="mb-button" {...popIn(0.8)}>
        Save scholarship
      </m.b>
    </div>
  );
}

const SCREENS = {
  account: Account,
  interests: Interests,
  strengths: Strengths,
  courses: Courses,
  careers: Careers,
  scholarships: Scholarships,
};

function Laptop({ step }) {
  const Screen = SCREENS[step.id];
  return (
    <div className="mb-laptop" role="region" aria-label="Nexus preview" aria-live="polite">
      <div className="mb-lid">
        <span className="mb-camera" aria-hidden="true" />
        <div className="mb-screen">
          <div className="mb-urlbar" aria-hidden="true">
            <span />
            <span />
            <span />
            <em>{step.path}</em>
          </div>
          <div className="mb-app">
            <div className="mb-nav" aria-hidden="true">
              <b>N</b>
              <strong>Nexus</strong>
              {['Find Your Path', 'Courses', 'Careers', 'Scholarships'].map((tab) => (
                <span key={tab} className={tab === step.tab ? 'is-on' : ''}>
                  {tab}
                </span>
              ))}
            </div>
            <m.div
              key={step.id}
              className="mb-page"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease }}
            >
              <Screen />
            </m.div>
          </div>
        </div>
      </div>
      <div className="mb-base" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}

export function MacbookTour() {
  const reduce = useReducedMotion();
  const track = useRef(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    if (compact()) return;
    setActive(Math.min(tourSteps.length - 1, Math.floor(value * tourSteps.length)));
  });
  const step = tourSteps[active];

  function jump(index) {
    setActive(index);
    const el = track.current;
    if (!el || compact()) return;
    const span = el.offsetHeight - window.innerHeight;
    const top = el.offsetTop + (span * (index + 0.5)) / tourSteps.length;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  }

  return (
    <section id="how" className="st-how" aria-labelledby="st-how-title" ref={track}>
      <div className="st-how-sticky">
        <div className="st-shell st-how-grid">
          <div className="st-how-copy">
            <p className="st-label">How to use Nexus</p>
            <h2 id="st-how-title">Six steps. Start anywhere.</h2>
            <ol className="st-how-steps">
              {tourSteps.map((item, index) => (
                <li key={item.id} className={index === active ? 'is-active' : ''}>
                  <button type="button" onClick={() => jump(index)} aria-pressed={index === active}>
                    <span>{String(index).padStart(2, '0')}</span>
                    <strong>{item.title}</strong>
                    <small>{item.line}</small>
                  </button>
                </li>
              ))}
            </ol>
            <Link to={step.to} className="st-stoplink">
              {step.action} <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
          <Laptop step={step} />
        </div>
      </div>
    </section>
  );
}
