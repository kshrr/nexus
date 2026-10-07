import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

/**
 * Action button. One `primary` per view (ui-spec §2.1). Label is a verb phrase
 * describing what happens ("Save results", not "Submit").
 *
 * @typedef {'primary' | 'secondary' | 'tertiary' | 'destructive' | 'link'} ButtonVariant
 * @typedef {'sm' | 'md' | 'lg'} ButtonSize
 */

const VARIANT = {
  primary: 'bg-pine-700 text-white hover:bg-pine-900 border border-transparent shadow-sm hover:shadow-card',
  secondary: 'bg-surface text-ink-900 border border-ink-300 hover:border-pine-300 hover:bg-pine-50',
  tertiary: 'bg-transparent text-pine-700 border border-transparent hover:bg-pine-100',
  destructive: 'bg-surface text-rust-600 border border-rust-600 hover:bg-rust-100',
  link: 'bg-transparent text-pine-700 underline border-none p-0 h-auto',
};

const SIZE = {
  sm: 'h-8 px-3 text-body-sm',
  md: 'h-10 px-4 text-body-sm',
  lg: 'h-12 px-4 text-body',
};

export const Button = forwardRef(
  /**
   * @param {{
   *   variant?: ButtonVariant, size?: ButtonSize, loading?: boolean,
   *   fullWidth?: boolean, iconLeft?: React.ReactNode, className?: string,
   *   children: React.ReactNode
   * } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
   */
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      iconLeft,
      className,
      children,
      disabled,
      type = 'button',
      ...rest
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-pill font-semibold',
        'transition-all duration-200 ease-out-fast active:scale-[0.98]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variant !== 'link' && SIZE[size],
        VARIANT[variant],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : iconLeft}
      {children}
    </button>
  )
);

Button.displayName = 'Button';
export default Button;
