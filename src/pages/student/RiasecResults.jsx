import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Button, Card, EmptyState } from '@/components/ui';
import { LoadingState } from '@/components/feedback';
import { HollandCodePlate } from '@/components/riasec/HollandCodePlate';
import { RiasecRadarChart } from '@/components/riasec/RiasecRadarChart';
import { DimensionScoreList } from '@/components/riasec/DimensionScoreList';
import { DimensionDescription } from '@/components/riasec/DimensionDescription';
import { resultToScores, useInterpretation, useRiasecResult } from '@/hooks/useRiasec';
import { useAuth } from '@/context/useAuth';
import { formatDate } from '@/lib/format';

/**
 * RIASEC results (FR-RIASEC-07/08 / AC-17, ui-spec §3.7).
 *
 * Radar chart plus an always-visible score list (its text alternative), the
 * Holland Code, and a written description per dominant letter covering
 * personality traits, career fields and academic areas — exactly what §3.4.1
 * requires.
 */
export function RiasecResults() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { result, loading } = useRiasecResult();
  const { blocks, loading: loadingBlocks } = useInterpretation(result?.holland_code);

  if (loading) {
    return (
      <>
        <PageHeader
          title="Your interest profile"
          back={{ to: '/find-your-path', label: 'Find your path' }}
        />
        <LoadingState rows={2} />
      </>
    );
  }

  if (!result) {
    return (
      <>
        <PageHeader
          title="Your interest profile"
          back={{ to: '/find-your-path', label: 'Find your path' }}
        />
        <EmptyState
          title="Take the assessment to see your profile"
          description="36 short questions, about 8 minutes. It's the starting point for every recommendation."
          action={
            <Button onClick={() => navigate('/find-your-path/assessment')}>Start assessment</Button>
          }
        />
      </>
    );
  }

  const scores = resultToScores(result);
  const isSpm = profile?.education_level === 'spm';

  return (
    <>
      <PageHeader
        title="Your interest profile"
        description={`Based on the assessment you completed on ${formatDate(result.completed_at)}.`}
        back={{ to: '/find-your-path', label: 'Find your path' }}
        actions={
          <Button variant="secondary" onClick={() => navigate('/find-your-path/assessment')}>
            Retake
          </Button>
        }
      />

      <Card variant="soft" className="mb-6 overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[auto,1fr] lg:items-center">
          <HollandCodePlate code={result.holland_code} />
          {blocks.length > 0 && (
            <p className="max-w-prose text-body text-ink-900">
              {blocks.map((b) => b.summary).join(' ')}
            </p>
          )}
        </div>
      </Card>

      <Card variant="elevated" title="Your six scores" className="mb-8">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <RiasecRadarChart scores={scores} />
          <DimensionScoreList scores={scores} />
        </div>
      </Card>

      <h2 className="mb-3 text-h2 font-serif">What this means</h2>
      {loadingBlocks ? (
        <LoadingState rows={3} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {blocks.map((block) => (
            <DimensionDescription key={block.letter} block={block} />
          ))}
        </div>
      )}

      <Card className="mt-8 bg-pine-900 text-white">
        <p className="text-body text-pine-100">
          {isSpm
            ? 'Next: add your SPM results so recommendations can use your subject strengths as well as your interests.'
            : 'Next: see the courses and careers these interests point towards.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {isSpm && (
            <Button variant="secondary" onClick={() => navigate('/find-your-path/academic')}>
              Add academic results
            </Button>
          )}
          <Button onClick={() => navigate('/recommendations')}>See recommendations</Button>
        </div>
      </Card>
    </>
  );
}

export default RiasecResults;
