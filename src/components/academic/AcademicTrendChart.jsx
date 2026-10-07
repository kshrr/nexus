import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { EXAM_TYPES, EXAM_TYPE_LABELS } from '@/types';
import { pointsToGrade } from '@/lib/format';

// A six-step sequential ramp (ui-spec §2.6 — no gradients, no pie charts).
const RAMP = ['#1F4438', '#2F6A55', '#6B7F3E', '#B26B00', '#A33A22', '#4B5A66'];

/**
 * Performance across the three exam periods (FR-ACAD-06, ui-spec §2.6).
 *
 * The y-axis is grade points 0-9 but is labelled with letter grades, because a
 * student thinks in A/B/C. A dashed reference line marks the 7.0 "Strong"
 * threshold (§8.3). Lines are directly labelled at their right end rather than
 * relying on a legend; a compact table beneath is the text alternative.
 *
 * @param {{ series: { name: string, points: Record<string, number | null> }[] }} props
 */
export function AcademicTrendChart({ series }) {
  const shown = series.slice(0, 6); // max 6 lines (ui-spec §2.6)

  const data = EXAM_TYPES.map((examType) => {
    const row = { exam: EXAM_TYPE_LABELS[examType] };
    for (const s of shown) row[s.name] = s.points[examType] ?? null;
    return row;
  });

  if (!shown.length) return null;

  return (
    <div>
      <div className="h-72 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 96, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#E8E1D7" vertical={false} />
            <XAxis dataKey="exam" tick={{ fill: '#4A423A', fontSize: 12 }} tickLine={false} />
            <YAxis
              domain={[0, 9]}
              ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}
              tickFormatter={pointsToGrade}
              tick={{ fill: '#7A6F63', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <ReferenceLine
              y={7}
              stroke="#C4B9AC"
              strokeDasharray="4 4"
              label={{ value: 'Strong', position: 'left', fill: '#7A6F63', fontSize: 11 }}
            />
            {shown.map((s, i) => (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={RAMP[i % RAMP.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
                label={({ x, y, index }) =>
                  index === data.length - 1 ? (
                    <text x={x + 8} y={y} dy={4} fill={RAMP[i % RAMP.length]} fontSize={11}>
                      {s.name}
                    </text>
                  ) : null
                }
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Text alternative — required, not optional (ui-spec §2.6) */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-body-sm">
          <caption className="sr-only">
            Grades by subject across the three examination periods
          </caption>
          <thead>
            <tr className="border-b border-ink-300 text-left text-caption text-ink-500">
              <th className="py-2 pr-3">Subject</th>
              {EXAM_TYPES.map((et) => (
                <th key={et} className="px-2 py-2">
                  {EXAM_TYPE_LABELS[et]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.name} className="border-b border-ink-100">
                <td className="py-2 pr-3 text-ink-900">{s.name}</td>
                {EXAM_TYPES.map((et) => (
                  <td key={et} className="px-2 py-2 tabular-nums text-ink-700">
                    {s.points[et] == null ? '—' : pointsToGrade(s.points[et])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AcademicTrendChart;
