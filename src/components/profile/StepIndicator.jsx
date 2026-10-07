import { cn } from '@/lib/cn';

/**
 * The route line for a genuine sequence (ui-spec §0.2, §3.4). Horizontal
 * numbered markers on wider screens; "Step N of M" + a progress bar on mobile.
 *
 * @param {{ steps: string[], current: number }} props  current is 0-indexed
 */
export function StepIndicator({ steps, current }) {
  const pct = Math.round(((current + 1) / steps.length) * 100);
  return (
    <div className="mb-8">
      {/* desktop */}
      <ol className="hidden items-center gap-2 sm:flex">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border text-caption',
                  done && 'border-pine-700 bg-pine-700 text-white',
                  active && 'border-pine-700 text-pine-700',
                  !done && !active && 'border-ink-300 text-ink-500'
                )}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={cn('text-body-sm', active ? 'font-medium text-ink-900' : 'text-ink-500')}
              >
                {label}
              </span>
              {i < steps.length - 1 && <span className="h-px flex-1 bg-ink-300" />}
            </li>
          );
        })}
      </ol>

      {/* mobile */}
      <div className="sm:hidden">
        <p className="mb-1 text-body-sm text-ink-700">
          Step {current + 1} of {steps.length} · {steps[current]}
        </p>
        <div className="h-1 w-full overflow-hidden rounded-pill bg-ink-100">
          <div
            className="h-full bg-pine-700 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default StepIndicator;
