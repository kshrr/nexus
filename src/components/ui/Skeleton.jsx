import { cn } from '@/lib/cn';

/**
 * Content placeholder that matches the final layout (ui-spec §2.6 / §12.1).
 * Never a bare spinner on a full page.
 *
 * @param {{ variant?: 'text' | 'card' | 'chart', lines?: number, className?: string }} props
 */
export function Skeleton({ variant = 'text', lines = 3, className }) {
  const base = 'animate-pulse bg-gradient-to-r from-ink-100 via-pine-50 to-ink-100 bg-[length:200%_100%] rounded-card';

  if (variant === 'card') {
    return <div className={cn(base, 'h-40 w-full', className)} aria-hidden="true" />;
  }
  if (variant === 'chart') {
    return (
      <div className={cn(base, 'aspect-square w-full max-w-sm', className)} aria-hidden="true" />
    );
  }
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={cn(base, 'h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export default Skeleton;
