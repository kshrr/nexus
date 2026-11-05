import { useId } from 'react';
import { PATHWAY_LABELS, TYPE_LABELS } from '@/lib/courseCatalogue';

export function CourseFilters({ facets, value, onChange }) {
  const id = useId();
  const controls = [
    [
      'state',
      'Location / state',
      'All locations',
      facets.states.map((v) => ({ value: v, label: v })),
    ],
    [
      'university',
      'University',
      'All universities',
      facets.universities.map((u) => ({ value: u.id, label: u.name })),
    ],
    ['field', 'Field of study', 'All fields', facets.fields.map((v) => ({ value: v, label: v }))],
    [
      'pathway',
      'Qualification type',
      'All qualifications',
      facets.pathways.map((v) => ({ value: v, label: PATHWAY_LABELS[v] ?? v })),
    ],
    [
      'type',
      'Institution type',
      'All institution types',
      facets.types.map((v) => ({ value: v, label: TYPE_LABELS[v] ?? v })),
    ],
    [
      'duration',
      'Study duration',
      'Any duration',
      [
        { value: 'under-24', label: 'Under 2 years' },
        { value: '24-48', label: '2–4 years' },
        { value: 'over-48', label: 'Over 4 years' },
      ],
    ],
  ];
  return (
    <div className="course-filter-controls">
      {controls.map(([key, label, empty, options]) => (
        <div key={key} className="course-control">
          <label htmlFor={id + '-' + key}>{label}</label>
          <select
            id={id + '-' + key}
            value={value[key]}
            onChange={(event) => onChange(key, event.target.value)}
          >
            <option value="">{empty}</option>
            {value[key] && !options.some((option) => option.value === value[key]) && (
              <option value={value[key]}>{value[key]}</option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
