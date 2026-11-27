import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Icon, Skeleton } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { useBreadcrumbLabel } from '@/components/layout/breadcrumbContext';
import { CareerRouteMap } from '@/components/career/CareerRouteMap';
import { buildCareerJourney, buildCareerRouteMap } from '@/lib/careerRoutes';
import { FitExplanation } from '@/components/career/FitExplanation';
import { CareerSources } from '@/components/career/CareerSources';
import { careerThemeStyle } from '@/components/career/careerThemes';
import { useCareer } from '@/hooks/useCareers';
import { useRiasecResult } from '@/hooks/useRiasec';
import { useSubjectStrengths } from '@/hooks/useSubjectStrengths';
import { useSavedItems } from '@/hooks/useSavedItems';
import { useAuth } from '@/context/useAuth';
import { buildCareerFit } from '@/lib/careerFit';
import { normaliseCareerEvidence, getSectionReview } from '@/lib/careerEvidence';
import { EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS, RIASEC_DIMENSIONS } from '@/types';
import '@/styles/rail-careers.css';
import '@/styles/career-detail.css';

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
const FIELD_ICONS = {
  'Computing & Technology': 'database',
  Engineering: 'target',
  'Business & Finance': 'chart',
  Science: 'sparkles',
  Healthcare: 'shield',
  Education: 'book',
  'Creative & Design': 'sparkles',
  'Social Sciences': 'user',
};
const MAX_COURSES = 6;
const MAX_SCHOLARSHIPS = 4;
const PATHWAY_LABELS = { foundation: 'Foundation', diploma: 'Diploma', degree: 'Degree' };
const SOURCE_SECTIONS = {
  overview: 'Overview',
  responsibilities: 'What you’ll do',
  skills: 'Skills',
  subjects: 'Useful subjects',
  study_options: 'Study route',
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

function Chips({ items }) {
  return (
    <ul className="cv2-chips">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function RailCard({ title, children }) {
  return (
    <section className="cv2-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function JourneyStage({ number, stage, subjects }) {
  return (
    <li className="cv2-stage">
      <span className="cv2-stage-dot" aria-hidden="true" />
      <article className="cv2-stage-card">
        <p className="cv2-stage-step">
          Stage {number} · {stage.step}
        </p>
        <div className="cv2-stage-head">
          <h3>{stage.title}</h3>
          {stage.duration && <span className="cv2-pill">{stage.duration}</span>}
        </div>
        {stage.id === 'school' && subjects.length > 0 && (
          <>
            <p className="cv2-stage-label">Focus on</p>
            <Chips items={subjects} />
          </>
        )}
        {stage.options && (
          <ul className="cv2-options">
            {stage.options.map((option) => (
              <li key={option.id} data-status={option.status}>
                <strong>{option.label}</strong>
                <span>
                  {option.duration} · {option.statusLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
        {stage.summary && <p className="cv2-stage-summary">{stage.summary}</p>}
      </article>
    </li>
  );
}

export function CareerDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { isAuthenticated, profile } = useAuth();
  const [selectedLevel, setSelectedLevel] = useState('');
  const educationLevel = selectedLevel || profile?.education_level || null;
  const { career, courses, scholarships, loading, error, reload } = useCareer(id, educationLevel);
  useBreadcrumbLabel(career?.name);
  const { result: riasec, loading: loadingRiasec } = useRiasecResult();
  const { strengths, loading: loadingStrengths } = useSubjectStrengths();
  const saved = useSavedItems('career');
  if (loading)
    return (
      <div className="rail-career-page career-v2">
        <Skeleton variant="text" lines={3} />
        <Skeleton variant="card" />
      </div>
    );
  if (error)
    return (
      <div className="rail-career-page career-v2">
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
  const reviewed = (section) => Boolean(getSectionReview(career, section));
  const duties = reviewed('responsibilities') ? (career.responsibilities ?? []) : [];
  const skills = reviewed('skills') ? (career.required_skills ?? []) : [];
  const subjects = reviewed('subjects')
    ? (career.useful_subjects ?? []).map((code) => SUBJECT_LABELS[code] ?? code)
    : [];
  const level = EDUCATION_LEVEL_LABELS[educationLevel];
  const fit = buildCareerFit(career, riasec, strengths);
  const journey = buildCareerJourney(career.slug);
  const routeMap = buildCareerRouteMap(career.slug, educationLevel);
  const stageCount = journey ? journey.length + 1 : 0;

  return (
    <div className="rail-career-page career-v2" style={careerThemeStyle(career.field)}>
      <div className="cv2-layout">
        <div className="cv2-main">
          <header className="cv2-hero">
            <div className="cv2-hero-text">
              <span className="career-theme-label">
                <i aria-hidden="true" />
                {career.field}
              </span>
              <h1>
                {career.name} <span>Pathway</span>
              </h1>
              {overview ? (
                <p className="cv2-lead">{career.description}</p>
              ) : (
                <p className="career-review-note">
                  Content review pending. This record is not reviewed professional guidance.
                </p>
              )}
              <div className="cv2-actions">
                {isAuthenticated ? (
                  <SavePathway key={career.id} saved={saved} careerId={career.id} />
                ) : (
                  <Link className="career-action" to="/login" state={{ from: location }}>
                    <Icon name="bookmark" />
                    Sign in to save pathway
                  </Link>
                )}
                <a className="career-action career-action-secondary" href="#career-roadmap">
                  View roadmap <Icon name="arrowRight" />
                </a>
              </div>
            </div>
            <div className="cv2-hero-art" aria-hidden="true">
              <Icon name={FIELD_ICONS[career.field] ?? 'career'} />
            </div>
          </header>

          {!!evidence.limitations.length && (
            <aside className="career-guidance-notice" aria-label="Source limitations">
              {evidence.limitations.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </aside>
          )}

          <section id="career-roadmap" className="cv2-roadmap" aria-labelledby="roadmap-heading">
            <div className="cv2-section-head">
              <h2 id="roadmap-heading">Career journey roadmap</h2>
              {journey && <span className="cv2-pill">{stageCount} stages</span>}
            </div>
            {journey ? (
              <ol className="cv2-timeline">
                {journey.map((stage, index) => (
                  <JourneyStage
                    key={stage.id}
                    number={index + 1}
                    stage={stage}
                    subjects={subjects}
                  />
                ))}
                <li className="cv2-stage cv2-stage-final">
                  <span className="cv2-stage-dot" aria-hidden="true" />
                  <article className="cv2-stage-card">
                    <p className="cv2-stage-step">Stage {stageCount} · Your career</p>
                    <h3>{career.name}</h3>
                    {duties.length > 0 && (
                      <>
                        <p className="cv2-stage-label">What you’ll do</p>
                        <ul className="cv2-duties">
                          {duties.map((duty) => (
                            <li key={duty}>{duty}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </article>
                </li>
              </ol>
            ) : (
              <div className="career-empty">
                <h3>Roadmap coming soon</h3>
                <p>Reviewed routes for this career have not been added yet.</p>
              </div>
            )}
          </section>

          <section id="career-pathway" className="cv2-planner" aria-labelledby="pathway-heading">
            <h2 id="pathway-heading">Plan from where you are now</h2>
            <div className="cv2-planner-row">
              <div className="career-level-picker">
                <label htmlFor="career-starting-level">Starting education level</label>
                <select
                  id="career-starting-level"
                  value={educationLevel ?? ''}
                  onChange={(event) => setSelectedLevel(event.target.value)}
                >
                  <option value="">Choose a starting level</option>
                  {EDUCATION_LEVELS.map((item) => (
                    <option key={item} value={item}>
                      {EDUCATION_LEVEL_LABELS[item]}
                    </option>
                  ))}
                </select>
              </div>
              {routeMap && (
                <p className="cv2-route-count">
                  <strong>{routeMap.routes.length}</strong>
                  <span>
                    {routeMap.routes.length === 1 ? 'route to follow' : 'routes to compare'}
                  </span>
                </p>
              )}
            </div>
            {!level ? (
              <p className="cv2-hint">
                Choose your current education level to compare the routes from there.
              </p>
            ) : routeMap ? (
              <CareerRouteMap
                key={`${career.slug}-${educationLevel}`}
                map={routeMap}
                careerName={career.name}
                courses={courses}
              />
            ) : (
              <p className="cv2-hint">Reviewed routes for this career have not been added yet.</p>
            )}
            <p className="cv2-footnote">
              A planning aid: admission, credit transfer and registration are decided by each
              institution and professional body.
            </p>
          </section>

          <section className="cv2-study" aria-labelledby="study-heading">
            <div className="cv2-section-head">
              <h2 id="study-heading">Courses and scholarships</h2>
              {level && <span className="cv2-pill">Sorted for {level}</span>}
            </div>
            <div className="cv2-study-grid">
              <div className="cv2-card">
                <h3>Related courses</h3>
                {courses.length ? (
                  <>
                    <p className="cv2-footnote">
                      {courses.length} matching {courses.length === 1 ? 'course' : 'courses'} in the
                      Nexus catalogue
                    </p>
                    <ul className="cv2-links">
                      {courses.slice(0, MAX_COURSES).map((course) => (
                        <li key={course.id}>
                          <Link to={'/courses/' + course.id}>
                            <strong>{course.name}</strong>
                            <span>
                              {PATHWAY_LABELS[course.pathway_type] ?? 'Programme'} ·{' '}
                              {course.university_name ?? 'Check the institution'}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="cv2-footnote">No matching courses in the catalogue yet.</p>
                )}
                <Link className="career-text-link" to="/courses">
                  Browse all courses →
                </Link>
              </div>
              <div className="cv2-card">
                <h3>Scholarships to look at</h3>
                {scholarships.length ? (
                  <ul className="cv2-links">
                    {scholarships.slice(0, MAX_SCHOLARSHIPS).map((item) => (
                      <li key={item.id}>
                        <Link to={'/scholarships/' + item.id}>
                          <strong>{item.name}</strong>
                          <span>
                            {item.provider}
                            {item.openToAllFields ? ' · Any field of study' : ''}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="cv2-footnote">No related scholarships open right now.</p>
                )}
                <Link className="career-text-link" to="/scholarships">
                  Browse all scholarships →
                </Link>
              </div>
            </div>
            <p className="cv2-footnote">
              Matched by study field. Check each provider for entry and eligibility rules.
            </p>
          </section>
        </div>

        <aside className="cv2-rail" aria-label="Career summary">
          {skills.length > 0 && (
            <RailCard title="Essential skills">
              <Chips items={skills} />
            </RailCard>
          )}
          {subjects.length > 0 && (
            <RailCard title="Useful SPM subjects">
              <Chips items={subjects} />
              <p className="cv2-footnote">Useful preparation, not programme entry requirements.</p>
            </RailCard>
          )}
          {isAuthenticated && !loadingRiasec && !loadingStrengths && (
            <div className="cv2-fit">
              <FitExplanation fit={fit} hasRiasec={Boolean(riasec)} />
            </div>
          )}
        </aside>
      </div>

      <details className="cv2-sources">
        <summary>Sources and how this was checked</summary>
        <div className="cv2-sources-body">
          {Object.entries(SOURCE_SECTIONS).map(([section, label]) => {
            const review = getSectionReview(career, section);
            return review ? (
              <div key={section} className="cv2-source-group">
                <h3>{label}</h3>
                <CareerSources review={review} sectionLabel={label} />
              </div>
            ) : null;
          })}
          {evidence.references.length > 0 && (
            <>
              <h3>Interest references</h3>
              <p className="cv2-footnote">
                O*NET is used only for occupational RIASEC interest codes. These U.S. reference
                occupations help you explore interests; Malaysian sources guide the career content
                and education pathway.
              </p>
              <ul className="cv2-references">
                {evidence.references.map((ref) => (
                  <li key={ref.reference_id}>
                    <strong>{ref.name}</strong>
                    <span>
                      {[...ref.interest_code]
                        .map((letter) => `${letter} · ${RIASEC_DIMENSIONS[letter]}`)
                        .join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
              <CareerSources
                review={getSectionReview(career, 'interests')}
                sectionLabel="Occupational interests"
              />
              <p className="cv2-footnote">
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
            </>
          )}
        </div>
      </details>
    </div>
  );
}
export default CareerDetail;
