import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Icon } from '@/components/ui';
import { Reveal } from '@/components/landing/StationSections';

function Chat() {
  return (
    <div className="fg fg-chat">
      <header>
        <b>N</b>
        <span>
          Ask Nexus
          <small>
            <i /> Online
          </small>
        </span>
      </header>
      <p className="fg-bubble fg-you">Which course fits my results?</p>
      <p className="fg-bubble fg-bot">
        Three look strong. Want the reasons?
        <span className="fg-typing" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </p>
    </div>
  );
}

function Save() {
  return (
    <div className="fg fg-save">
      <div className="fg-card">
        {[
          ['Computer Science', 'Saved'],
          ['Petronas Scholarship', 'Applied'],
        ].map(([name, state], index) => (
          <p key={name} style={{ '--i': index }}>
            <Icon name="bookmark" className="h-4 w-4" />
            {name}
            <b className={state === 'Applied' ? 'is-applied' : ''}>{state}</b>
          </p>
        ))}
      </div>
      <div className="fg-steps">
        <i className="fg-fill" />
        {['Saved', 'Applied', 'Result'].map((step) => (
          <span key={step}>
            <u />
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

function Summary() {
  return (
    <div className="fg fg-doc">
      <div className="fg-sheet fg-sheet-back" />
      <div className="fg-sheet">
        <h5>Your recommendations</h5>
        {[88, 72, 55].map((width, index) => (
          <p key={width}>
            <span>{index + 1}</span>
            <i>
              <b style={{ width: `${width}%` }} />
            </i>
          </p>
        ))}
        <u />
      </div>
      <em className="fg-tag">PDF</em>
      <span className="fg-dl" aria-hidden="true">
        <Icon name="arrowRight" className="h-5 w-5" />
      </span>
    </div>
  );
}

function Sourced() {
  return (
    <div className="fg fg-source">
      <div className="fg-browser">
        <div className="fg-bar">
          <i />
          <i />
          <i />
          <span>official-university.edu.my</span>
        </div>
        <div className="fg-page">
          <b />
          <i />
          <i />
          <i />
        </div>
        <span className="fg-badge">
          <Icon name="check" className="h-4 w-4" /> Verified
        </span>
      </div>
      <p className="fg-ok">
        <span aria-hidden="true">✓</span> Reviewed by an admin
      </p>
    </div>
  );
}

function Private() {
  return (
    <div className="fg fg-private">
      <span className="fg-ring" />
      <span className="fg-ring fg-ring-2" />
      <div className="fg-lock">
        <Icon name="shield" className="h-9 w-9" />
      </div>
      <p className="fg-pill fg-p1">
        <Icon name="user" className="h-4 w-4" /> Your profile
      </p>
      <p className="fg-pill fg-p2">
        <Icon name="chart" className="h-4 w-4" /> Your grades
      </p>
      <p className="fg-pill fg-p3">
        <Icon name="chat" className="h-4 w-4" /> Your chats
      </p>
    </div>
  );
}

const slides = [
  {
    title: 'Ask Nexus',
    text: 'A chat assistant. Sign in for your own results.',
    Graphic: Chat,
    tone: 'peach',
  },
  {
    title: 'Save and track',
    text: 'Keep courses and scholarships together.',
    Graphic: Save,
    tone: 'sky',
  },
  {
    title: 'Take it with you',
    text: 'Download your recommendations.',
    Graphic: Summary,
    tone: 'mint',
  },
  {
    title: 'Sourced',
    text: 'Every record links to its official page.',
    Graphic: Sourced,
    tone: 'lilac',
  },
  {
    title: 'Private',
    text: 'Your data is visible only to you.',
    Graphic: Private,
    tone: 'butter',
  },
];

/** Horizontal slider: swipe, drag, use the arrows or the keyboard. */
export function Facilities() {
  const reduce = useReducedMotion();
  const track = useRef(null);
  const drag = useRef(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const span = el.scrollWidth - el.clientWidth;
    setProgress(span > 0 ? el.scrollLeft / span : 0);
  }, []);
  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update]);

  const slide = (direction) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector('li')?.getBoundingClientRect().width ?? 320;
    el.scrollBy({ left: direction * (card + 24), behavior: reduce ? 'auto' : 'smooth' });
  };

  const onPointerDown = (event) => {
    if (event.pointerType !== 'mouse') return;
    drag.current = { x: event.clientX, left: track.current.scrollLeft, moved: false };
  };
  const onPointerMove = (event) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    if (Math.abs(dx) > 4) {
      state.moved = true;
      setDragging(true);
    }
    track.current.scrollLeft = state.left - dx;
  };
  const stopDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <section id="features" className="st-facilities" aria-labelledby="st-fac-title">
      <div className="st-shell">
        <Reveal className="st-fac-head">
          <div>
            <p className="st-label">Also on the platform</p>
            <h2 id="st-fac-title">Built for the whole decision.</h2>
          </div>
          <div className="st-fac-arrows">
            <button type="button" onClick={() => slide(-1)} aria-label="Previous">
              <Icon name="arrowRight" className="h-5 w-5 st-flip" />
            </button>
            <button type="button" onClick={() => slide(1)} aria-label="Next">
              <Icon name="arrowRight" className="h-5 w-5" />
            </button>
          </div>
        </Reveal>
      </div>
      <div
        className={`st-slider${dragging ? ' is-dragging' : ''}`}
        ref={track}
        onScroll={update}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerLeave={stopDrag}
        tabIndex={0}
        role="region"
        aria-label="Platform features, scroll sideways"
      >
        <ul>
          {slides.map(({ title, text, Graphic, tone }, index) => (
            <li key={title}>
              <div className={`st-slide-art is-${tone}`}>
                <Graphic />
              </div>
              <span className="st-slide-no">{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="st-shell">
        <div className="st-slider-bar" aria-hidden="true">
          <i style={{ width: `${20 + progress * 80}%` }} />
        </div>
      </div>
    </section>
  );
}
