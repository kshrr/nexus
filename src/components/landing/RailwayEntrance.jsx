import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { m, useReducedMotion } from 'motion/react';
import { TrainDrawing } from './RailIllustrations';
import '@/styles/railway-entrance.css';

const INTRO_DURATION = 3100;
const phases = {
  red: { label: 'Please wait', text: 'Preparing your connection.' },
  amber: { label: 'Get ready', text: 'The Nexus Express is approaching.' },
  green: { label: 'All clear', text: 'Gate open. Your journey starts here.' },
};

/** A brief, skippable railway welcome, once per browser-tab session. */
export function RailwayEntrance({ open, onFinish, sessionKey }) {
  const reduce = useReducedMotion();
  const skipRef = useRef(null);
  const [phase, setPhase] = useState('red');

  useEffect(() => {
    if (!open) return undefined;
    if (reduce) {
      onFinish();
      return undefined;
    }

    setPhase('red');
    try {
      sessionStorage.setItem(sessionKey, '1');
    } catch {
      // The entrance can still complete when session storage is unavailable.
    }

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById('root');
    const previouslyInert = appRoot?.hasAttribute('inert');
    document.body.style.overflow = 'hidden';
    appRoot?.setAttribute('inert', '');
    skipRef.current?.focus({ preventScroll: true });

    const timers = [
      window.setTimeout(() => setPhase('amber'), 650),
      window.setTimeout(() => setPhase('green'), 1200),
      window.setTimeout(onFinish, INTRO_DURATION),
    ];
    const onKey = (event) => {
      if (event.key === 'Escape') onFinish();
      if (event.key === 'Tab') {
        event.preventDefault();
        skipRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (!previouslyInert) appRoot?.removeAttribute('inert');
      if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
    };
  }, [open, onFinish, reduce, sessionKey]);

  if (!open || reduce) return null;
  const current = phases[phase];

  return createPortal(
    <m.div
      className="railway-entrance"
      role="dialog"
      aria-modal="true"
      aria-labelledby="railway-welcome-title"
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: INTRO_DURATION / 1000, times: [0, 0.87, 1] }}
    >
      <header className="railway-welcome-header">
        <span className="railway-welcome-mark" aria-hidden="true">
          N
        </span>
        <span>NEXUS CENTRAL</span>
        <button ref={skipRef} type="button" onClick={onFinish}>
          Skip intro <span aria-hidden="true">→</span>
        </button>
      </header>

      <div className="railway-welcome-content">
        <p className="railway-welcome-eyebrow">YOUR CONNECTION TO WHAT COMES NEXT</p>
        <h2 id="railway-welcome-title">
          A signal to <em>begin.</em>
        </h2>

        <div className={`railway-gate-scene is-${phase}`} aria-hidden="true">
          <div className="railway-signal">
            <div className="railway-signal-head">
              <span className="railway-signal-lamp signal-red" />
              <span className="railway-signal-lamp signal-amber" />
              <span className="railway-signal-lamp signal-green" />
            </div>
            <div className="railway-signal-post" />
            <div className="railway-signal-plate">NX / 01</div>
          </div>

          <div className="railway-welcome-train">
            <TrainDrawing id="entrance-express" />
          </div>
          <div className="railway-gate-track" />
          <div className="railway-gate">
            <div className="railway-gate-base">
              <span>N</span>
              <i />
            </div>
            <div className="railway-gate-arm">
              <span />
            </div>
            <div className="railway-gate-hinge" />
          </div>
          <div className="railway-track-direction">
            NEXUS EXPRESS <span>→</span>
          </div>
        </div>

        <div className="railway-signal-caption" role="status" aria-live="polite" aria-atomic="true">
          <span className={`railway-signal-state is-${phase}`}>{current.label}</span>
          <p>{current.text}</p>
        </div>
      </div>

      <footer className="railway-welcome-footer">
        <span>出発 / DEPARTURE</span>
        <span>ALL POSSIBILITIES WELCOME</span>
      </footer>
    </m.div>,
    document.body
  );
}
