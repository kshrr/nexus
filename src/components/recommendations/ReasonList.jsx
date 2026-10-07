import { cn } from '@/lib/cn';

/**
 * The transparent list of reasons a recommendation was made (report §3.4.2,
 * ui-spec §3.9). Never collapsed by default — the *why* is primary content, not
 * a disclosure toggle.
 *
 * Unsatisfied conditions are shown, not hidden. A card at 85% shows the one
 * condition that failed; that is what makes the transparency claim real and it
 * tells the student exactly what to change.
 *
 * The small source label on each row records which kind of signal contributed —
 * interests (RIASEC), results (academic) or goals — so a recommendation can be
 * traced back to its inputs as well as to its rule.
 */
const SOURCE = {
  riasec_letter: 'interests',
  riasec_score: 'interests',
  subject_strength: 'results',
  subject_domain_strength: 'results',
  education_level: 'profile',
  interest: 'goals',
};

/**
 * @param {{ reasons: { condition: string, satisfied: boolean, text: string }[] }} props
 */
export function ReasonList({ reasons }) {
  if (!reasons?.length) return null;
  return (
    <div>
      <p className="text-caption text-ink-500">Why this was suggested</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {reasons.map((reason, i) => (
          <li key={`${reason.condition}-${i}`} className="flex items-baseline gap-2 text-body-sm">
            <span
              aria-hidden="true"
              className={cn(
                'w-3 shrink-0 font-medium',
                reason.satisfied ? 'text-pine-700' : 'text-rust-600'
              )}
            >
              {reason.satisfied ? '✓' : '✗'}
            </span>
            <span className={cn('flex-1', reason.satisfied ? 'text-ink-900' : 'text-ink-700')}>
              <span className="sr-only">{reason.satisfied ? 'Met: ' : 'Not met: '}</span>
              {reason.text}
            </span>
            <span className="shrink-0 text-caption text-ink-500">
              {SOURCE[reason.condition] ?? 'rule'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ReasonList;
