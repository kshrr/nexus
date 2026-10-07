import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

/**
 * Text wordmark in the heading serif (ui-spec §1.2). No logo asset in this phase.
 * @param {{ to?: string, className?: string, label?: string }} props
 */
export function Wordmark({ to = '/', className, label = 'Nexus' }) {
  return (
    <Link
      to={to}
      className={cn('group inline-flex items-center gap-2 font-serif text-h3 font-semibold text-ink-900', className)}
    >
      <span className="grid h-8 w-8 place-items-center rounded-[11px] bg-pine-700 text-sm font-bold text-white transition-transform duration-200 group-hover:-rotate-3">
        N
      </span>
      <span>{label}</span>
    </Link>
  );
}

export default Wordmark;
