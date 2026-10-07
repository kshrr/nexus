import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, Icon, Skeleton } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { PathwayRoadmap } from '@/components/career/PathwayRoadmap';
import { FitExplanation } from '@/components/career/FitExplanation';
import { DeadlineBadge } from '@/components/scholarship/DeadlineBadge';
import { useCareer } from '@/hooks/useCareers';
import { useRiasecResult } from '@/hooks/useRiasec';
import { useSubjectStrengths } from '@/hooks/useSubjectStrengths';
import { useSavedItems } from '@/hooks/useSavedItems';
import { useAuth } from '@/context/useAuth';
import { buildCareerFit } from '@/lib/careerFit';
import { EDUCATION_LEVEL_LABELS, RIASEC_DIMENSIONS } from '@/types';

const SUBJECT_LABELS = {
  BM: 'Bahasa Melayu', BI: 'English', SEJARAH: 'Sejarah', MATH: 'Mathematics',
  ADD_MATH: 'Additional Mathematics', PHYSICS: 'Physics', CHEMISTRY: 'Chemistry',
  BIOLOGY: 'Biology', SCIENCE: 'Science', EKONOMI: 'Economics',
  PERNIAGAAN: 'Business', PRINSIP_AKAUN: 'Accounting', ICT: 'ICT',
  SAINS_KOMP: 'Computer Science', REKA_CIPTA: 'Design & Technology', PSV: 'Visual Arts',
};

