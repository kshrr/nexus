import { cn } from '@/lib/cn';

/**
 * Block message. Bold first sentence stating what happened, then plain text on
 * what to do. Alerts do not apologise (ui-spec §2.5).
 *
 * @param {{
 *   variant?: 'info' | 'success' | 'warning' | 'error',
 *   title?: React.ReactNode, action?: React.ReactNode,
 *   className?: string, children?: React.ReactNode
 * }} props
 */
const VARIANT = {
  info: 'border-slate-600 bg-slate-100 text-ink-900',
  success: 'border-pine-700 bg-pine-100 text-ink-900',
  warning: 'border-amber-600 bg-amber-100 text-ink-900',
  error: 'border-rust-600 bg-rust-100 text-ink-900',
};

export function Alert({ variant = 'info', title, action, className, children }) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('rounded-card border-l-4 p-4', VARIANT[variant], className)}
    >
      {title && <p className="text-h4 font-semibold">{title}</p>}
      {children && <div className={cn('text-body-sm', title && 'mt-1')}>{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export default Alert;
