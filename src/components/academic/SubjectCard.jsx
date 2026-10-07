import { Badge } from '@/components/ui';
import { pointsToGrade, strengthLabel, strengthVariant } from '@/lib/format';

/**
 * One subject in the strength grid (FR-ACAD-04 / AC-18, ui-spec §3.8).
 * Shows the strength label, the average grade and the number of examinations
 * counted — all three are required by §3.4.2. The exam count matters: it tells
 * the student that a "Strong" from one exam is weaker evidence than one from
 * three, without the system having to say so.
 *
 * @param {{ subject: { name: string, strength: string, averagePoints: number, examCount: number } }} props
 */
export function SubjectCard({ subject }) {
  return (
    <div className="rounded-card border border-ink-300 bg-surface p-4">
      <p className="text-body-sm font-medium text-ink-900">{subject.name}</p>
      <div className="mt-2">
        <Badge variant={strengthVariant(subject.strength)}>{strengthLabel(subject.strength)}</Badge>
      </div>
      <p className="mt-2 text-body-sm tabular-nums text-ink-700">
        {pointsToGrade(subject.averagePoints)} · {subject.examCount}{' '}
        {subject.examCount === 1 ? 'exam' : 'exams'}
      </p>
    </div>
  );
}

export default SubjectCard;
