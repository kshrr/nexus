import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Alert, Icon, Skeleton } from '@/components/ui';
import { useAuth } from '@/context/useAuth';
import { useRiasecResult } from '@/hooks/useRiasec';
import { useSubjectStrengths } from '@/hooks/useSubjectStrengths';
import { useRecommendations } from '@/hooks/useRecommendations';
import { greeting, firstName } from '@/lib/format';

export function Dashboard() {
  const { user, profile } = useAuth();
  const { result: riasec, loading: loadingRiasec } = useRiasecResult();
  const { strengths, loading: loadingStrengths } = useSubjectStrengths();
  const { careers, courses, loading: loadingRecommendations } = useRecommendations();
  const name = firstName(profile?.full_name) || firstName(user?.email?.split('@')[0]) || 'there';
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('nexus.justCompletedProfile') === '1') {
        setJustCompleted(true);
        sessionStorage.removeItem('nexus.justCompletedProfile');
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const isSpm = profile?.education_level === 'spm';
  const hasAcademics = strengths.length > 0;
  const hasRecommendations = careers.length > 0 || courses.length > 0;
  const steps = [
    { label: 'Profile', done: Boolean(profile), to: '/profile' },
    { label: 'Interests', done: Boolean(riasec), to: '/find-your-path/assessment' },
    ...(isSpm ? [{ label: 'Academics', done: hasAcademics, to: '/find-your-path/academic' }] : []),
    { label: 'Recommendations', done: hasRecommendations, to: '/recommendations' },
  ];
  const completed = steps.filter((step) => step.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  const next = !riasec
    ? { title: 'Discover what genuinely interests you', body: 'Take the RIASEC assessment to build your interest profile. It takes about eight minutes.', to: '/find-your-path/assessment', action: 'Start the assessment', icon: 'target' }
    : isSpm && !hasAcademics
      ? { title: 'Connect your academic strengths', body: 'Add your exam results so Nexus can consider both what you enjoy and where you perform well.', to: '/find-your-path/academic', action: 'Add academic results', icon: 'chart' }
      : !hasRecommendations
        ? { title: 'Turn your profile into possibilities', body: 'Your foundation is ready. Generate explainable course and career recommendations next.', to: '/recommendations', action: 'See recommendations', icon: 'sparkles' }
        : { title: 'Explore the opportunities around you', body: 'Review your pathways and browse scholarships that could help fund your next step.', to: '/scholarships', action: 'Browse scholarships', icon: 'scholarship' };

  const loading = loadingRiasec || loadingStrengths || loadingRecommendations;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${name}`}
        description="Here is where your Nexus journey stands — and the clearest next step you can take."
      />

      {justCompleted && <Alert variant="success" className="mb-6">Profile saved. You’re all set.</Alert>}

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2"><Skeleton variant="card" className="h-72" /><Skeleton variant="card" className="h-72" /></div>
      ) : (
        <>
          <section className="grid gap-5 lg:grid-cols-[1.35fr,0.65fr]">
            <article className="relative overflow-hidden rounded-modal bg-pine-700 p-6 text-white shadow-card md:p-8">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[44px] border-pine-500/35" aria-hidden="true" />
              <p className="text-caption font-semibold text-lime">YOUR NEXT STEP</p>
              <span className="mt-7 grid h-12 w-12 place-items-center rounded-2xl bg-lime text-pine-900"><Icon name={next.icon} /></span>
              <h2 className="mt-5 max-w-xl text-h1 font-serif text-white md:text-display">{next.title}</h2>
              <p className="mt-4 max-w-xl text-body text-pine-100">{next.body}</p>
              <Link to={next.to} className="mt-7 inline-flex h-12 items-center gap-2 rounded-pill bg-white px-6 font-semibold text-pine-700 transition-all hover:-translate-y-0.5 hover:shadow-lift">
                {next.action} <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </article>

            <article className="rounded-modal border border-pine-100 bg-surface p-6 md:p-8">
              <div className="flex items-end justify-between gap-4">
                <div><p className="text-caption font-semibold text-pine-700">YOUR JOURNEY</p><h2 className="mt-2 text-h2 font-serif">{progress}% complete</h2></div>
                <span className="text-caption text-ink-500">{completed} of {steps.length}</span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-pill bg-pine-100" role="progressbar" aria-label="Nexus journey progress" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><div className="h-full rounded-pill bg-pine-700 transition-all duration-200" style={{ width: `${progress}%` }} /></div>
              <ol className="mt-6 space-y-4">
                {steps.map((step, index) => (
                  <li key={step.label} className="flex items-center gap-3">
                    <span className={`grid h-8 w-8 place-items-center rounded-full text-caption font-semibold ${step.done ? 'bg-pine-700 text-white' : 'bg-pine-50 text-pine-700'}`}>{step.done ? <Icon name="check" className="h-4 w-4" /> : index + 1}</span>
                    <Link to={step.to} className={`text-body-sm font-medium hover:text-pine-700 ${step.done ? 'text-ink-500' : 'text-ink-900'}`}>{step.label}</Link>
                  </li>
                ))}
              </ol>
            </article>
          </section>

          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between"><div><p className="text-caption font-semibold text-pine-700">AT A GLANCE</p><h2 className="mt-1 text-h2 font-serif">Your profile signals</h2></div><Link to="/find-your-path" className="hidden items-center gap-1 text-body-sm font-semibold text-pine-700 hover:underline sm:inline-flex">View your path <Icon name="arrowRight" className="h-4 w-4" /></Link></div>
            <div className="grid gap-4 md:grid-cols-3">
              <SignalCard icon="target" color="bg-lime" label="Interest profile" value={riasec?.holland_code || 'Not discovered yet'} note={riasec ? 'Your Holland Code' : 'Take the RIASEC assessment'} to={riasec ? '/find-your-path/results' : '/find-your-path/assessment'} />
              <SignalCard icon="chart" color="bg-sky" label="Academic strengths" value={hasAcademics ? `${strengths.length} classified` : isSpm ? 'Not analysed yet' : 'Not required'} note={hasAcademics ? strengths.slice(0, 2).map((s) => s.name).join(' · ') : isSpm ? 'Add your exam results' : 'Recommendations use interests and goals'} to="/find-your-path/academic" />
              <SignalCard icon="sparkles" color="bg-lilac" label="Recommendations" value={hasRecommendations ? `${careers.length + courses.length} pathways` : 'Ready when you are'} note={hasRecommendations ? `${careers.length} careers · ${courses.length} courses` : 'Generate from your profile'} to="/recommendations" />
            </div>
          </section>
        </>
      )}
    </>
  );
}

function SignalCard({ icon, color, label, value, note, to }) {
  return (
    <Link to={to} className="group rounded-card border border-ink-100 bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-pine-300 hover:shadow-card">
      <div className="flex items-start justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl text-pine-900 ${color}`}><Icon name={icon} className="h-5 w-5" /></span><Icon name="arrowUpRight" className="h-4 w-4 text-ink-300 transition-colors group-hover:text-pine-700" /></div>
      <p className="mt-5 text-caption font-semibold text-ink-500">{label}</p>
      <p className="mt-1 text-h3 font-semibold text-ink-900">{value}</p>
      <p className="mt-2 text-body-sm text-ink-500">{note}</p>
    </Link>
  );
}

export default Dashboard;
