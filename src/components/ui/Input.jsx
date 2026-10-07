import { forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Text entry. Always has a real <label for> — no placeholder-as-label anywhere.
 * Validate on blur, never on keystroke (ui-spec §2.2). Error text says what to do.
 *
 * @param {{
 *   label: string, hint?: string, error?: string | null, required?: boolean,
 *   className?: string
 * } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
export const Input = forwardRef(
  ({ label, hint, error, required = false, className, id, type = 'text', ...rest }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className={cn('flex flex-col', className)}>
        <label htmlFor={inputId} className="text-caption font-medium text-ink-700 mb-1.5">
          {label}
          {required && <span className="text-ink-500 font-normal"> · Required</span>}
        </label>
        {hint && (
          <p id={hintId} className="text-body-sm text-ink-500 mb-1.5">
            {hint}
          </p>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={cn(hintId, errorId) || undefined}
          className={cn(
            'h-12 rounded-input border bg-surface px-4 text-body text-ink-900',
            'transition-colors duration-120 ease-out-fast',
            'focus:outline-none focus:border-pine-700 focus:ring-[3px] focus:ring-pine-100',
            'disabled:bg-ink-100 disabled:text-ink-500',
            error ? 'border-rust-600' : 'border-ink-300'
          )}
          {...rest}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-body-sm text-rust-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
