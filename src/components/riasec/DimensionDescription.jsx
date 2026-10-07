import { Card } from '@/components/ui';

/**
 * One interpretation block, composed per letter for the top three dimensions
 * (§7.5 / D-05). Covers exactly the three things §3.4.1 requires: personality
 * traits, suitable career fields, suitable academic areas.
 *
 * @param {{ block: { letter: string, name: string, summary: string, traits: string,
 *   career_fields: string, academic_areas: string } }} props
 */
export function DimensionDescription({ block }) {
  if (!block) return null;
  return (
    <Card variant="titled" title={`${block.letter} · ${block.name}`}>
      <p className="text-body text-ink-900">{block.summary}</p>
      <dl className="mt-4 flex flex-col gap-3 text-body-sm">
        <div>
          <dt className="text-caption text-ink-500">What this says about you</dt>
          <dd className="mt-0.5 text-ink-700">{block.traits}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-500">Career fields that suit this</dt>
          <dd className="mt-0.5 text-ink-700">{block.career_fields}</dd>
        </div>
        <div>
          <dt className="text-caption text-ink-500">Academic areas that suit this</dt>
          <dd className="mt-0.5 text-ink-700">{block.academic_areas}</dd>
        </div>
      </dl>
    </Card>
  );
}

export default DimensionDescription;
