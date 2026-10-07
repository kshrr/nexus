import { RIASEC_DIMENSIONS, RIASEC_LETTERS } from '@/types';

const MAX = 24;

/**
 * The six scores as a definition list. This is the radar chart's text
 * alternative and is ALWAYS visible, never hidden behind a toggle
 * (ui-spec §2.6, §3.7). Ordered highest first, ties broken by the canonical
 * hexagon order so it matches the Holland Code (§7.3).
 *
 * @param {{ scores: Record<string, number> }} props
 */
export function DimensionScoreList({ scores }) {
  const ranked = [...RIASEC_LETTERS].sort((a, b) => {
    const diff = (scores?.[b] ?? 0) - (scores?.[a] ?? 0);
    if (diff !== 0) return diff;
    return RIASEC_LETTERS.indexOf(a) - RIASEC_LETTERS.indexOf(b);
  });

  return (
    <dl className="flex flex-col gap-2">
      {ranked.map((letter) => {
        const score = scores?.[letter] ?? 0;
        return (
          <div key={letter} className="flex items-center gap-3">
            <dt className="w-40 shrink-0 text-body-sm text-ink-900">
              <span className="font-medium">{letter}</span> · {RIASEC_DIMENSIONS[letter]}
            </dt>
            <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-ink-100">
              <div
                className="h-full bg-pine-700"
                style={{ width: `${Math.round((score / MAX) * 100)}%` }}
              />
            </div>
            <dd className="w-16 shrink-0 text-right text-body-sm tabular-nums text-ink-700">
              {score} / {MAX}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export default DimensionScoreList;
