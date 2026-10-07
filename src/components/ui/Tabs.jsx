import { cn } from '@/lib/cn';

/**
 * Section switching (ui-spec §12.1). A horizontal tab list on wider screens;
 * the caller is responsible for rendering the active panel.
 *
 * @param {{
 *   tabs: { id: string, label: string }[],
 *   active: string,
 *   onChange: (id: string) => void,
 *   className?: string
 * }} props
 */
export function Tabs({ tabs, active, onChange, className }) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className={cn('flex gap-1 overflow-x-auto border-b border-ink-300', className)}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2 text-body-sm transition-colors duration-120',
              selected
                ? 'border-pine-700 font-medium text-pine-700'
                : 'border-transparent text-ink-700 hover:text-ink-900'
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
