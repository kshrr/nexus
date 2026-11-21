import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { m, useReducedMotion } from 'motion/react';
import { Icon } from '@/components/ui';
import studentHeroImage from '@/assets/images/nexus-students-hero.webp';
import '@/styles/landing-opening.css';

const problems = [
  {
    number: '01',
    question: 'Which path fits me?',
    detail: 'Your interests, grades and ambitions do not always point in the same direction.',
    symbol: '✳',
  },
  {
    number: '02',
    question: 'Where can I study?',
    detail: 'Courses, universities and career routes are spread across too many places.',
    symbol: '⌁',
  },
  {
    number: '03',
    question: 'How can I afford it?',
    detail: 'Finding relevant scholarships can feel like another search entirely.',
    symbol: '↗',
  },
];

const featureCopy = {
  interests: {
    label: 'Start with you',
    screenTitle: 'Discover what drives you',
    screenHint: 'Your interests can be the start of a direction.',
  },
  strengths: {
    label: 'See your strengths',
    screenTitle: 'See your academic picture',
    screenHint: 'Understand where your subjects can take you.',
  },
  courses: {
    label: 'Find a study route',
    screenTitle: 'Explore courses made relevant',
    screenHint: 'Compare possibilities with reasons you can follow.',
  },
  careers: {
    label: 'Look further ahead',
    screenTitle: 'Picture a possible pathway',
    screenHint: 'Connect the next step to what could come after.',
  },
  scholarships: {
    label: 'Open up opportunity',
    screenTitle: 'Find support for the journey',
    screenHint: 'Keep promising opportunities within reach.',
  },
};

