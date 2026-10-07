import { Link } from 'react-router-dom';
import { Alert, Card } from '@/components/ui';
import { RIASEC_DIMENSIONS } from '@/types';

/**
 * The "Why these suggestions" panel at the top of /recommendations
 * (ui-spec §3.9 / §5). One of the three points at which the student is told
 * *why*, all reading from the same data the cards use.
 *
 * @param {{ hollandCode: string | null, strengths: any[], degradedMode: boolean,
 *   generatedAt: string | null }} props
 */
export function RecommendationExplanation({ hollandCode, strengths, degradedMode }) {
  const letters = (hollandCode ?? '')
    .split('')
    .map((l) => RIASEC_DIMENSIONS[l])
    .filter(Boolean);
  const strong = strengths.filter((s) => s.strength === 'strong').map((s) => s.name);
  const list = (items) => items.join(', ').replace(/, ([^,]*)$/, ' and $1');

  return (
    <Card variant="titled" title="Why these suggestions" className="mb-6">
      <div className="flex max-w-prose flex-col gap-2 text-body text-ink-900">
        {letters.length > 0 && <p>Your top interests are {list(letters)}.</p>}
        {strong.length > 0 ? (
          <p>You are consistently strong in {list(strong)}. These pathways ask for both.</p>
        ) : (
          !degradedMode && (
            <p>
              None of your subjects reached the Strong band, so these suggestions lean on your
              interests and goals.
            </p>
          )
        )}
        <p className="text-body-sm text-ink-500">
          Every card below lists the exact conditions that were checked, including the ones you do
          not meet yet, and names the rule that produced it.
        </p>
      </div>
    </Card>
  );
}

/**
 * Persistent degraded-mode notice (§9.4 / AC-25, ui-spec §3.9). Shown whenever
 * the engine ran without any subject strengths.
 */
export function DegradedModeNotice() {
  return (
    <Alert variant="info" title="These are based on your interests only." className="mb-6">
      You haven&rsquo;t added exam results, so we couldn&rsquo;t check subject strengths. Conditions
      about school subjects were left out of the scoring entirely rather than counted against you.{' '}
      <Link to="/profile" className="text-pine-700 underline">
        Add your results
      </Link>{' '}
      for stronger matches.
    </Alert>
  );
}

export default RecommendationExplanation;
