import '@/styles/rail-assessment.css';

/**
 * Assessment progress (FR-RIASEC-12, ui-spec §3.6). A bar paired with the
 * count in text — a bar alone is not accessible.
 *
 * @param {{ answered: number, total: number }} props
 */
export function AssessmentProgress({ answered, total }) {
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="rail-assessment-progress">
      <div className="rail-assessment-progress-labels">
        <p>
          {answered} of {total} answered
        </p>
        <p>{pct}%</p>
      </div>
      <div
        className="rail-assessment-progress-track"
        role="progressbar"
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Assessment progress"
      >
        <div className="rail-assessment-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default AssessmentProgress;
