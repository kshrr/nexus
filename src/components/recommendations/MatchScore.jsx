/**
 * Match percentage as a plain number in tabular figures — not a progress ring
 * or a gauge. A ring implies precision the rule engine does not have
 * (ui-spec §3.9).
 *
 * @param {{ score: number }} props
 */
export function MatchScore({ score }) {
  return (
    <span className="shrink-0 text-body-sm tabular-nums text-ink-700">
      Match <span className="font-medium text-ink-900">{Math.round(score)}%</span>
    </span>
  );
}

export default MatchScore;
