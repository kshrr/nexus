import { cn } from '@/lib/cn';

/**
 * Compact status marker. Every badge carries text — colour never carries meaning
 * alone (ui-spec §2.4).
 *
 * @param {{
 *   variant?: 'neutral' | 'success' | 'warning' | 'critical' | 'info',
 *   className?: string, children: React.ReactNode
 * }} props
 */
const VARIANT = {
  neutral: 'bg-ink-100 text-ink-700',
  success: 'bg-pine-100 text-pine-700',
  warning: 'bg-amber-100 text-amber-600',
  critical: 'bg-rust-100 text-rust-600',
  info: 'bg-slate-100 text-slate-600',
};

export function Badge({ variant = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-0.5 text-caption font-medium',
        VARIANT[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
