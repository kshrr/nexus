import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

/**
 * Standard page heading block (architecture.md §2 layout/PageHeader): optional
 * back link (text link with a left chevron, top-left — not a floating icon
 * button, ui-spec §1.6), the page title (display size, one per page), an
 * optional description, and right-aligned actions.
 *
 * @param {{
 *   title: string, description?: string,
 *   back?: { to: string, label: string },
 *   actions?: React.ReactNode, className?: string
 * }} props
 */
export function PageHeader({ title, description, back, actions, className }) {
  return (
    <div className={cn('mb-8', className)}>
      {back && (
        <Link
          to={back.to}
          className="mb-2 inline-flex items-center gap-1 text-body-sm text-pine-700 hover:underline"
        >
          <span aria-hidden="true">‹</span> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-display font-serif text-ink-900">{title}</h1>
          {description && <p className="mt-2 max-w-prose text-body text-ink-700">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
