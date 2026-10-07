import { cn } from '@/lib/cn';
import { RIASEC_DIMENSIONS } from '@/types';

/**
 * The Holland Code, set in the heading serif inside a bordered plate — the
 * single most identity-carrying output of the system (ui-spec §3.7).
 *
 * @param {{ code: string, className?: string }} props
 */
export function HollandCodePlate({ code, className }) {
  const letters = (code ?? '').split('');
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="inline-flex w-fit items-center gap-3 rounded-card bg-lime px-6 py-4 shadow-sm">
        <span className="font-serif text-display tracking-[0.15em] text-pine-900">{code}</span>
      </div>
      <p className="text-caption text-ink-500">Holland Code</p>
      <p className="text-body text-ink-900">
        {letters
          .map((l) => RIASEC_DIMENSIONS[l])
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  );
}

export default HollandCodePlate;
