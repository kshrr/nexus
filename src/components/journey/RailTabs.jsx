import { useRef } from 'react';

/** Accessible station-sign tabs with automatic arrow-key activation. */
export function RailTabs({ id, tabs, active, onChange, label }) {
  const buttons = useRef([]);
  function move(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    buttons.current[next]?.focus();
  }
  return (
    <div className="rail-section-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          type="button"
          role="tab"
          id={`${id}-${tab.id}`}
          aria-controls={`${id}-${tab.id}-panel`}
          aria-selected={active === tab.id}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => move(event, index)}
        >
          <span className="rail-tab-number" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span>{tab.label}</span>
          {tab.count !== undefined && <small>{tab.count}</small>}
        </button>
      ))}
    </div>
  );
}
