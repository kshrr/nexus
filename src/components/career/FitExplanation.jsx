import { Link } from 'react-router-dom';
import { Card, Icon } from '@/components/ui';

export function FitExplanation({ fit, hasRiasec }) {
  if (!fit.riasec && !fit.subjects.length) {
    return (
      <Card className="bg-cream">
        <p className="text-caption font-semibold uppercase tracking-wide text-pine-700">
          Personal context
        </p>
        <h2 className="mt-2 text-h3 font-serif">Make this pathway more personal</h2>
        <p className="mt-2 text-body-sm text-ink-700">
          {hasRiasec
            ? 'Reviewed interest context is unavailable or different from your leading interests. That does not rule this career out—interests can develop.'
            : 'Complete Find Your Path to compare this career with your stored interests and academic strengths.'}
        </p>
        {!hasRiasec && (
          <Link
            to="/find-your-path"
            className="mt-4 inline-flex items-center gap-2 text-body-sm font-semibold text-pine-700 hover:underline"
          >
            Go to Find Your Path <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        )}
      </Card>
    );
  }

  return (
    <Card className="border-pine-300 bg-pine-50">
      <p className="text-caption font-semibold uppercase tracking-wide text-pine-700">
        Based on your Nexus profile
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {fit.riasec && (
          <div>
            <p className="text-caption text-ink-500">
              Your RIASEC: {fit.riasec.studentCode.split('').join('–')}
            </p>
            <p className="mt-1 text-body-sm text-ink-900">
              This career relates to your {fit.riasec.shared.map((letter) => letter).join(', ')}{' '}
              interests, including <strong>{fit.riasec.primaryName}</strong>.
            </p>
            <p className="mt-2 text-body-sm text-ink-700">
              Reference: {fit.riasec.reference.name} ({fit.riasec.reference.interest_code}).{' '}
              {fit.riasec.reference.scope_note}
            </p>
          </div>
        )}
        {!!fit.subjects.length && (
          <div>
            <p className="text-caption text-ink-500">Based on your academic strengths</p>
            <p className="mt-1 text-body-sm text-ink-900">
              Your stronger performance in{' '}
              <strong>{fit.subjects.map((s) => s.name).join(' and ')}</strong> may support this
              pathway.
            </p>
          </div>
        )}
      </div>
      <p className="mt-4 text-caption text-ink-500">
        Nexus exploratory context, not a validated suitability score, admission decision or
        professional eligibility check.
      </p>
    </Card>
  );
}

export default FitExplanation;
