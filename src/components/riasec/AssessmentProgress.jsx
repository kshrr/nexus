/**
 * Assessment progress (FR-RIASEC-12, ui-spec §3.6). A 4px bar paired with the
 * count in text — a bar alone is not accessible.
 *
 * @param {{ answered: number, total: number }} props
 */
export function AssessmentProgress({ answered, total }) {
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="mb-8 rounded-card border border-pine-100 bg-surface px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-body-sm text-ink-700 tabular-nums">
          {answered} of {total} answered
        </p>
        <p className="text-caption text-ink-500 tabular-nums">{pct}%</p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-pill bg-pine-100"
        role="progressbar"
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Assessment progress"
      >
        <div
          className="h-full rounded-pill bg-pine-700 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default AssessmentProgress;
