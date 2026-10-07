import { Skeleton } from '@/components/ui';

/**
 * Full-view loading treatment. Skeletons matching the final layout, never a bare
 * full-page spinner (ui-spec §16.6).
 *
 * @param {{ label?: string, rows?: number }} props
 */
export function LoadingState({ label = 'Loading', rows = 3 }) {
  return (
    <div className="space-y-4" role="status" aria-label={label} aria-busy="true">
      <Skeleton variant="text" lines={2} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="card" />
      ))}
    </div>
  );
}

export default LoadingState;
