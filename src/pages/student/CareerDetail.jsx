import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon, Skeleton } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { PathwayRoadmap } from '@/components/career/PathwayRoadmap';
import { FitExplanation } from '@/components/career/FitExplanation';
import { CareerSources } from '@/components/career/CareerSources';
import { careerThemeStyle } from '@/components/career/careerThemes';
import { useCareer } from '@/hooks/useCareers';
import { useRiasecResult } from '@/hooks/useRiasec';
import { useSubjectStrengths } from '@/hooks/useSubjectStrengths';
import { useSavedItems } from '@/hooks/useSavedItems';
import { useAuth } from '@/context/useAuth';
import { buildCareerFit } from '@/lib/careerFit';
import {
  normaliseCareerEvidence,
  getSectionReview,
  normaliseStageReview,
} from '@/lib/careerEvidence';
import { EDUCATION_LEVEL_LABELS, RIASEC_DIMENSIONS } from '@/types';
import '@/styles/rail-careers.css';

const SUBJECT_LABELS = {
  BM: 'Bahasa Melayu',
  BI: 'English',
  SEJARAH: 'Sejarah',
  MATH: 'Mathematics',
  ADD_MATH: 'Additional Mathematics',
  PHYSICS: 'Physics',
  CHEMISTRY: 'Chemistry',
  BIOLOGY: 'Biology',
  SCIENCE: 'Science',
  EKONOMI: 'Economics',
  PERNIAGAAN: 'Business',
  PRINSIP_AKAUN: 'Accounting',
  ICT: 'ICT',
  SAINS_KOMP: 'Computer Science',
  REKA_CIPTA: 'Design & Technology',
  PSV: 'Visual Arts',
};
function SavePathway({ saved, careerId }) {
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  async function toggle() {
    setSaving(true);
    setError(null);
    try {
      const response = await saved.toggle('career', careerId);
      setError(response?.error ?? null);
    } catch (err) {
      setError({ message: err.message || 'Could not save this pathway.' });
    } finally {
      setSaving(false);
    }
  }
  return (
    <div>
      <button
        className="career-action"
        type="button"
        disabled={saved.loading || saving}
        onClick={toggle}
        aria-pressed={saved.isSaved('career', careerId)}
      >
        <Icon name="bookmark" />
        {saving ? 'Saving…' : saved.isSaved('career', careerId) ? 'Saved pathway' : 'Save pathway'}
      </button>
      {error && (
        <p className="career-limitation" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}
function ContentPanel({ career, section, title, items, children }) {
  const review = getSectionReview(career, section);
  return (
    <section className="career-detail-panel">
      <h2>{title}</h2>
      {review ? (
        <>
          {children}
          {items && (
            <ul className="career-point-list">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <CareerSources review={review} sectionLabel={title} />
        </>
      ) : (
        <p className="career-review-note">Guidance awaiting source review.</p>
      )}
    </section>
  );
}
export function CareerDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { career, stages, courses, scholarships, loading, error, reload } = useCareer(
    id,
    profile?.education_level
  );
  const { result: riasec, loading: loadingRiasec } = useRiasecResult();
  const { strengths, loading: loadingStrengths } = useSubjectStrengths();
  const saved = useSavedItems('career');
  if (loading)
    return (
      <div className="rail-career-page career-detail-page">
        <Skeleton variant="text" lines={3} />
        <Skeleton variant="card" />
      </div>
    );
  if (error)
    return (
      <div className="rail-career-page career-detail-page">
        <ErrorState
          title="We couldn’t load this career pathway"
          message={error.message}
          onRetry={reload}
        />
      </div>
    );
  if (!career)
    return (
      <div className="rail-career-page career-empty">
        <h1>We can’t find that career</h1>
        <p>It may be archived or the link may be incorrect.</p>
        <Link className="career-action" to="/careers">
          Browse careers
        </Link>
      </div>
    );
  const evidence = normaliseCareerEvidence(career);
  const overview = getSectionReview(career, 'overview');
  const level = EDUCATION_LEVEL_LABELS[profile?.education_level];
  const fit = buildCareerFit(career, riasec, strengths);
  const reviewedStops = stages.filter((stage) => normaliseStageReview(stage.content_review)).length;
  return (
    <div className="rail-career-page career-detail-page" style={careerThemeStyle(career.field)}>
      <Link to="/careers" className="career-back-link">
        ← All careers
      </Link>
      <header className="career-detail-hero">
        <div>
          <p className="career-eyebrow">CAREER DESTINATION / NEXUS</p>
          <span className="career-theme-label">
            <i aria-hidden="true" />
            {career.field}
          </span>
          <h1>{career.name}</h1>
          {overview ? (
            <p>{career.description}</p>
          ) : (
            <p className="career-review-note">
              Content review pending. This record is not reviewed professional guidance.
            </p>
          )}
          <div className="career-hero-actions">
            <SavePathway key={career.id} saved={saved} careerId={career.id} />
            <a className="career-action career-action-secondary" href="#career-pathway">
              See the pathway <Icon name="arrowRight" />
            </a>
          </div>
        </div>
        <div className="career-route-ticket">
          <p className="career-eyebrow">YOUR PLANNING TICKET</p>
          <h2>{level || 'Choose your starting point'}</h2>
          <p>Starting context—not proof of entry eligibility.</p>
          <div className="career-ticket-count">
            <strong>{evidence.status === 'pending' ? '—' : reviewedStops}</strong>
            <span>source-informed / planning stops</span>
          </div>
          <footer>
            <span>PLAN / NOT A GUARANTEE</span>
            <i className="career-barcode" aria-hidden="true" />
          </footer>
        </div>
      </header>
      {!!evidence.limitations.length && (
        <aside className="career-guidance-notice" aria-label="Source limitations">
          {evidence.limitations.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </aside>
      )}
      {!loadingRiasec && !loadingStrengths && (
        <div className="career-personal-context">
          <FitExplanation fit={fit} hasRiasec={Boolean(riasec)} />
        </div>
      )}
      <div className="career-overview-grid">
        <ContentPanel
          career={career}
          section="responsibilities"
          title="What the work involves"
          items={career.responsibilities ?? []}
        />
        <ContentPanel
          career={career}
          section="skills"
          title="Skills to build"
          items={career.required_skills ?? []}
        />
        <ContentPanel career={career} section="subjects" title="Useful subjects">
          <p className="career-review-note">
            Useful preparation, not programme entry requirements.
          </p>
          <div className="career-subject-tags">
            {(career.useful_subjects ?? []).map((subject) => (
              <span key={subject}>{SUBJECT_LABELS[subject] ?? subject}</span>
            ))}
          </div>
        </ContentPanel>
      </div>
      <section className="career-reference-board" aria-labelledby="career-references">
        <p className="career-eyebrow">INTERESTS / NOT A SUITABILITY SCORE</p>
        <h2 id="career-references">Reference occupations</h2>
        <p className="career-section-note">
          O*NET is used only for occupational RIASEC interest codes. These U.S. reference
          occupations help you explore interests; Malaysian sources guide the career content and
          education pathway. A broad career name can cover several specialisms.
        </p>
        {evidence.references.length ? (
          <>
            <div className="career-reference-grid">
              {evidence.references.map((ref) => (
                <article key={ref.reference_id}>
                  <p className="career-reference-type">
                    {ref.mapping_kind === 'example'
                      ? 'EXAMPLE SPECIALISM'
                      : 'OCCUPATIONAL REFERENCE'}
                  </p>
                  <h3>{ref.name}</h3>
                  <p>{ref.scope_note}</p>
                  <div className="career-subject-tags">
                    {[...ref.interest_code].map((letter) => (
                      <span key={letter}>
                        {letter} · {RIASEC_DIMENSIONS[letter]}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <CareerSources
              review={getSectionReview(career, 'interests')}
              sectionLabel="Occupational interests"
            />
          </>
        ) : (
          <p className="career-review-note">
            Reviewed reference interests are unavailable. This does not rule the career out.
          </p>
        )}
      </section>
      <section
        id="career-pathway"
        className="career-pathway-board"
        aria-labelledby="pathway-heading"
      >
        <div className="career-board-heading">
          <div>
            <p className="career-eyebrow">YOUR ROUTE / {level || 'STARTING LEVEL NOT SET'}</p>
            <h2 id="pathway-heading">Your education pathway</h2>
          </div>
          <span className="career-line-key">
            <i aria-hidden="true" />
            PLANNING STOPS
          </span>
        </div>
        <p className="career-section-note">
          A plan for studying and working in Malaysia. Check admission, qualification recognition
          and professional registration separately. Programme places, credit transfer and employment
          are not guaranteed.
        </p>
        {!level ? (
          <p className="career-guidance-notice">
            Set your education level in your profile to choose a starting context.{' '}
            <Link to="/profile">Open profile →</Link>
          </p>
        ) : evidence.status !== 'pending' && stages.length ? (
          <PathwayRoadmap stages={stages} />
        ) : (
          <div className="career-empty">
            <h3>Pathway guidance awaiting review</h3>
            <p>No reviewed roadmap is available for this career and starting context yet.</p>
          </div>
        )}
      </section>
      <ContentPanel
        career={career}
        section="study_options"
        title="Study options to investigate"
        items={career.education_routes ?? []}
      />
      <div className="career-related-grid">
        <section className="career-detail-panel">
          <p className="career-eyebrow">STUDY CONNECTIONS</p>
          <h2>Related courses</h2>
          <p className="career-section-note">
            Catalogue links, not confirmed admission or professional recognition.
          </p>
          {courses.length ? (
            <div className="career-related-items">
              {courses.map((course) => (
                <article key={course.id}>
                  <p>{course.university_name ?? 'Check the institution'}</p>
                  <h3>{course.name}</h3>
                  <Link to={'/courses/' + course.id}>View course details →</Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="career-review-note">No courses mapped to this career yet.</p>
          )}
          <Link className="career-text-link" to="/courses">
            Browse all courses →
          </Link>
        </section>
        <section className="career-detail-panel">
          <p className="career-eyebrow">FUNDING CONNECTIONS</p>
          <h2>Related scholarships</h2>
          <p className="career-section-note">
            Related by study field—not confirmed scholarship eligibility.
          </p>
          {scholarships.length ? (
            <div className="career-related-items">
              {scholarships.map((item) => (
                <article key={item.id}>
                  <p>{item.provider}</p>
                  <h3>{item.name}</h3>
                  <Link to={'/scholarships/' + item.id}>View scholarship details →</Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="career-review-note">No related scholarships available right now.</p>
          )}
          <Link className="career-text-link" to="/scholarships">
            Browse all scholarships →
          </Link>
        </section>
      </div>
      {overview && (
        <section className="career-source-attribution">
          <CareerSources review={overview} sectionLabel="Occupational overview" />
          <p>
            Career content and pathway guidance are prepared by Nexus using the Malaysian sources
            listed for each section.
          </p>
        </section>
      )}
      {!!evidence.references.length && (
        <section className="career-source-attribution" aria-label="Interest data attribution">
          <p>
            Occupational RIASEC interest codes are from O*NET OnLine, National Center for O*NET
            Development.{' '}
            <a
              href="https://www.onetonline.org/help/license"
              target="_blank"
              rel="noopener noreferrer"
            >
              O*NET attribution and licence ↗
            </a>{' '}
            No endorsement or Malaysian eligibility is implied.
          </p>
        </section>
      )}
    </div>
  );
}
export default CareerDetail;
