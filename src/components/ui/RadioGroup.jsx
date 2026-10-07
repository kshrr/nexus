import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Exclusive choice (ui-spec §12.1). `layout="cards"` is used for education level
 * and the assessment scale — options that carry a one-line explanation and do
 * not belong in a select.
 *
 * @param {{
 *   label: string, name?: string, value: string | null,
 *   onChange: (value: string) => void, error?: string | null,
 *   layout?: 'list' | 'cards',
 *   options: { value: string, label: string, description?: string }[],
 *   className?: string
 * }} props
 */
export function RadioGroup({
  label,
  name,
  value,
  onChange,
  error,
  layout = 'list',
  options,
  className,
}) {
  const autoName = useId();
  const groupName = name ?? autoName;
  const errorId = error ? `${groupName}-error` : undefined;

  return (
    <fieldset className={cn('flex flex-col', className)} aria-describedby={errorId}>
      <legend className="mb-2 text-caption font-medium text-ink-700">{label}</legend>
      <div className={cn(layout === 'cards' ? 'grid gap-2 sm:grid-cols-2' : 'flex flex-col gap-2')}>
        {options.map((opt) => {
          const checked = value === opt.value;
          return (
            <label
              key={opt.value}
              className={cn(
                'flex cursor-pointer gap-3 rounded-card border p-3 transition-colors duration-120',
                layout === 'cards' ? 'items-start' : 'items-center',
                checked ? 'border-pine-700 bg-pine-100' : 'border-ink-300 hover:border-ink-500'
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="mt-0.5 h-4 w-4 accent-pine-700"
              />
              <span>
                <span className="block text-body-sm font-medium text-ink-900">{opt.label}</span>
                {opt.description && (
                  <span className="block text-body-sm text-ink-500">{opt.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-body-sm text-rust-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export default RadioGroup;
