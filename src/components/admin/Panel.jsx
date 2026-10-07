import { useEffect } from 'react';
import { Button } from '@/components/ui';

/**
 * Slide-over panel for admin create/edit forms.
 *
 * Shared by every admin screen so the editing pattern is identical throughout —
 * admins are working, not being guided, and a consistent surface is faster to
 * use than a bespoke one per page (ui-spec §10).
 *
 * @param {{ title: string, subtitle?: string, onClose: () => void, children: React.ReactNode }} props
 */
export function Panel({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink-900/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-paper p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h2 font-serif">{title}</h2>
            {subtitle && <p className="mt-1 text-body-sm text-ink-700">{subtitle}</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Panel;
