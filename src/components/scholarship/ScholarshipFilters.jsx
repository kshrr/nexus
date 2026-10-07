import { useId } from 'react';
import { Button } from '@/components/ui';
import { EDUCATION_LEVEL_LABELS } from '@/types';

/**
 * Filter panel (FR09, ui-spec §3.10).
 *
 * Exactly the three filters FR09 names: field of study, provider and education
 * level. "Budget" (§1.5.2) and "scholarship type" (Figure 4.4) are not built —
 * there is no such column and no requirement (D-26).
 *
 * Accessibility: each group is a <fieldset> with a <legend>, every checkbox has
 * a real <label for>, and the active-filter count is announced.
 *
 * @param {{
 *   facets: { fields: string[], providers: string[], levels: string[] },
 *   value: { fields: string[], providers: string[], levels: string[] },
 *   onChange: (next: any) => void,
 *   onClear: () => void,
 * }} props
 */
export function ScholarshipFilters({ facets, value, onChange, onClear }) {
  const activeCount = value.fields.length + value.providers.length + value.levels.length;

  const toggle = (group, item) => {
    const current = value[group];
    onChange({
      ...value,
      [group]: current.includes(item) ? current.filter((v) => v !== item) : [...current, item],
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-h4 font-sans">Filters</h2>
        {activeCount > 0 && (
          <Button variant="tertiary" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>

      <FilterGroup
        legend="Education level"
        options={facets.levels.map((l) => ({ value: l, label: EDUCATION_LEVEL_LABELS[l] ?? l }))}
        selected={value.levels}
        onToggle={(v) => toggle('levels', v)}
      />
      <FilterGroup
        legend="Field of study"
        options={facets.fields.map((f) => ({ value: f, label: f }))}
        selected={value.fields}
        onToggle={(v) => toggle('fields', v)}
      />
      <FilterGroup
        legend="Provider"
        options={facets.providers.map((p) => ({ value: p, label: p }))}
        selected={value.providers}
        onToggle={(v) => toggle('providers', v)}
      />

      <p aria-live="polite" className="sr-only">
        {activeCount === 0 ? 'No filters applied' : `${activeCount} filters applied`}
      </p>
    </div>
  );
}

function FilterGroup({ legend, options, selected, onToggle }) {
  const id = useId();
  if (options.length === 0) {
    return (
      <fieldset>
        <legend className="mb-2 text-caption font-medium text-ink-700">{legend}</legend>
        <p className="text-body-sm text-ink-500">Nothing to filter by yet.</p>
      </fieldset>
    );
  }
  return (
    <fieldset>
      <legend className="mb-2 text-caption font-medium text-ink-700">{legend}</legend>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => {
          const inputId = `${id}-${opt.value}`;
          return (
            <div key={opt.value} className="flex items-center gap-2">
              <input
                id={inputId}
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => onToggle(opt.value)}
                className="h-4 w-4 accent-pine-700"
              />
              <label htmlFor={inputId} className="text-body-sm text-ink-900">
                {opt.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export default ScholarshipFilters;
