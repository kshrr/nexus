import { cn } from '@/lib/cn';

/**
 * "No content" is a designed state, not a blank div. Always offers an action
 * (ui-spec §2.6 feedback table / §12.1).
 *
 * @param {{
 *   title: string, description?: string, action?: React.ReactNode, className?: string
 * }} props
 */
export function EmptyState({ title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-pine-300 bg-pine-50 px-6 py-12 text-center',
        className
      )}
    >
      <h3 className="text-h3 font-sans">{title}</h3>
      {description && <p className="mt-2 max-w-prose text-body-sm text-ink-700">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