export function CareerDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { career, stages, courses, scholarships, loading, error, reload } = useCareer(id, profile?.education_level);
  const { result: riasec, loading: loadingRiasec } = useRiasecResult();
  const { strengths, loading: loadingStrengths } = useSubjectStrengths();
  const saved = useSavedItems('career');

  if (loading) {
    return (
      <div>
        <Skeleton variant="text" lines={3} />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,340px]"><Skeleton variant="card" /><Skeleton variant="card" /></div>
      </div>
    );
  }
  if (error) return <ErrorState title="We couldn’t load this career pathway" message={error.message} onRetry={reload} />;
  if (!career) {
    return (
      <div className="rounded-modal border border-dashed border-pine-300 bg-pine-50 px-6 py-14 text-center">
        <h1 className="text-h1 font-serif">We can’t find that career</h1>
        <p className="mt-2 text-body text-ink-700">It may have been archived or the link may be incorrect.</p>
        <Link to="/careers" className="mt-5 inline-flex h-11 items-center rounded-pill bg-pine-700 px-5 text-body-sm font-semibold text-white">Browse careers</Link>
      </div>
    );
  }

  const fit = buildCareerFit(career, riasec, strengths);
  const educationLabel = EDUCATION_LEVEL_LABELS[profile?.education_level] ?? 'your current level';

  return (
    <>
      <Link to="/careers" className="inline-flex min-h-11 items-center text-body-sm text-pine-700 hover:underline">‹ All careers</Link>

      <header className="relative mt-2 overflow-hidden rounded-modal bg-pine-900 p-6 text-white md:p-10">
        <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border-[38px] border-lime/15" aria-hidden="true" />
        <div className="relative max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-white/10 text-white">{career.field}</Badge>
            <Badge className="bg-lime text-pine-900">RIASEC {career.riasec_profile.split('').join('–')}</Badge>
          </div>
          <h1 className="mt-4 text-display font-serif text-white">{career.name}</h1>
          <p className="mt-4 max-w-3xl text-body text-pine-100">{career.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              className="bg-lime text-pine-900 hover:bg-white"
              onClick={() => saved.toggle('career', career.id)}
              disabled={saved.loading}
              iconLeft={<Icon name="bookmark" />}
            >
              {saved.isSaved('career', career.id) ? 'Saved pathway' : 'Save pathway'}
            </Button>
            <a href="#pathway" className="inline-flex h-10 items-center rounded-pill border border-white/30 px-4 text-body-sm font-semibold text-white hover:bg-white/10">See education route</a>
          </div>
        </div>
      </header>

      <div className="mt-6">
        {!loadingRiasec && !loadingStrengths && <FitExplanation fit={fit} hasRiasec={Boolean(riasec)} />}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr,320px]">
        <div className="min-w-0">
          <section aria-labelledby="career-overview">
            <p className="text-caption font-semibold uppercase tracking-widest text-pine-700">What the work involves</p>
            <h2 id="career-overview" className="mt-2 text-h1 font-serif">A closer look at the role</h2>
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-h3">Typical responsibilities</h3>
                <ul className="mt-3 space-y-3">
                  {(career.responsibilities ?? []).map((item) => (
                    <li key={item} className="flex items-start gap-3 text-body-sm text-ink-700"><Icon name="check" className="mt-0.5 h-4 w-4 text-pine-500" />{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-h3">Relevant interests</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {career.riasec_profile.split('').map((letter) => <Badge key={letter} variant="info">{letter} · {RIASEC_DIMENSIONS[letter]}</Badge>)}
                </div>
                <h3 className="mt-6 text-h3">Useful subjects</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(career.useful_subjects ?? []).map((subject) => <Badge key={subject}>{SUBJECT_LABELS[subject] ?? subject}</Badge>)}
                </div>
              </div>
            </div>
          </section>

          <section id="pathway" className="mt-14 scroll-mt-24" aria-labelledby="pathway-heading">
            <p className="text-caption font-semibold uppercase tracking-widest text-pine-700">Starting from {educationLabel}</p>
            <h2 id="pathway-heading" className="mt-2 text-h1 font-serif">Your education pathway</h2>
            <p className="mt-3 max-w-prose text-body text-ink-700">This is one flexible way to plan forward. Compare the alternative routes at each stage—there is rarely only one valid route into a career.</p>
            {stages.length ? (
              <div className="mt-7"><PathwayRoadmap stages={stages} /></div>
            ) : (
              <div className="mt-6 rounded-card border border-dashed border-ink-300 p-6">
                <h3 className="text-h3">Pathway guidance is being prepared</h3>
                <p className="mt-2 text-body-sm text-ink-700">We don’t yet have a reviewed roadmap for this career and education level. Explore the related courses below and verify entry routes with the institution.</p>
              </div>
            )}
            <p className="mt-5 rounded-input bg-amber-100 p-4 text-body-sm text-ink-700"><strong>General guidance:</strong> programme entry, accreditation, professional registration and licensing requirements can change. Confirm formal requirements with the relevant institution or professional body.</p>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <Card variant="soft">
            <h2 className="text-h3 font-serif">Skills to build</h2>
            <ul className="mt-3 space-y-2">
              {(career.required_skills ?? []).map((skill) => <li key={skill} className="flex items-center gap-2 text-body-sm text-ink-700"><span className="h-1.5 w-1.5 rounded-full bg-pine-500" />{skill}</li>)}
            </ul>
          </Card>
          <Card>
            <h2 className="text-h3 font-serif">Common study routes</h2>
            <ul className="mt-3 space-y-3">
              {(career.education_routes ?? []).map((route) => <li key={route} className="text-body-sm text-ink-700">{route}</li>)}
            </ul>
          </Card>
        </aside>
      </div>

      <section className="mt-14" aria-labelledby="courses-heading">
        <div className="flex items-end justify-between gap-4"><div><p className="text-caption font-semibold uppercase tracking-widest text-pine-700">Study options already in Nexus</p><h2 id="courses-heading" className="mt-2 text-h1 font-serif">Related courses</h2></div></div>
        {courses.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <Card key={course.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3"><Badge>{course.field_of_study}</Badge>{course.pathway_type && <span className="text-caption capitalize text-ink-500">{course.pathway_type}</span>}</div>
                <h3 className="mt-3 text-h3 font-serif">{course.name}</h3>
                <p className="mt-1 text-body-sm text-ink-500">{course.university_name ?? 'Institution varies'}</p>
                <p className="mt-3 flex-1 text-body-sm text-ink-700">{course.entry_requirements}</p>
                <Link to={`/courses/${course.id}`} className="mt-5 inline-flex min-h-11 items-center justify-between rounded-pill border border-ink-300 px-4 text-body-sm font-semibold text-pine-700 hover:border-pine-300 hover:bg-pine-50">View course <Icon name="arrowRight" className="h-4 w-4" /></Link>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-card border border-dashed border-ink-300 p-6"><h3 className="text-h3">No related courses mapped yet</h3><p className="mt-2 text-body-sm text-ink-700">The career guidance is available, but an administrator has not linked a course record to this pathway yet.</p></div>
        )}
      </section>

      <section className="mt-14" aria-labelledby="scholarships-heading">
        <p className="text-caption font-semibold uppercase tracking-widest text-pine-700">Opportunities that may support your route</p>
        <h2 id="scholarships-heading" className="mt-2 text-h1 font-serif">Related scholarships</h2>
        {scholarships.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {scholarships.map((scholarship) => (
              <Card key={scholarship.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3"><p className="text-caption font-semibold text-pine-700">{scholarship.provider}</p><DeadlineBadge deadline={scholarship.deadline} /></div>
                <h3 className="mt-3 text-h3 font-serif">{scholarship.name}</h3>
                {scholarship.description && <p className="mt-2 line-clamp-3 flex-1 text-body-sm text-ink-700">{scholarship.description}</p>}
                <Link to={`/scholarships/${scholarship.id}`} className="mt-5 inline-flex min-h-11 items-center justify-between rounded-pill border border-ink-300 px-4 text-body-sm font-semibold text-pine-700 hover:border-pine-300 hover:bg-pine-50">View scholarship <Icon name="arrowRight" className="h-4 w-4" /></Link>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-card border border-dashed border-ink-300 p-6"><h3 className="text-h3">No matching scholarships right now</h3><p className="mt-2 text-body-sm text-ink-700">Nexus only shows real scholarship records whose study fields overlap this pathway. Browse all scholarships to explore broader opportunities.</p><Link to="/scholarships" className="mt-4 inline-flex min-h-11 items-center text-body-sm font-semibold text-pine-700 hover:underline">Browse all scholarships <Icon name="arrowRight" className="ml-2 h-4 w-4" /></Link></div>
        )}
      </section>
    </>
  );
}

export default CareerDetail;

