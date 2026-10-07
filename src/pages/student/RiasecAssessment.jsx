import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Alert, Button, Card, Spinner } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/feedback';
import { QuestionCard } from '@/components/riasec/QuestionCard';
import { AssessmentProgress } from '@/components/riasec/AssessmentProgress';
import { submitAssessment, useRiasecQuestions } from '@/hooks/useRiasec';

const AUTO_ADVANCE_MS = 250;

/**
 * The 36-item assessment (FR05, ui-spec §3.6).
 *
 * Item text comes from the Edge Function without any dimension mapping, so the
 * browser never sees the answer key (AC-16). Submission is blocked while any
 * item is unanswered and the outstanding items are listed (FR-RIASEC-03 /
 * AC-14). There is no Skip control (D-03).
 */
export function RiasecAssessment() {
  const navigate = useNavigate();
  const { questions, scale, loading, error, reload } = useRiasecQuestions();

  const [stage, setStage] = useState('intro'); // intro | questions | review
  const [answers, setAnswers] = useState({}); // questionId -> 0..4
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [highlightUnanswered, setHighlightUnanswered] = useState(false);
  const advanceTimer = useRef(null);

  const labels = scale?.labels ?? [];
  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const unanswered = useMemo(
    () => questions.filter((q) => answers[q.id] === undefined),
    [questions, answers]
  );

  function answer(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Auto-advance, but `Next` stays available for anyone who prefers explicit
    // control and for keyboard users (ui-spec §3.6).
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      setIndex((i) => (i < total - 1 ? i + 1 : i));
      if (index >= total - 1) setStage('review');
    }, AUTO_ADVANCE_MS);
  }

  async function submit() {
    if (unanswered.length > 0) {
      setHighlightUnanswered(true);
      setStage('review');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const responses = questions.map((q) => ({ question_id: q.id, value: answers[q.id] }));
    const { error: err } = await submitAssessment(responses);
    setSubmitting(false);
    if (err) {
      setSubmitError(err);
      return;
    }
    navigate('/find-your-path/results', { replace: true });
  }

  // ---------------------------------------------------------------- states
  if (loading) {
    return (
      <>
        <PageHeader
          title="Interest assessment"
          back={{ to: '/find-your-path', label: 'Find your path' }}
        />
        <LoadingState rows={1} />
      </>
    );
  }

  if (error || total === 0) {
    return (
      <>
        <PageHeader
          title="Interest assessment"
          back={{ to: '/find-your-path', label: 'Find your path' }}
        />
        <ErrorState
          title="We couldn’t load the assessment"
          message={error?.message ?? 'The question set came back empty. Try again in a moment.'}
          onRetry={reload}
        />
      </>
    );
  }

  if (submitting) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <Spinner size="lg" label="Working out your profile" />
        <p className="text-body text-ink-700">Working out your profile…</p>
      </div>
    );
  }

  // ---------------------------------------------------------------- intro
  if (stage === 'intro') {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="Interest assessment"
          back={{ to: '/find-your-path', label: 'Find your path' }}
        />
        <Card variant="soft" className="relative overflow-hidden p-6 md:p-8">
          <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-lime/60" aria-hidden="true" />
          <p className="text-caption font-semibold text-pine-700">BEFORE YOU START</p>
          <h2 className="mt-2 text-h2 font-serif">There are no right or wrong answers.</h2>
          <div className="flex flex-col gap-3 text-body text-ink-900">
            <p className="mt-4">
              {total} short questions about activities you might enjoy. There are no right answers,
              and this isn&rsquo;t a test of ability — it&rsquo;s about what interests you.
            </p>
            <p>
              Takes about 8 minutes. You&rsquo;ll need to answer all {total} before you can see
              results.
            </p>
            <Button size="lg" className="mt-2 w-fit" onClick={() => setStage('questions')}>
              Start assessment
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------- review
  if (stage === 'review') {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="Nearly there"
          back={{ to: '/find-your-path', label: 'Find your path' }}
        />
        <AssessmentProgress answered={answeredCount} total={total} />

        {submitError && (
          <Alert variant="error" title="We couldn’t save your answers" className="mb-4">
            {submitError.message} Your answers are still here — try again.
          </Alert>
        )}

        {unanswered.length === 0 ? (
          <Card>
            <p className="text-body text-ink-900">
              All {total} questions answered. Ready when you are.
            </p>
            <Button size="lg" className="mt-4" onClick={submit}>
              See my results
            </Button>
          </Card>
        ) : (
          <Card variant="titled" title={`${unanswered.length} still to answer`}>
            <p className="text-body-sm text-ink-700">
              You can&rsquo;t see results until every question is answered. Jump to any of these:
            </p>
            <ul className="mt-3 flex flex-col gap-1">
              {unanswered.map((q) => {
                const position = questions.findIndex((x) => x.id === q.id);
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      className="text-left text-body-sm text-pine-700 underline"
                      onClick={() => {
                        setIndex(position);
                        setStage('questions');
                      }}
                    >
                      Question {position + 1}: {q.text}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <div className="mt-4">
          <Button variant="secondary" onClick={() => setStage('questions')}>
            Back to questions
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- questions
  const question = questions[index];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Interest assessment"
        back={{ to: '/find-your-path', label: 'Find your path' }}
      />
      <AssessmentProgress answered={answeredCount} total={total} />

      <QuestionCard
        question={question}
        labels={labels}
        value={answers[question.id] ?? null}
        onChange={(value) => answer(question.id, value)}
        index={index}
        total={total}
        highlight={highlightUnanswered && answers[question.id] === undefined}
      />

      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          Back
        </Button>
        {index < total - 1 ? (
          <Button onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>Next</Button>
        ) : (
          <Button onClick={() => setStage('review')}>Review answers</Button>
        )}
      </div>
    </div>
  );
}

export default RiasecAssessment;
