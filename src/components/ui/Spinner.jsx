import { cn } from '@/lib/cn';

/**
 * Indeterminate wait indicator. Used inside buttons and small inline slots only —
 * full-page waits use <Skeleton> (ui-spec §2.6 / §16.6).
 *
 * @param {{ size?: 'sm' | 'md' | 'lg', className?: string, label?: string }} props
 */
export function Spinner({ size = 'md', className, label = 'Loading' }) {
  const dim = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' }[size];
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-pill border-2 border-current border-t-transparent',
        dim,
        className
      )}
    />
  );
}

export default Spinner;
