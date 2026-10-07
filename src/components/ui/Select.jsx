import { forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Choice from a list (ui-spec §12.1). Use for >= 5 options; fewer -> RadioGroup.
 * Always has a real <label for>.
 *
 * @param {{
 *   label: string, hint?: string, error?: string | null, required?: boolean,
 *   placeholder?: string, options: ({ value: string, label: string } | string)[],
 *   className?: string
 * } & React.SelectHTMLAttributes<HTMLSelectElement>} props
 */
export const Select = forwardRef(
  ({ label, hint, error, required = false, placeholder, options, className, id, ...rest }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;
    const hintId = hint ? `${selectId}-hint` : undefined;
    const errorId = error ? `${selectId}-error` : undefined;
    const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

    return (
      <div className={cn('flex flex-col', className)}>
        <label htmlFor={selectId} className="mb-1.5 text-caption font-medium text-ink-700">
          {label}
          {required && <span className="font-normal text-ink-500"> · Required</span>}
        </label>
        {hint && (
          <p id={hintId} className="mb-1.5 text-body-sm text-ink-500">
            {hint}
          </p>
        )}
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={cn(hintId, errorId) || undefined}
          className={cn(
            'h-10 rounded-input border bg-surface px-3 text-body text-ink-900',
            'focus:border-pine-700 focus:outline-none focus:ring-[3px] focus:ring-pine-100',
            'disabled:bg-ink-100 disabled:text-ink-500',
            error ? 'border-rust-600' : 'border-ink-300'
          )}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-body-sm text-rust-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
