import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { Icon } from '@/components/ui';
import campusPhoto from '@/assets/images/nexus-campus.jpg';

const ease = [0.22, 1, 0.36, 1];

function Reveal({ children, className = '', delay = 0, as = 'div' }) {
  const reduceMotion = useReducedMotion();
  const Tag = m[as];
  return (
    <Tag
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : delay, ease }}
    >
      {children}
    </Tag>
  );
}

function TextLink({ to, children }) {
  return (
    <Link to={to} className="landing-text-link">
      {children}
      <Icon name="arrowUpRight" className="h-4 w-4" />
    </Link>
  );
}

function Hero() {
  const photoRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: photoRef, offset: ['start end', 'end start'] });
  const photoY = useTransform(scrollYProgress, [0, 1], [-20, 20]);
  return (
    <section className="landing-hero" aria-labelledby="welcome-heading">
      <div className="landing-shell">
        <div className="landing-hero-copy">
          <div>
            <Reveal>
              <p className="landing-eyebrow">Education &amp; career guidance</p>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 id="welcome-heading" className="landing-hero-title">
                Your future.
                <br />
                <span>Your kind of path.</span>
              </h1>
            </Reveal>
          </div>
          <Reveal className="landing-hero-intro" delay={0.16}>
            <p>Find the courses, careers and scholarships that make sense for you.</p>
            <div className="landing-hero-actions">
              <Link to="/register" className="landing-button">
                Find Your Path <Icon name="arrowUpRight" className="h-4 w-4" />
              </Link>
              <a href="#features" className="landing-explore">
                Explore Nexus <Icon name="arrowRight" className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.2}>
          <div ref={photoRef} className="landing-hero-photo">
            <m.img
              src={campusPhoto}
              alt="Students sharing ideas and working together in a library"
              width="1600"
              height="1067"
              loading="eager"
              style={{ y: reduceMotion ? 0 : photoY }}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const features = [
  {
    id: 'interests-story',
    title: 'Understand your interests.',
    description: 'Discover what energises you with a 36-question RIASEC assessment.',
    link: 'Discover your interests',
    to: '/find-your-path/assessment',
    icon: 'target',
  },
  {
    id: 'academic-story',
    title: 'Recognise your strengths.',
    description: 'See the subjects you do well in, and how your results develop over time.',
    link: 'Explore academic analysis',
    to: '/find-your-path/academic',
    icon: 'chart',
  },
  {
    id: 'recommendations-story',
    title: 'Find a direction that fits.',
    description:
      'Explore courses and career pathways, with clear reasons behind each recommendation.',
    link: 'Explore your possibilities',
    to: '/recommendations',
    icon: 'compass',
  },
  {
    id: 'scholarships-story',
    title: 'Make opportunity possible.',
    description: 'Find scholarships, check requirements and keep the next deadline in sight.',
    link: 'Browse scholarships',
    to: '/scholarships',
    icon: 'scholarship',
  },
];

function Features() {
  return (
    <section
      id="features"
      className="landing-section landing-features"
      aria-labelledby="features-heading"
    >
      <div className="landing-shell">
        <Reveal className="landing-section-heading">
          <div>
            <p className="landing-eyebrow">The bigger picture</p>
            <h2 id="features-heading">
              Four ways forward.
              <br />
              One place to begin.
            </h2>
          </div>
          <p>Your interests, your strengths, your next step. Connected.</p>
        </Reveal>
        <div className="landing-features-grid">
          {features.map((feature, index) => (
            <Reveal
              key={feature.id}
              as="article"
              className="landing-feature"
              delay={(index % 2) * 0.08}
            >
              <div id={feature.id} className="landing-feature-top">
                <span className="landing-number">0{index + 1}</span>
                <Icon name={feature.icon} className="h-6 w-6" />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <TextLink to={feature.to}>{feature.link}</TextLink>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const matchingSteps = [
  {
    title: 'Start with who you are.',
    description: 'Your RIASEC assessment maps the work and activities you enjoy.',
    signal: 'Your interests',
  },
  {
    title: 'Bring your strengths in.',
    description: 'Your available grades, education level and goals add context.',
    signal: 'Your profile',
  },
  {
    title: 'See what connects.',
    description: 'Defined rules rank courses and careers, with the matching reasons beside them.',
    signal: 'Your possibilities',
  },
];

function HowItWorks() {
  const sectionRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start 85%', 'end 60%'] });
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="landing-section landing-matching"
      aria-labelledby="matching-heading"
    >
      <div className="landing-shell">
        <Reveal className="landing-section-heading">
          <div>
            <p className="landing-eyebrow">How recommendations happen</p>
            <h2 id="matching-heading">
              Good guidance.
              <br />
              Clear reasons.
            </h2>
          </div>
          <p>
            Nexus connects what you enjoy with what you do well, so you can see why a path fits.
          </p>
        </Reveal>
        <div className="landing-matching-track" aria-hidden="true">
          <m.div style={{ scaleX: reduceMotion ? 1 : scaleX }} />
        </div>
        <ol className="landing-matching-steps">
          {matchingSteps.map((step, index) => (
            <Reveal key={step.title} as="li" delay={index * 0.1}>
              <div className="landing-step-meta">
                <span className="landing-number">0{index + 1}</span>
                <span>{step.signal}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </Reveal>
          ))}
        </ol>
        <Reveal className="landing-matching-bottom">
          <p>
            <Icon name="check" className="h-4 w-4" /> Rule-based matching. Reasons you can review.
          </p>
          <TextLink to="/register">Find Your Path</TextLink>
        </Reveal>
      </div>
    </section>
  );
}

const faqs = [
  {
    question: 'What is Nexus?',
    answer:
      'Nexus helps Malaysian students connect their interests and academic strengths with courses, careers and scholarship opportunities.',
  },
  {
    question: 'How are recommendations generated?',
    answer:
      'Nexus checks defined rules against your RIASEC results, available subject strengths and profile. It ranks matching courses and careers and shows the reasons for each result.',
  },
  {
    question: 'Do I need my exam results to get started?',
    answer:
      'You can start with the interest assessment. Available academic results add detail; without them, Nexus can still offer interest-based guidance.',
  },
  {
    question: 'Can I explore scholarships without an account?',
    answer:
      'Yes. You can browse scholarships without signing in. Create a profile for personalised matching, and confirm the application requirements with the scholarship provider.',
  },
  {
    question: 'How do I find my path?',
    answer:
      'Create an account, complete your profile and take the interest assessment. Add your available results, then explore your recommendations in Find Your Path.',
  },
];

function FAQ() {
  return (
    <section id="faq" className="landing-section landing-faq" aria-labelledby="faq-heading">
      <div className="landing-shell landing-faq-layout">
        <Reveal>
          <p className="landing-eyebrow">A few things to know</p>
          <h2 id="faq-heading">
            Curious?
            <br />
            Start here.
          </h2>
        </Reveal>
        <div className="landing-faq-list">
          {faqs.map((faq, index) => (
            <Reveal key={faq.question} delay={index * 0.04}>
              <details className="landing-faq-item">
                <summary>
                  <span>{faq.question}</span>
                  <span className="landing-faq-toggle" aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <LazyMotion features={domAnimation} strict>
      <div className="nexus-landing">
        <Hero />
        <Features />
        <HowItWorks />
        <FAQ />
      </div>
    </LazyMotion>
  );
}

export default Landing;
