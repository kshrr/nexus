import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Alert, Button, Card, EmptyState } from '@/components/ui';
import { LoadingState } from '@/components/feedback';
import { GradeEntryTable } from '@/components/academic/GradeEntryTable';
import { SubjectCard } from '@/components/academic/SubjectCard';
import { AcademicTrendChart } from '@/components/academic/AcademicTrendChart';
import { StrengthSummary } from '@/components/academic/StrengthSummary';
import { useAuth } from '@/context/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSubjects } from '@/hooks/useSubjects';
import { useAcademicResults } from '@/hooks/useAcademicResults';
import { useSubjectStrengths } from '@/hooks/useSubjectStrengths';
import { GRADE_POINTS } from '@/types';

/**
 * Academic analysis (FR06, ui-spec §3.8).
 *
 * Three regions: the editable results table, the subject strength grid, then
 * the trend chart and written summary.
 *
 * Classification is NOT done here — saving calls `compute_subject_strengths()`
 * in PostgreSQL, which is the single definition of the Strong/Average/Weak rule
 * (architecture.md §8.1, §8.3). This page only renders what that returns.
 *
 * The feature is restricted to SPM leavers (FR-ACAD-01 / AC-19); the gate is
 * enforced server-side too, this is the explanation layer.
 */
export function AcademicAnalysis() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { subjects } = useSubjects();
  const { replaceGrades, saving } = useProfile();
  const {
    selectedCodes,
    grades,
    loading: loadingGrades,
    setSelectedCodes,
    setGrades,
    reload: reloadGrades,
  } = useAcademicResults();
  const { strengths, loading: loadingStrengths, reload: reloadStrengths } = useSubjectStrengths();
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const isSpm = profile?.education_level === 'spm';

  if (!isSpm) {
    return (
      <>
        <PageHeader
          title="Academic analysis"
          back={{ to: '/find-your-path', label: 'Find your path' }}
        />
        <Alert variant="info" title="Results analysis is for SPM leavers only.">
          Pre-university grading isn&rsquo;t standardised across programmes, so Nexus doesn&rsquo;t
          analyse it. Your recommendations will use your interests and goals instead — that path is
          fully supported, and every recommendation will say so.
        </Alert>
        <div className="mt-4">
          <Button onClick={() => navigate('/recommendations')}>See recommendations</Button>
        </div>
      </>
    );
  }

  if (loadingGrades || loadingStrengths) {
    return (
      <>
        <PageHeader
          title="Academic analysis"
          back={{ to: '/find-your-path', label: 'Find your path' }}
        />
        <LoadingState rows={2} />
      </>
    );
  }

  const gradeList = selectedCodes.flatMap((code) =>
    Object.entries(grades[code] ?? {})
      .filter(([, g]) => g)
      .map(([examType, grade]) => ({ subjectCode: code, examType, grade }))
  );

  async function save() {
    setStatus('saving');
    setError(null);
    const { error: err } = await replaceGrades(gradeList);
    if (err) {
      setStatus('error');
      setError(err);
      return;
    }
    setStatus('saved');
    await Promise.all([reloadGrades(), reloadStrengths()]);
  }

  // series for the trend chart: subject -> points per exam period
  const nameOf = Object.fromEntries(subjects.map((s) => [s.code, s.name]));
  const series = selectedCodes
    .map((code) => ({
      name: nameOf[code] ?? code,
      points: Object.fromEntries(
        Object.entries(grades[code] ?? {})
          .filter(([, g]) => g)
          .map(([examType, grade]) => [examType, GRADE_POINTS[grade] ?? null])
      ),
    }))
    .filter((s) => Object.keys(s.points).length > 0);

  return (
    <>
      <PageHeader
        title="Academic analysis"
        description="Your grades across the three exam periods, and what they say about your strengths."
        back={{ to: '/find-your-path', label: 'Find your path' }}
      />

      {error && (
        <Alert variant="error" title="We couldn’t save your results" className="mb-4">
          {error.message}
        </Alert>
      )}

      {/* 1. results table -------------------------------------------- */}
      <Card
        variant="titled"
        title="Your results"
        className="mb-6"
        action={
          status === 'saving' || saving ? (
            <span className="text-body-sm text-ink-500">Saving…</span>
          ) : status === 'saved' ? (
            <span className="text-body-sm text-pine-700">Saved</span>
          ) : null
        }
      >
        <GradeEntryTable
          subjects={subjects}
          selectedCodes={selectedCodes}
          grades={grades}
          onAddSubject={(code) => {
            setSelectedCodes((c) => [...c, code]);
            setStatus('idle');
          }}
          onRemoveSubject={(code) => {
            setSelectedCodes((c) => c.filter((x) => x !== code));
            setGrades((g) => {
              const n = { ...g };
              delete n[code];
              return n;
            });
            setStatus('idle');
          }}
          onGradeChange={(code, examType, grade) => {
            setGrades((g) => ({ ...g, [code]: { ...g[code], [examType]: grade } }));
            setStatus('idle');
          }}
        />
        <Button className="mt-4 w-fit" onClick={save} disabled={saving}>
          Save results
        </Button>
      </Card>

      {/* 2. strength grid -------------------------------------------- */}
      {strengths.length === 0 ? (
        <EmptyState
          title="No subjects classified yet"
          description="Add the subjects you sat and the grades you have, then save. Nexus works out where you are consistently strong."
        />
      ) : (
        <>
          <h2 className="mb-3 text-h2 font-serif">Your subject strengths</h2>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {strengths.map((s) => (
              <SubjectCard key={s.subjectCode} subject={s} />
            ))}
          </div>

          {/* 3. trend chart + written summary -------------------------- */}
          {series.length > 0 && (
            <Card variant="titled" title="How you changed across the exams" className="mb-6">
              <AcademicTrendChart series={series} />
            </Card>
          )}

          <StrengthSummary strengths={strengths} />

          <div className="mt-6">
            <Button onClick={() => navigate('/recommendations')}>
              See recommendations with these strengths
            </Button>
          </div>
        </>
      )}
    </>
  );
}

export default AcademicAnalysis;
