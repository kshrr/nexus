import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, EmptyState, Skeleton } from '@/components/ui';
import { RailPageHeader } from '@/components/journey/RailPageHeader';
import { RailTabs } from '@/components/journey/RailTabs';
import { RailPagination } from '@/components/journey/RailPagination';
import { RailRecommendationCard } from '@/components/recommendations/RailRecommendationCard';
import { RailScholarshipPanel } from '@/components/recommendations/RailScholarshipPanel';
import {
  RecommendationExplanation,
  DegradedModeNotice,
} from '@/components/recommendations/RecommendationExplanation';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useRiasecResult } from '@/hooks/useRiasec';
import { useSubjectStrengths } from '@/hooks/useSubjectStrengths';
import { useAcademicResults } from '@/hooks/useAcademicResults';
import { useSubjects } from '@/hooks/useSubjects';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/context/useAuth';

export function Recommendations() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const recommendations = useRecommendations();
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
  } = recommendations;
  const { result: riasec, loading: loadingRiasec } = useRiasecResult();
  const { strengths, loading: loadingStrengths } = useSubjectStrengths();
  const {
    grades: academicGrades,
    loading: loadingGrades,
    error: gradesError,
  } = useAcademicResults();
  const { subjects, loading: loadingSubjects, error: subjectsError } = useSubjects();
  const [active, setActive] = useState('careers');
  const [pages, setPages] = useState({ careers: 1, courses: 1 });
  const [scholarshipsVisited, setScholarshipsVisited] = useState(false);
  const [matchRevision, setMatchRevision] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const tabsId = useId();
  const careerRows = [
    ...careers.filter((rec) => rec.detail).map((rec) => ({ rec, secondary: false })),
    ...secondaryCareers.filter((rec) => rec.detail).map((rec) => ({ rec, secondary: true })),
  ];
  const courseRows = courses.filter((rec) => rec.detail);
  const tabs = [
    { id: 'careers', label: 'Careers', count: careerRows.length },
    { id: 'courses', label: 'Courses', count: courseRows.length },
    { id: 'scholarships', label: 'Scholarships' },
  ];
  const busy = loading || loadingRiasec;
  const heading = (
    <RailPageHeader
      station="03"
      label="DESTINATION STATION"
      title="Nexus recommendations"
      description={
        generatedAt
          ? `Profile ${riasec?.holland_code ?? '—'} · updated ${formatDate(generatedAt)}`
          : 'Explore the next connections for your interests and strengths.'
      }
      actions={
        riasec && (
          <div className="rail-recommendation-actions">
            <Button
              disabled={
                generating || loadingStrengths || loadingGrades || loadingSubjects || !hasResults
              }
              loading={downloading}
              onClick={downloadSummary}
            >
              Download counselor summary
            </Button>
            <Button variant="secondary" onClick={regenerateConnections} loading={generating}>
              {hasResults ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
        )
      }
    />
  );

  if (busy)
    return (
      <div className="rail-journey-page">
        {heading}
        <div className="rail-recommendation-grid">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  if (!riasec)
    return (
      <div className="rail-journey-page">
        {heading}
        <EmptyState
          title="Take the interest assessment first"
          description="Your interest profile is the first connection in your journey."
          action={
            <Button onClick={() => navigate('/find-your-path/assessment')}>Start assessment</Button>
          }
        />
      </div>
    );
  const rows = active === 'careers' ? careerRows : courseRows;
  const totalPages = Math.max(1, Math.ceil(rows.length / 4));
  const currentPage = Math.min(pages[active] ?? 1, totalPages);
  function changeTab(id) {
    setActive(id);
    if (id === 'scholarships') setScholarshipsVisited(true);
  }
  async function regenerateConnections() {
    const outcome = await regenerate();
    // Course fields participate in scholarship criteria. Invalidate only
    // after successful persistence, even if the scholarship tab is hidden.
    if (!outcome?.error) setMatchRevision((revision) => revision + 1);
  }
  async function downloadSummary() {
    setDownloading(true);
    setDownloadError(false);
    try {
      const { createCounselorSummaryPdf } = await import('@/lib/counselorSummary');
      createCounselorSummaryPdf({
        profile,
        riasec,
        strengths,
        academicGrades: gradesError ? {} : academicGrades,
        academicResultsUnavailable: Boolean(gradesError),
        subjects: subjectsError ? [] : subjects,
        careers,
        secondaryCareers,
        courses,
        generatedAt,
      }).save('nexus-counselor-summary.pdf');
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rail-journey-page rail-recommendations-page">
      {heading}
      {downloadError && (
        <Alert variant="error" title="We couldn’t download your summary" className="mb-4">
          Please try again.
        </Alert>
      )}
      {error && (
        <Alert variant="error" title="We couldn’t generate recommendations" className="mb-4">
          {error.message}
        </Alert>
      )}
      {degradedMode && <DegradedModeNotice />}
      <RailTabs
        id={tabsId}
        tabs={tabs}
        active={active}
        onChange={changeTab}
        label="Recommendation destinations"
      />
      {active !== 'scholarships' && (
        <section
          className="rail-recommendation-panel"
          role="tabpanel"
          id={`${tabsId}-${active}-panel`}
          aria-labelledby={`${tabsId}-${active}`}
          tabIndex={0}
        >
          <div className="rail-panel-heading">
            <h2>{active === 'careers' ? 'Careers to explore' : 'Courses to explore'}</h2>
            <span>{rows.length} connections</span>
          </div>
          {hasResults && (
            <details className="rail-overview-disclosure">
              <summary>How Nexus chose these connections</summary>
              <RecommendationExplanation
                hollandCode={riasec.holland_code}
                strengths={strengths}
                degradedMode={degradedMode}
              />
            </details>
          )}
          {active === 'careers' && secondaryCareers.length > 0 && (
            <p className="rail-inline-note">
              “Interest overlap” cards use shared RIASEC letters, not academic rules. They are
              separate from rule-based matches.
            </p>
          )}
          {generating && (
            <p className="rail-inline-note" role="status">
              Updating your connections… Existing results remain visible.
            </p>
          )}
          {rows.length ? (
            <>
              <div className="rail-recommendation-grid">
                {rows.slice((currentPage - 1) * 4, currentPage * 4).map((row, index) => (
                  <RailRecommendationCard
                    key={
                      active === 'careers'
                        ? `${row.secondary ? 'overlap' : 'rule'}-${row.rec.target_id || row.rec.detail.id}`
                        : row.target_id
                    }
                    recommendation={active === 'careers' ? row.rec : row}
                    secondary={active === 'careers' && row.secondary}
                    type={active === 'careers' ? 'career' : 'course'}
                    rank={(currentPage - 1) * 4 + index + 1}
                  />
                ))}
              </div>
              <RailPagination
                page={currentPage}
                pages={totalPages}
                onChange={(page) => setPages((previous) => ({ ...previous, [active]: page }))}
                label={`${active} recommendation pages`}
              />
            </>
          ) : (
            <EmptyState
              title={
                active === 'careers' ? 'No career connections yet' : 'No course connections yet'
              }
              description="Generate your recommendations or add more profile information. An empty category does not close off your options."
              action={
                <Button onClick={regenerateConnections} loading={generating}>
                  Generate now
                </Button>
              }
            />
          )}
        </section>
      )}
      {['careers', 'courses']
        .filter((id) => id !== active)
        .map((id) => (
          <section
            key={id}
            role="tabpanel"
            id={`${tabsId}-${id}-panel`}
            aria-labelledby={`${tabsId}-${id}`}
            hidden
          />
        ))}
      <section
        role="tabpanel"
        id={`${tabsId}-scholarships-panel`}
        aria-labelledby={`${tabsId}-scholarships`}
        hidden={active !== 'scholarships'}
        className="rail-recommendation-panel"
        tabIndex={0}
      >
        {scholarshipsVisited && (
          <>
            <div className="rail-panel-heading">
              <h2>Scholarships to explore</h2>
              <span>Eligibility connections</span>
            </div>
            <RailScholarshipPanel matchRevision={matchRevision} />
          </>
        )}
      </section>
      <p className="rail-guidance-note">
        Suggestions to explore—not guaranteed admission or funding. Check official requirements and
        speak with a counsellor.
      </p>
    </div>
  );
}
export default Recommendations;
