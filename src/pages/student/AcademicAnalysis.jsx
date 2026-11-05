import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RailPageHeader } from '@/components/journey/RailPageHeader';
import { RailTabs } from '@/components/journey/RailTabs';
import { RailPagination } from '@/components/journey/RailPagination';
import { Alert, Button, EmptyState } from '@/components/ui';
import { LoadingState } from '@/components/feedback';
import { GradeEntryTable } from '@/components/academic/GradeEntryTable';
import { SubjectCard } from '@/components/academic/SubjectCard';
import { AcademicTrendChart } from '@/components/academic/AcademicTrendChart';

import { useAuth } from '@/context/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useSubjects } from '@/hooks/useSubjects';
import { useAcademicResults } from '@/hooks/useAcademicResults';
import { useJourneyState } from '@/components/journey/useJourneyState';
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
  const {
    strengths,
    loadingAcademics: loadingStrengths,
    reloadAcademics: reloadStrengths,
  } = useJourneyState();
  const [active, setActive] = useState('entry');
  const [strengthPage, setStrengthPage] = useState(1);
  const tabsId = useId();
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const isSpm = profile?.education_level === 'spm';

  const heading = (
    <RailPageHeader
      station="02"
      label="STRENGTH STATION"
      title="Academic analysis"
      description="Connect your grades, subject strengths and progress across exams."
      actions={
        status === 'saved' ? <span className="rail-saved-label">✓ Results saved</span> : null
      }
    />
  );
  if (!isSpm)
    return (
      <div className="rail-journey-page">
        {heading}
        <Alert variant="info" title="Results analysis is for SPM leavers only.">
          Pre-university grading differs between programmes. Your recommendations use interests and
          goals instead.
        </Alert>
        <div className="rail-next-connection">
          <Button onClick={() => navigate('/recommendations')}>See recommendations</Button>
        </div>
      </div>
    );
  if (loadingGrades || loadingStrengths)
    return (
      <div className="rail-journey-page">
        {heading}
        <LoadingState rows={2} />
      </div>
    );

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

  const tabs = [
    { id: 'entry', label: 'Enter results' },
    { id: 'strengths', label: 'Subject strengths' },
    { id: 'trends', label: 'Exam trends' },
  ];
  const totalPages = Math.max(1, Math.ceil(strengths.length / 4));
  const currentPage = Math.min(strengthPage, totalPages);
  const strong = strengths.filter((s) => s.strength === 'strong');
  const weak = strengths.filter((s) => s.strength === 'weak');
  const domains = [...new Set(strong.map((s) => s.domain).filter(Boolean))];

  return (
    <div className="rail-journey-page rail-academic-page">
      {heading}
      <div className="rail-academic-summary" aria-label="Academic summary">
        <div>
          <span>SUBJECTS CLASSIFIED</span>
          <strong>{strengths.length}</strong>
        </div>
        <div>
          <span>STRONG SUBJECTS</span>
          <strong>{strong.length}</strong>
        </div>
        <div>
          <span>EXAM STOPS</span>
          <strong>03</strong>
        </div>
      </div>
      {error && (
        <Alert variant="error" title="We couldn’t save your results" className="mb-4">
          {error.message}
        </Alert>
      )}
      <RailTabs
        id={tabsId}
        tabs={tabs}
        active={active}
        onChange={setActive}
        label="Academic sections"
      />
      <section
        className="rail-tab-panel"
        role="tabpanel"
        id={`${tabsId}-entry-panel`}
        aria-labelledby={`${tabsId}-entry`}
        hidden={active !== 'entry'}
        tabIndex={0}
      >
        <div className="rail-panel-heading">
          <h2>Your results</h2>
          <span>
            {status === 'saving' || saving
              ? 'Saving…'
              : status === 'saved'
                ? '✓ Saved'
                : 'Save to update your analysis'}
          </span>
        </div>
        <p className="rail-inline-note">
          Enter the grades you have. Empty cells are allowed; switching tabs keeps your edits.
        </p>
        <div className="rail-grade-editor">
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
        </div>
        <div className="rail-panel-footer">
          <Button onClick={save} disabled={saving || status === 'saving'}>
            Save results
          </Button>
          <span>Saving refreshes your subject strengths and route map.</span>
        </div>
      </section>
      <section
        className="rail-tab-panel"
        role="tabpanel"
        id={`${tabsId}-strengths-panel`}
        aria-labelledby={`${tabsId}-strengths`}
        hidden={active !== 'strengths'}
        tabIndex={0}
      >
        <div className="rail-panel-heading">
          <h2>Your subject strengths</h2>
          <span>Based on saved grades</span>
        </div>
        {!strengths.length ? (
          <EmptyState
            title="No subjects classified yet"
            description="Enter your grades and save to explore your strengths."
            action={
              <Button variant="secondary" onClick={() => setActive('entry')}>
                Enter results
              </Button>
            }
          />
        ) : (
          <>
            <div className="rail-subject-grid">
              {strengths.slice((currentPage - 1) * 4, currentPage * 4).map((s) => (
                <SubjectCard key={s.subjectCode} subject={s} />
              ))}
            </div>
            <RailPagination
              page={currentPage}
              pages={totalPages}
              onChange={setStrengthPage}
              label="Subject strength pages"
            />
            <ul className="rail-point-list rail-strength-notes">
              <li>
                {strong.length
                  ? `Strong subjects: ${strong.map((s) => s.name).join(', ')}.`
                  : 'No subjects have reached the Strong band yet. Your interests still offer pathways to explore.'}
              </li>
              {domains.length > 0 && (
                <li>Fields associated with your strong subjects: {domains.join(', ')}.</li>
              )}
              {weak.length > 0 && (
                <li>
                  Subjects to work on: {weak.map((s) => s.name).join(', ')}. Check course entry
                  requirements before deciding.
                </li>
              )}
              <li>
                Strong: A− and above. Average: C+ to B+. Weak: below C+. Bands use the average of
                recorded exams.
              </li>
            </ul>
          </>
        )}
      </section>
      <section
        className="rail-tab-panel"
        role="tabpanel"
        id={`${tabsId}-trends-panel`}
        aria-labelledby={`${tabsId}-trends`}
        hidden={active !== 'trends'}
        tabIndex={0}
      >
        <div className="rail-panel-heading">
          <h2>Your journey across exams</h2>
          <span>Form 4 → SPM Trial → SPM Actual</span>
        </div>
        {active === 'trends' &&
          (series.length > 0 ? (
            <>
              <AcademicTrendChart series={series} />
              <p className="rail-inline-note">
                The chart reflects the grades currently entered. Save changes to update your stored
                analysis.
              </p>
            </>
          ) : (
            <EmptyState
              title="No exam grades to plot yet"
              description="Enter your available grades to see them across the three exam periods."
              action={
                <Button variant="secondary" onClick={() => setActive('entry')}>
                  Enter results
                </Button>
              }
            />
          ))}
      </section>
      <footer className="rail-next-connection">
        <div>
          <span>NEXT CONNECTION</span>
          <p>Your strengths add another perspective to your interests.</p>
        </div>
        <Button onClick={() => navigate('/recommendations')}>See recommendations →</Button>
      </footer>
    </div>
  );
}

export default AcademicAnalysis;
