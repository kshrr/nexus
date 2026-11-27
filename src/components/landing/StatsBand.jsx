import { useEffect, useRef, useState } from 'react';
import { animate, m, useInView, useReducedMotion } from 'motion/react';
import { config } from '@/config/env';
import { supabase } from '@/lib/supabase';

// Live counts from the public catalogue. The assessment length is a fixed fact of the product.
const COUNTS = [
  { key: 'courses', label: 'Courses', table: 'courses', filter: ['is_active', true] },
  {
    key: 'universities',
    label: 'Universities',
    table: 'universities',
    filter: ['is_active', true],
  },
  {
    key: 'scholarships',
    label: 'Scholarships',
    table: 'scholarships',
    filter: ['status', 'active'],
  },
  { key: 'careers', label: 'Careers', table: 'careers', filter: ['is_active', true] },
];

async function loadCounts() {
  const entries = await Promise.all(
    COUNTS.map(async ({ key, table, filter }) => {
      try {
        const { count } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq(filter[0], filter[1]);
        return [key, typeof count === 'number' ? count : null];
      } catch {
        return [key, null];
      }
    })
  );
  return Object.fromEntries(entries);
}

function Counter({ value, run, delay = 0 }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (value == null || !run || reduce) return undefined;
    const controls = animate(0, value, {
      duration: 1.8,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setShown(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value, run, reduce, delay]);
  if (value == null) return <span>—</span>;
  return (
    <>
      <span aria-hidden="true">{reduce ? value : shown}</span>
      <span className="st-sr">{value}</span>
    </>
  );
}

const TONES = ['peach', 'sky', 'mint', 'lilac', 'butter'];

export function StatsBand() {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [counts, setCounts] = useState({});
  useEffect(() => {
    if (!config.isConfigured) return undefined;
    let cancelled = false;
    loadCounts().then((result) => {
      if (!cancelled) setCounts(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const items = [
    ...COUNTS.map(({ key, label }) => ({ key, label, value: counts[key] ?? null, plus: true })),
    { key: 'questions', label: 'Interest questions', value: 36, plus: false },
  ];
  return (
    <section className="st-stats" aria-label="Nexus in numbers" ref={ref}>
      <div className="st-stats-glow" aria-hidden="true" />
      <div className="st-shell">
        <div className="st-stats-head">
          <span className="st-pill">Live from Nexus</span>
          <h2>Everything in one place.</h2>
        </div>
        <ul>
          {items.map((item, index) => (
            <m.li
              key={item.key}
              className={`st-ticket st-ticket-${TONES[index % TONES.length]}`}
              initial={reduce ? false : { opacity: 0, scale: 0.7, y: 56 }}
              animate={inView || reduce ? { opacity: 1, scale: 1, y: 0 } : undefined}
              transition={{ type: 'spring', stiffness: 220, damping: 17, delay: index * 0.11 }}
            >
              <span>{item.label}</span>
              <strong>
                <Counter value={item.value} run={inView} delay={index * 0.11} />
                {item.plus && item.value != null && <em aria-hidden="true">+</em>}
              </strong>
            </m.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
