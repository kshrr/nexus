import { useMemo, useState } from 'react';
import { Select, Button } from '@/components/ui';
import { EXAM_TYPES, EXAM_TYPE_LABELS, GRADES } from '@/types';
import { pluralise } from '@/lib/format';

/**
 * Grade entry (architecture.md §3.4.1 / ui-spec §3.4 step 3, §3.8).
 * Rows are subjects the student adds from the reference list; columns are the
 * three exam periods (Form 4 Final / SPM Trial / SPM Actual). Empty cells are
 * allowed. Becomes one card per subject below 768px.
 *
 * State is fully controlled by the parent:
 * @param {{
 *   subjects: { code: string, name: string }[],
 *   selectedCodes: string[],
 *   grades: Record<string, Partial<Record<string, string>>>,
 *   onAddSubject: (code: string) => void,
 *   onRemoveSubject: (code: string) => void,
 *   onGradeChange: (code: string, examType: string, grade: string) => void,
 * }} props
 */
export function GradeEntryTable({
  subjects,
  selectedCodes,
  grades,
  onAddSubject,
  onRemoveSubject,
  onGradeChange,
}) {
  const [toAdd, setToAdd] = useState('');

  const byCode = useMemo(() => Object.fromEntries(subjects.map((s) => [s.code, s])), [subjects]);
  const available = subjects.filter((s) => !selectedCodes.includes(s.code));

  const gradeCount = selectedCodes.reduce(
    (n, code) => n + EXAM_TYPES.filter((et) => grades[code]?.[et]).length,
    0
  );

  const gradeOptions = ['', ...GRADES].map((g) => ({ value: g, label: g || '—' }));

  function add() {
    if (!toAdd) return;
    onAddSubject(toAdd);
    setToAdd('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <Select
          label="Add a subject"
          className="flex-1"
          placeholder={available.length ? 'Choose a subject…' : 'All subjects added'}
          value={toAdd}
          options={available.map((s) => ({ value: s.code, label: s.name }))}
          onChange={(e) => setToAdd(e.target.value)}
          disabled={!available.length}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!toAdd}>
          Add
        </Button>
      </div>

      {selectedCodes.length === 0 ? (
        <p className="text-body-sm text-ink-500">
          No subjects added yet. Add the subjects you sat for and enter the grades you have.
        </p>
      ) : (
        <>
          {/* desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="border-b border-ink-300 text-left text-caption text-ink-500">
                  <th className="py-2 pr-3">Subject</th>
                  {EXAM_TYPES.map((et) => (
                    <th key={et} className="px-2 py-2">
                      {EXAM_TYPE_LABELS[et]}
                    </th>
                  ))}
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {selectedCodes.map((code) => (
                  <tr key={code} className="border-b border-ink-100">
                    <td className="py-2 pr-3 font-medium text-ink-900">
                      {byCode[code]?.name ?? code}
                    </td>
                    {EXAM_TYPES.map((et) => (
                      <td key={et} className="px-2 py-1.5">
                        <select
                          aria-label={`${byCode[code]?.name ?? code} — ${EXAM_TYPE_LABELS[et]}`}
                          className="h-9 w-20 rounded-input border border-ink-300 bg-surface px-2 tabular-nums"
                          value={grades[code]?.[et] ?? ''}
                          onChange={(e) => onGradeChange(code, et, e.target.value)}
                        >
                          {gradeOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => onRemoveSubject(code)}
                        className="text-caption text-rust-600 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {selectedCodes.map((code) => (
              <div key={code} className="rounded-card border border-ink-300 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-ink-900">{byCode[code]?.name ?? code}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveSubject(code)}
                    className="text-caption text-rust-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {EXAM_TYPES.map((et) => (
                    <Select
                      key={et}
                      label={EXAM_TYPE_LABELS[et]}
                      value={grades[code]?.[et] ?? ''}
                      options={gradeOptions}
                      onChange={(e) => onGradeChange(code, et, e.target.value)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-body-sm text-ink-500">
            {pluralise(selectedCodes.length, 'subject')}, {pluralise(gradeCount, 'grade')} entered.
          </p>
        </>
      )}
    </div>
  );
}

export default GradeEntryTable;
