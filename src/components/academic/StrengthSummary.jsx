import { Card } from '@/components/ui';

/**
 * Written summary of top academic fields and weaker areas (FR-ACAD-05,
 * report §3.4.2).
 *
 * Composed deterministically from the stored classification — it restates what
 * the data says and nothing more. The narrative "insight" in Figure 4.7
 * ("Consistent Growth Detected…") is NOT built: requirements.md §7.6 records
 * that the rule producing it is not specified anywhere in the report.
 *
 * @param {{ strengths: { name: string, domain: string | null, strength: string }[] }} props
 */
export function StrengthSummary({ strengths }) {
  if (!strengths.length) return null;

  const strong = strengths.filter((s) => s.strength === 'strong');
  const weak = strengths.filter((s) => s.strength === 'weak');
  const domains = [...new Set(strong.map((s) => s.domain).filter(Boolean))];
  const list = (items) => items.join(', ').replace(/, ([^,]*)$/, ' and $1');

  return (
    <Card variant="titled" title="What your results say">
      <div className="flex max-w-prose flex-col gap-3 text-body text-ink-900">
        {strong.length > 0 ? (
          <p>
            You are consistently strong in {list(strong.map((s) => s.name))}
            {domains.length > 0 && (
              <>
                , which points towards {list(domains)}
                {domains.length === 1 ? ' as a field' : ' as fields'} of study
              </>
            )}
            .
          </p>
        ) : (
          <p>
            None of your subjects reached the Strong band yet. That does not close any door — it
            means your recommendations will lean more on your interests.
          </p>
        )}

        {weak.length > 0 && (
          <p>
            {list(weak.map((s) => s.name))} {weak.length === 1 ? 'is' : 'are'} currently in the Weak
            band. If a course you want lists {weak.length === 1 ? 'it' : 'one of them'} as an entry
            requirement, that is the area worth the most effort.
          </p>
        )}

        <p className="text-body-sm text-ink-500">
          Bands are set by your average grade across the exams recorded: Strong from A− and above,
          Average from C+ to B+, Weak below C+.
        </p>
      </div>
    </Card>
  );
}

export default StrengthSummary;
