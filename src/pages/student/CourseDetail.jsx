import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Card, Skeleton } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { supabase } from '@/lib/supabase';
import { normaliseError } from '@/lib/api';

export function CourseDetail() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: queryError } = await supabase.from('courses').select('*, universities(name, state, type)').eq('id', id).eq('is_active', true).maybeSingle();
      if (queryError) throw queryError;
      setCourse(data ?? null);
    } catch (err) { setError(normaliseError(err)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Skeleton variant="card" />;
  if (error) return <ErrorState title="We couldn’t load this course" message={error.message} onRetry={load} />;
  if (!course) return <div className="text-center"><h1 className="text-h1 font-serif">Course not found</h1><Link to="/careers" className="mt-4 inline-block text-pine-700 underline">Back to careers</Link></div>;
  return (
    <>
      <Link to="/careers" className="inline-flex min-h-11 items-center text-body-sm text-pine-700 hover:underline">‹ Career pathways</Link>
      <header className="rounded-modal bg-pine-900 p-6 text-white md:p-10">
        <Badge className="bg-lime text-pine-900">{course.field_of_study}</Badge>
        <h1 className="mt-4 text-display font-serif text-white">{course.name}</h1>
        <p className="mt-3 text-body text-pine-100">{course.universities?.name ?? 'Institution varies'}</p>
      </header>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Card variant="titled" title="Course overview">
          <dl className="space-y-3 text-body-sm"><div><dt className="text-ink-500">Pathway type</dt><dd className="mt-1 capitalize text-ink-900">{course.pathway_type ?? 'Not recorded'}</dd></div><div><dt className="text-ink-500">Duration</dt><dd className="mt-1 text-ink-900">{course.duration_months ? `${course.duration_months} months` : 'Confirm with institution'}</dd></div><div><dt className="text-ink-500">Institution</dt><dd className="mt-1 text-ink-900">{course.universities?.name ?? 'Not linked'}</dd></div></dl>
        </Card>
        <Card variant="titled" title="Entry guidance"><p className="text-body-sm text-ink-700">{course.entry_requirements}</p><p className="mt-4 text-caption text-ink-500">Requirements may change. Confirm the latest entry criteria with the institution before applying.</p></Card>
      </div>
    </>
  );
}

export default CourseDetail;

