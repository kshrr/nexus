import { cn } from '@/lib/cn';
import { eligibilityInputs } from '@/lib/eligibilityInputs';

/**
 * Shows which answers scholarship checks can already use and which are still empty,
 * so a student can see why a requirement reads "not met" or "can't check".
 * `onAdd(tab)` is optional: when given, each empty item gets an "Add" button.
 */
export function EligibilityReadiness({ answers, onAdd, className }) {
  const items = eligibilityInputs(answers);
  const done = items.filter((item) => item.done).length;
  return (
    <section
      className={cn('rounded-card border border-ink-300 bg-surface p-4', className)}
      aria-label="What scholarship checks can use"
    >
      <h3 className="text-h4">
        Scholarship checks{' '}
        <span className="font-normal text-ink-500">
          · {done} of {items.length} ready
        </span>
      </h3>
      <ul className="mt-3 flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-caption font-semibold',
                item.done ? 'bg-pine-100 text-pine-700' : 'bg-ink-100 text-ink-500'
              )}
            >
              {item.done ? '✓' : '·'}
            </span>
            <span className="flex-1 text-body-sm">
              <span className="font-medium text-ink-900">
                {item.label}
                <span className="sr-only">{item.done ? ' — added' : ' — not added yet'}</span>
              </span>
              <span className="block text-ink-500">{item.detail}</span>
            </span>
            {!item.done && onAdd && (
              <button
                type="button"
                onClick={() => onAdd(item.tab)}
                className="text-body-sm text-pine-700 underline"
              >
                Add
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-caption text-ink-500">
        Anything you skip shows as “can’t check” on a scholarship. You can add it later in Profile.
      </p>
    </section>
  );
}

export default EligibilityReadiness;
