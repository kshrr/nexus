import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Badge, Card, Icon, Skeleton } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { CourseRequirementTabs } from '@/components/course/CourseRequirementTabs';
import { supabase } from '@/lib/supabase';
import { normaliseError } from '@/lib/api';
import {
  formatCourseDuration,
  safeCourseSource,
  safeRegisteredCourseSource,
  PATHWAY_LABELS,
  TYPE_LABELS,
} from '@/lib/courseCatalogue';
import '@/styles/course-catalogue.css';

export function CourseDetail() {
  const { id } = useParams();
  const location = useLocation();
  const request = useRef(0);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('courses')
        .select('*, universities(name, state, type)')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();
      if (queryError) throw queryError;
      if (version === request.current) setCourse(data ?? null);
    } catch (err) {
      if (version === request.current) setError(normaliseError(err));
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
    return () => {
      request.current += 1;
    };
  }, [load]);

  if (loading) return <Skeleton variant="card" />;
  if (error)
    return (
      <ErrorState title="We couldn’t load this course" message={error.message} onRetry={load} />
    );
  if (!course)
    return (
      <div className="text-center">
        <h1 className="text-h1 font-serif">Course not found</h1>
        <Link to="/courses" className="mt-4 inline-block text-pine-700 underline">
          Back to courses
        </Link>
      </div>
    );
  const sourceUrl =
    course.sync_mode === 'automatic'
      ? safeRegisteredCourseSource(course.source_url)
      : safeCourseSource(course.source_url);
  const back =
    typeof location.state?.from === 'string' && /^\/courses(?:\?|$)/.test(location.state.from)
      ? location.state.from
      : '/courses';
  const prospects = Array.isArray(course.career_prospects)
    ? course.career_prospects.filter((value) => typeof value === 'string')
    : [];
  return (
    <div className="course-design course-detail-page">
      <div className="course-shell">
        <Link to={back} className="course-back-link">
          ← Back to courses
        </Link>
        <header className="course-detail-hero">
          <p className="course-eyebrow">
            <span className="course-station-mark">N</span> YOUR STUDY DESTINATION
          </p>
          <Badge className="course-field-tag">{course.field_of_study}</Badge>
          <h1>{course.name}</h1>
          <p className="course-detail-institution">
            {course.universities?.name ?? 'Institution varies'}
          </p>
          <div className="course-detail-meta">
            <span>
              <span className="course-mini-dot" />
              {course.universities?.state ?? 'Location not listed'}
            </span>
            <span>
              <Icon name="clock" className="h-4 w-4" />
              {formatCourseDuration(course.duration_months)}
            </span>
            <span>{PATHWAY_LABELS[course.pathway_type] ?? 'University programme'}</span>
          </div>
          {sourceUrl && (
            <a
              className="course-primary-button"
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit university website <Icon name="arrowUpRight" className="h-4 w-4" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </header>
        <div className="course-detail-grid">
          <Card
            variant="titled"
            title="Course overview"
            className="course-information-card course-overview-card"
          >
            {course.programme_overview && (
              <p className="mb-5 whitespace-pre-line text-body-sm leading-relaxed text-ink-700">
                {course.programme_overview}
              </p>
            )}
            <dl className="space-y-3 text-body-sm">
              <div>
                <dt className="text-ink-500">Pathway type</dt>
                <dd className="mt-1 capitalize text-ink-900">
                  {PATHWAY_LABELS[course.pathway_type] ?? 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Location</dt>
                <dd className="mt-1 text-ink-900">
                  {course.universities?.state ?? 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Institution type</dt>
                <dd className="mt-1 text-ink-900">
                  {TYPE_LABELS[course.universities?.type] ?? 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Duration</dt>
                <dd className="mt-1 text-ink-900">
                  {course.duration_months
                    ? `${course.duration_months} months`
                    : 'Confirm with institution'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Institution</dt>
                <dd className="mt-1 text-ink-900">{course.universities?.name ?? 'Not linked'}</dd>
              </div>
            </dl>
          </Card>
          <Card
            variant="titled"
            title="Requirements & Prerequisites"
            className="course-information-card course-entry-card"
          >
            <p className="course-section-intro">
              Explore the complete published guidance for your applicant category and entry route.
            </p>
            <CourseRequirementTabs
              key={course.id}
              sections={course.entry_requirement_sections}
              fallback={course.entry_requirements}
            />
            {Array.isArray(course.required_subject_codes) &&
              course.required_subject_codes.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-3">Recorded subject codes</h3>
                  <div className="flex flex-wrap gap-2">
                    {course.required_subject_codes.map((code) => (
                      <Badge key={code} className="course-field-tag">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            <p className="mt-4 text-caption text-ink-500">
              Requirements may change. Confirm the latest entry criteria with the institution before
              applying.
            </p>
          </Card>
          {prospects.length > 0 && (
            <Card
              variant="titled"
              title="Published career prospects"
              className="course-information-card"
            >
              <ul className="grid gap-2 text-body-sm text-ink-700 sm:grid-cols-2">
                {prospects.map((prospect, index) => (
                  <li key={index}>{prospect}</li>
                ))}
              </ul>
              <p className="mt-4 text-caption text-ink-500">
                Examples listed by the university; your career direction depends on your choices and
                further experience.
              </p>
            </Card>
          )}
          {sourceUrl && (
            <Card
              variant="titled"
              title="Official programme information"
              className="course-information-card course-source-card"
            >
              {course.source_academic_session && (
                <p className="mb-3 text-body-sm text-ink-700">
                  Published academic session: {course.source_academic_session}
                </p>
              )}
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="course-primary-button"
              >
                Official programme page
                <Icon name="arrowUpRight" className="h-4 w-4" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <p className="mt-3 text-caption text-ink-500">
                Last source check:{' '}
                {course.last_checked_at
                  ? new Date(course.last_checked_at).toLocaleString('en-MY', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : 'Not recorded'}
              </p>
              <p className="mt-2 text-body-sm leading-relaxed text-ink-700">
                Review the university page for the current intake, application route and admission
                information.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default CourseDetail;
