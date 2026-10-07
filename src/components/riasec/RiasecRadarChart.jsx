import { useEffect, useRef, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import { RIASEC_DIMENSIONS, RIASEC_LETTERS } from '@/types';

const MAX = 24; // §7.2 — six items × max 4

/**
 * Radar chart of all six dimensions (FR-RIASEC-07 / AC-17, ui-spec §2.6).
 *
 * Axis ticks at 0/6/12/18/24; the polygon draws once on first load and never
 * re-animates on rerender (ui-spec §0.6). A persistent text alternative is
 * rendered as a sibling by <DimensionScoreList> — the chart is a primary output
 * of the module and must be readable without sight (ui-spec §2.6, §13).
 *
 * @param {{ scores: Record<string, number> }} props
 */
export function RiasecRadarChart({ scores }) {
  const hasAnimated = useRef(false);
  const [animate, setAnimate] = useState(!hasAnimated.current);

  useEffect(() => {
    hasAnimated.current = true;
    const t = setTimeout(() => setAnimate(false), 700);
    return () => clearTimeout(t);
  }, []);

  const data = RIASEC_LETTERS.map((letter) => ({
    letter,
    label: `${letter} · ${RIASEC_DIMENSIONS[letter]}`,
    score: scores?.[letter] ?? 0,
  }));

  return (
    <div className="h-72 w-full sm:h-80" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#8DB7A4" strokeWidth={0.7} />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: '#4A423A', fontSize: 11 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            domain={[0, MAX]}
            ticks={[0, 6, 12, 18, 24]}
            tick={{ fill: '#7A6F63', fontSize: 10 }}
            axisLine={false}
          />
          <Radar
            dataKey="score"
            stroke="#1F4438"
            strokeWidth={2}
            fill="#1F4438"
            fillOpacity={0.24}
            isAnimationActive={animate}
            animationDuration={600}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RiasecRadarChart;
