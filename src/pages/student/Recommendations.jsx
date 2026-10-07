import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Alert, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import {
  RecommendationExplanation,
  DegradedModeNotice,
} from '@/components/recommendations/RecommendationExplanation';
import { CareerCard, SecondaryCareerCard } from '@/components/recommendations/CareerCard';
import { CourseCard } from '@/components/recommendations/CourseCard';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useRiasecResult } from '@/hooks/useRiasec';
import { useSubjectStrengths } from '@/hooks/useSubjectStrengths';
import { formatDate } from '@/lib/format';

/**
 * Recommendations (FR07, FR08, ui-spec §3.9).
 *
 * Its job is not to look impressive; it is to be believable and to show its
 * working. Every card lists the conditions that were checked — including the
 * ones that failed — and names the rule that produced it.
 *
 * The engine is deterministic and knowledge-based. No model is consulted:
 * §4.1.3 excludes ML and adaptive algorithms, and the chatbot is never given
 * authority over recommendation logic.
 */
export function Recommendations() {
  const navigate = useNavigate();
  const {
    careers,
    courses,
    secondaryCareers,
    degradedMode,
    generatedAt,
    loading,
    generating,
    error,
    regenerate,
    hasResults,
  } = useRecommendations();
  const { result: riasec, loading: loadingRiasec } = useRiasecResult();
  const { strengths } = useSubjectStrengths();

  const busy = loading || loadingRiasec;

  // ---- precondition unmet: RIASEC is required (§9.5, 422 RIASEC_REQUIRED)
  if (!busy && !riasec) {
    return (
      <>
        <PageHeader title="Your recommendations" />
        <EmptyState
          title="Take the interest assessment first"
          description="Recommendations start from your interest profile. It takes about 8 minutes, and you can add your exam results afterwards for stronger matches."
          action={
            <Button onClick={() => navigate('/find-your-path/assessment')}>Start assessment</Button>
          }
        />
      </>
    );
  }

  if (busy) {
    return (
      <>
        <PageHeader title="Your recommendations" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Your recommendations"
        description={
          generatedAt
            ? `Based on your interest profile${riasec ? ` (${riasec.holland_code})` : ''}. Updated ${formatDate(generatedAt)}.`
            : 'Generate your ranked courses and careers from your profile.'
        }
        actions={
          <Button variant="secondary" onClick={regenerate} loading={generating}>
            {hasResults ? 'Regenerate' : 'Generate'}
          </Button>
        }
      />

      {error && (
        <Alert variant="error" title="We couldn’t generate recommendations" className="mb-6">
          {error.message}
        </Alert>
      )}

      {degradedMode && <DegradedModeNotice />}

      {hasResults && (
        <RecommendationExplanation
          hollandCode={riasec?.holland_code ?? null}
          strengths={strengths}
          degradedMode={degradedMode}
        />
      )}

      {/* ---- empty: no rule matched (guidance, not an error — AC-24) ---- */}
      {!hasResults && !generating && (
        <EmptyState
          title="We couldn’t match your profile to any pathways yet"
          description="Adding your exam results or retaking the assessment will give us more to work with."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={regenerate} loading={generating}>
                Generate now
              </Button>
              <Button variant="secondary" onClick={() => navigate('/find-your-path/academic')}>
                Add exam results
              </Button>
              <Button variant="tertiary" onClick={() => navigate('/find-your-path/assessment')}>
                Retake assessment
              </Button>
            </div>
          }
        />
      )}

      {/* ---- careers ---------------------------------------------------- */}
      {careers.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-h2 font-serif">Careers</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {careers.map((rec) => (
              <CareerCard key={rec.target_id} recommendation={rec} />
            ))}
          </div>
        </section>
      )}

      {/* ---- courses ---------------------------------------------------- */}
      {courses.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-h2 font-serif">Courses</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {courses.map((rec) => (
              <CourseCard key={rec.target_id} recommendation={rec} />
            ))}
          </div>
        </section>
      )}

      {/* ---- secondary signal, clearly separated (§9.6) ----------------- */}
      {secondaryCareers.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 text-h2 font-serif">Other careers that fit your interests</h2>
          <p className="mb-3 max-w-prose text-body-sm text-ink-700">
            These didn&rsquo;t come from a rule about your results. They are listed because their
            own interest profile overlaps with your Holland Code.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {secondaryCareers.map((entry) => (
              <SecondaryCareerCard key={entry.detail.id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {hasResults && (
        <Card>
          <p className="text-body-sm text-ink-700">
            These are suggestions to explore, not a verdict. Nexus is a guidance tool: it does not
            guarantee a place on any programme, and it does not replace talking to a counsellor.
          </p>
        </Card>
      )}
    </>
  );
}

export default Recommendations;