function Hero() {
  return (
    <section className="nexus-opening-hero" aria-labelledby="rail-hero-title">
      <div className="rail-shell">
        <div className="nexus-opening-topline">
          <span className="rail-line-token">N</span>
          <span>YOUR FUTURE. YOUR PATH. YOUR NEXUS.</span>
          <span className="nexus-opening-topline-end">MADE FOR MALAYSIAN STUDENTS</span>
        </div>
        <div className="nexus-opening-hero-grid">
          <div className="nexus-opening-copy">
            <span className="nexus-opening-kicker">
              <i /> YOUR NEXT CHAPTER STARTS HERE
            </span>
            <h1 id="rail-hero-title">
              Your future has <em>more than one way forward.</em>
            </h1>
            <p>
              Bring your interests, strengths and ambitions together. Explore courses, careers and
              scholarships with a clearer idea of what fits you.
            </p>
            <div className="nexus-opening-actions">
              <Link to="/register" className="nexus-opening-primary">
                Find your path <Icon name="arrowUpRight" className="h-4 w-4" />
              </Link>
              <a href="#student-questions" className="nexus-opening-secondary">
                See how Nexus helps <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div className="nexus-opening-footnote">
              <span>01</span> START WITH CURIOSITY. GO SOMEWHERE NEW.
            </div>
          </div>
          <div className="nexus-opening-art">
            <img
              className="nexus-hero-image"
              src={studentHeroImage}
              alt="Students exploring their futures together on a laptop"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StudentProblems() {
  return (
    <section
      id="student-questions"
      className="nexus-student-problems"
      aria-labelledby="student-questions-title"
      aria-label="Questions students carry"
    >
      <div className="rail-shell nexus-problems-layout">
        <div className="nexus-problems-intro">
          <span className="rail-eyebrow">BEFORE THE JOURNEY BEGINS</span>
          <h2 id="student-questions-title">
            So many choices. <em>Where do you start?</em>
          </h2>
          <p>
            It is normal to have questions about what comes after school. Nexus brings the pieces
            together so you can explore with more confidence.
          </p>
          <div className="nexus-problems-route" aria-hidden="true">
            <i />
            <span />
            <i />
            <span />
            <i />
          </div>
        </div>
        <div className="nexus-problem-cards">
          {problems.map((problem) => (
            <article className="nexus-problem-card" key={problem.number}>
              <div className="nexus-problem-card-top">
                <span>{problem.number} / THE QUESTION</span>
                <b aria-hidden="true">{problem.symbol}</b>
              </div>
              <h3>{problem.question}</h3>
              <p>{problem.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScreenVisual({ active }) {
  switch (active) {
    case 'strengths':
      return (
        <div className="nexus-screen-chart" aria-label="Illustrative academic subject chart">
          <div>
            <span>Mathematics</span>
            <i style={{ '--bar-width': '88%' }} />
          </div>
          <div>
            <span>English</span>
            <i style={{ '--bar-width': '72%' }} />
          </div>
          <div>
            <span>Science</span>
            <i style={{ '--bar-width': '81%' }} />
          </div>
          <div>
            <span>History</span>
            <i style={{ '--bar-width': '58%' }} />
          </div>
          <small>ILLUSTRATIVE EXAMPLE · YOUR RESULTS WILL VARY</small>
        </div>
      );
    case 'courses':
      return (
        <div className="nexus-screen-list">
          <div>
            <span className="nexus-screen-list-icon">✳</span>
            <span>
              <strong>Computer Science</strong>
              <small>Technology · Problem solving</small>
            </span>
            <b>Explore ↗</b>
          </div>
          <div>
            <span className="nexus-screen-list-icon">⌁</span>
            <span>
              <strong>Digital Media</strong>
              <small>Creativity · Communication</small>
            </span>
            <b>Explore ↗</b>
          </div>
          <div>
            <span className="nexus-screen-list-icon">◇</span>
            <span>
              <strong>Environmental Science</strong>
              <small>Research · Real-world impact</small>
            </span>
            <b>Explore ↗</b>
          </div>
        </div>
      );
    case 'careers':
      return (
        <div className="nexus-screen-pathway">
          <div>
            <span>01</span>
            <strong>Your interests</strong>
            <small>Explore what motivates you</small>
          </div>
          <div>
            <span>02</span>
            <strong>Study options</strong>
            <small>Find a course to build on</small>
          </div>
          <div>
            <span>03</span>
            <strong>Career directions</strong>
            <small>See where it could lead</small>
          </div>
        </div>
      );
    case 'scholarships':
      return (
        <div className="nexus-screen-scholarships">
          <div>
            <span>OPPORTUNITY / 01</span>
            <strong>Explore funding options</strong>
            <small>Browse available scholarships and criteria.</small>
            <b>View details ↗</b>
          </div>
          <div>
            <span>OPPORTUNITY / 02</span>
            <strong>Save what matters</strong>
            <small>Keep possibilities together as you plan.</small>
            <b>Save for later ♡</b>
          </div>
        </div>
      );
    default:
      return (
        <div className="nexus-screen-interests">
          <div className="nexus-screen-radar">
            <svg viewBox="0 0 180 180" aria-hidden="true">
              <polygon
                points="90,15 154,52 154,128 90,165 26,128 26,52"
                fill="none"
                stroke="#d9ded8"
              />
              <polygon
                points="90,42 131,66 131,114 90,138 49,114 49,66"
                fill="none"
                stroke="#d9ded8"
              />
              <polygon
                points="90,36 136,64 119,113 90,125 52,112 53,70"
                fill="#e8a17f88"
                stroke="#d6785c"
                strokeWidth="3"
              />
              <circle cx="90" cy="36" r="4" fill="#d6785c" />
            </svg>
            <span>YOUR INTEREST PROFILE</span>
          </div>
          <div className="nexus-screen-interest-copy">
            <span>RIASEC / DISCOVERY</span>
            <strong>
              Find your
              <br />
              starting point.
            </strong>
            <small>Explore the activities and environments you enjoy.</small>
            <div>
              <i>Creative</i>
              <i>Investigative</i>
              <i>Social</i>
            </div>
          </div>
        </div>
      );
  }
}

function LaptopPreview({ active, selected }) {
  const copy = featureCopy[active];
  const reduce = useReducedMotion();
  return (
    <div className="nexus-laptop-wrap">
      <div
        className="nexus-laptop"
        role="region"
        aria-label="Nexus feature preview"
        aria-live="polite"
      >
        <div className="nexus-laptop-bezel">
          <span className="nexus-laptop-camera" aria-hidden="true" />
          <div className="nexus-laptop-screen">
            <aside className="nexus-screen-sidebar" aria-hidden="true">
              <span className="nexus-screen-brand">
                <b>N</b> NEXUS
              </span>
              <span className="nexus-screen-sidebar-label">YOUR JOURNEY</span>
              {['interests', 'strengths', 'courses', 'careers', 'scholarships'].map((id, index) => (
                <span key={id} className={id === active ? 'is-active' : ''}>
                  <i>{index + 1}</i>
                  {id === 'strengths' ? 'Academics' : id.charAt(0).toUpperCase() + id.slice(1)}
                </span>
              ))}
              <span className="nexus-screen-sidebar-bottom">✳ &nbsp; Find your path</span>
            </aside>
            <div className="nexus-screen-main">
              <div className="nexus-screen-toolbar">
                <span>YOUR NEXUS / {copy.label.toUpperCase()}</span>
                <span>● &nbsp; STUDENT VIEW</span>
              </div>
              <m.div
                key={active}
                className="nexus-screen-content"
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="nexus-screen-eyebrow">
                  {selected.number} / {selected.line.toUpperCase()}
                </span>
                <h3>{copy.screenTitle}</h3>
                <p>{copy.screenHint}</p>
                <ScreenVisual active={active} />
              </m.div>
            </div>
          </div>
        </div>
        <div className="nexus-laptop-base">
          <span />
        </div>
      </div>
      <div className="nexus-preview-caption">
        <span>
          <i /> LIVE FEATURE TOUR
        </span>
        <span>{selected.number} / 05</span>
      </div>
    </div>
  );
}

function FeatureJourney({ stops }) {
  const [active, setActive] = useState(stops[0].id);
  const stepRefs = useRef([]);
  const selected = stops.find((stop) => stop.id === active) || stops[0];

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (entering) setActive(entering.target.dataset.feature);
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: [0, 0.25, 0.6] }
    );
    stepRefs.current.forEach((step) => step && observer.observe(step));
    return () => observer.disconnect();
  }, [stops]);

  return (
    <section id="journey" className="nexus-feature-journey" aria-label="Explore Nexus features">
      <div className="rail-shell">
        <div className="nexus-feature-intro">
          <span className="rail-eyebrow">
            01 / THE TICKET HALL &nbsp; · &nbsp; 02 / THE INFORMATION DESK
          </span>
          <div>
            <h2>
              One journey. <em>More ways to move forward.</em>
            </h2>
            <p>
              See how Nexus helps you go from “what am I good at?” to “what could I do next?” Scroll
              through the journey and watch each feature come to life.
            </p>
          </div>
        </div>
        <div className="nexus-feature-layout">
          <div className="nexus-feature-steps">
            {stops.map((stop, index) => (
              <article
                key={stop.id}
                ref={(element) => {
                  stepRefs.current[index] = element;
                }}
                data-feature={stop.id}
                className={`nexus-feature-step${active === stop.id ? ' is-active' : ''}`}
                style={{ '--feature-color': stop.color }}
              >
                <button
                  type="button"
                  onClick={() => setActive(stop.id)}
                  aria-pressed={active === stop.id}
                >
                  <span className="nexus-step-index">
                    {stop.number} / 05 <i />
                  </span>
                  <span className="nexus-step-label">{featureCopy[stop.id].label}</span>
                  <h3>{stop.title}</h3>
                  <p>{stop.description}</p>
                </button>
                <Link to={stop.to} className="nexus-step-link">
                  {stop.action} <Icon name="arrowUpRight" className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
          <div className="nexus-feature-sticky">
            <LaptopPreview active={active} selected={selected} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingOpening({ stops }) {
  return (
    <>
      <Hero />
      <StudentProblems />
      <FeatureJourney stops={stops} />
    </>
  );
}
