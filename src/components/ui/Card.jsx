import { cn } from '@/lib/cn';

/**
 * Container. Borders separate; shadows only lift — cards get `1px solid --ink-300`
 * and no shadow (ui-spec §0.5 / §2.3).
 *
 * @param {{
 *   variant?: 'plain' | 'titled' | 'soft' | 'elevated', title?: React.ReactNode, action?: React.ReactNode,
 *   as?: keyof JSX.IntrinsicElements, className?: string, children: React.ReactNode
 * } & React.HTMLAttributes<HTMLElement>} props
 */
export function Card({
  variant = 'plain',
  title,
  action,
  as: Tag = 'div',
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      className={cn(
        'rounded-card p-5 md:p-6',
        variant === 'soft' && 'border border-pine-100 bg-pine-50',
        variant === 'elevated' && 'border border-ink-100 bg-surface shadow-card',
        (variant === 'plain' || variant === 'titled') && 'border border-ink-300 bg-surface',
        className
      )}
      {...rest}
    >
      {variant === 'titled' && (
        <div className="flex items-center justify-between border-b border-ink-300 pb-3 mb-4">
          <h3 className="text-h3 font-sans">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </Tag>
  );
}

export default Card;
