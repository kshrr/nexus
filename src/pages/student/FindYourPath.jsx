import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Alert, Button, Card, Icon } from '@/components/ui';
import { LoadingState } from '@/components/feedback';
import { useAuth } from '@/context/useAuth';
import { useRiasecResult } from '@/hooks/useRiasec';
import { useSubjectStrengths } from '@/hooks/useSubjectStrengths';
import { formatDate } from '@/lib/format';

/**
 * Find Your Path hub (M2, ui-spec §3.5). Two entry points, each showing real
 * completion state, and the gate to recommendations.
 *
 * The recommendations button is disabled with an explanation until the RIASEC
 * precondition is met — never a disabled control with no explanation.
 */
export function FindYourPath() {
  const { profile } = useAuth();
  const { result, loading: loadingRiasec } = useRiasecResult();
  const { strengths, loading: loadingStrengths } = useSubjectStrengths();
  const navigate = useNavigate();

  if (loadingRiasec || loadingStrengths) {
    return (
      <>
        <PageHeader title="Find your path" />
        <LoadingState rows={2} />
      </>
    );
  }

  const isSpm = profile?.education_level === 'spm';
  const hasRiasec = Boolean(result);
  const hasAcademics = strengths.length > 0;

  return (
    <>
      <PageHeader
        title="Find your path"
        description="Bring together what interests you and what you are good at, then turn those signals into pathways you can explore."
      />

      <div className="mb-8 grid grid-cols-[1fr,auto,1fr,auto,1fr] items-center gap-2" aria-label="Find your path journey">
        <JourneyStep icon="target" label="Interests" complete={hasRiasec} />
        <span className="h-px bg-pine-100" aria-hidden="true" />
        <JourneyStep icon="chart" label="Strengths" complete={hasAcademics || !isSpm} />
        <span className="h-px bg-pine-100" aria-hidden="true" />
        <JourneyStep icon="sparkles" label="Recommendations" complete={false} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* --- interest assessment ----------------------------------- */}
        <Card as="article" variant="elevated" className="group relative flex flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-1">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-lime" aria-hidden="true" />
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lime text-pine-900"><Icon name="target" /></span>
          <h2 className="mt-6 text-h3 font-sans">Interest assessment</h2>
          <p className="mt-2 flex-1 text-body-sm text-ink-700">
            36 questions, about 8 minutes. Finds the work environments that suit how you think.
          </p>
          <p className="mt-4 text-body-sm">
            {hasRiasec ? (
              <span className="text-pine-700">
                ✓ Completed {formatDate(result.completed_at)} · {result.holland_code}
              </span>
            ) : (
              <span className="text-ink-500">Not started</span>
            )}
          </p>
          <div className="mt-4 flex gap-2">
            {hasRiasec ? (
              <>
                <Button variant="secondary" onClick={() => navigate('/find-your-path/results')}>
                  View results
                </Button>
                <Button variant="tertiary" onClick={() => navigate('/find-your-path/assessment')}>
                  Retake
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate('/find-your-path/assessment')}>
                Start assessment
              </Button>
            )}
          </div>
        </Card>

        {/* --- academic analysis ------------------------------------- */}
        <Card as="article" variant="elevated" className="group relative flex flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-1">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-sky" aria-hidden="true" />
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky text-pine-900"><Icon name="chart" /></span>
          <h2 className="mt-6 text-h3 font-sans">Academic analysis</h2>
          <p className="mt-2 flex-1 text-body-sm text-ink-700">
            See which subjects you&rsquo;re consistently strong in, across three exam periods.
          </p>
          {isSpm ? (
            <>
              <p className="mt-3 text-body-sm">
                {hasAcademics ? (
                  <span className="text-pine-700">
                    ✓ {strengths.length} {strengths.length === 1 ? 'subject' : 'subjects'}{' '}
                    classified
                  </span>
                ) : (
                  <span className="text-ink-500">Not started</span>
                )}
              </p>
              <div className="mt-4">
                <Button
                  variant={hasAcademics ? 'secondary' : 'primary'}
                  onClick={() => navigate('/find-your-path/academic')}
                >
                  {hasAcademics ? 'View analysis' : 'Add your results'}
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-body-sm text-ink-700">
              Nexus analyses results for SPM leavers only, because pre-university grading
              isn&rsquo;t standardised across programmes. Your recommendations will be based on your
              interests and goals.
            </p>
          )}
        </Card>
      </div>

      {/* --- recommendations gate ------------------------------------ */}
      <div className="mt-8">
        {hasRiasec ? (
          <div className="flex flex-col items-start justify-between gap-4 rounded-modal bg-pine-900 p-6 text-white sm:flex-row sm:items-center md:p-8">
            <div><p className="text-caption font-semibold text-lime">YOUR SIGNALS ARE READY</p><h2 className="mt-2 text-h2 font-serif text-white">See where they can take you.</h2></div>
            <Button size="lg" className="bg-lime text-pine-900 hover:bg-white" onClick={() => navigate('/recommendations')}>See my recommendations <Icon name="arrowRight" /></Button>
          </div>
        ) : (
          <Alert variant="info">
            <strong>Complete the interest assessment first.</strong> It is the starting point for
            every recommendation Nexus makes.{' '}
            <Link to="/find-your-path/assessment" className="text-pine-700 underline">
              Start it now
            </Link>
            .
          </Alert>
        )}
      </div>
    </>
  );
}

function JourneyStep({ icon, label, complete }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <span className={`grid h-10 w-10 place-items-center rounded-full ${complete ? 'bg-pine-700 text-white' : 'bg-pine-50 text-pine-700'}`}>
        <Icon name={complete ? 'check' : icon} className="h-4 w-4" />
      </span>
      <span className="text-caption font-medium text-ink-700">{label}</span>
    </div>
  );
}

export default FindYourPath;
