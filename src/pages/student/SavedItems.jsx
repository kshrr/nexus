import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout';
import { Button, Card, EmptyState, Select, Tabs } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/feedback';
import { DeadlineBadge } from '@/components/scholarship/DeadlineBadge';
import { APPLICATION_STATUSES, useSavedItems } from '@/hooks/useSavedItems';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { daysUntil } from '@/lib/format';

const TABS = [
  { id: 'scholarship', label: 'Scholarships' },
  { id: 'course', label: 'Courses' },
  { id: 'career', label: 'Careers' },
];

/**
 * Saved items and application tracking (FR-DASH-02 / FR-DASH-03, ui-spec §3.14).
 *
 * `saved_items.item_id` is polymorphic and carries no foreign key (§3.4), so the
 * referenced records are resolved in a second query per type.
 * Scholarships sort by deadline ascending — the most urgent first.
 */
export function SavedItems() {
  const [tab, setTab] = useState('scholarship');
  const saved = useSavedItems();
  const [details, setDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(true);

  const ids = useMemo(() => {
    const out = { scholarship: [], course: [], career: [] };
    for (const item of saved.items) out[item.item_type]?.push(item.item_id);
    return out;
  }, [saved.items]);

  useEffect(() => {
    let alive = true;
    if (!config.isConfigured || saved.loading) return () => {};
    (async () => {
      setLoadingDetails(true);
      const map = {};
      const [sch, crs, car] = await Promise.all([
        ids.scholarship.length
          ? supabase
              .from('scholarships')
              .select('id, name, provider, deadline, status')
              .in('id', ids.scholarship)
          : Promise.resolve({ data: [] }),
        ids.course.length
          ? supabase
              .from('courses')
              .select('id, name, field_of_study, universities(name)')
              .in('id', ids.course)
          : Promise.resolve({ data: [] }),
        ids.career.length
          ? supabase.from('careers').select('id, name, field').in('id', ids.career)
          : Promise.resolve({ data: [] }),
      ]);
      for (const row of sch.data ?? []) map[row.id] = { type: 'scholarship', ...row };
      for (const row of crs.data ?? [])
        map[row.id] = { type: 'course', ...row, university: row.universities?.name };
      for (const row of car.data ?? []) map[row.id] = { type: 'career', ...row };
      if (!alive) return;
      setDetails(map);
      setLoadingDetails(false);
    })();
    return () => {
      alive = false;
    };
  }, [ids, saved.loading]);

  const rows = useMemo(() => {
    const list = saved.items.filter((i) => i.item_type === tab);
    if (tab !== 'scholarship') return list;
    return [...list].sort((a, b) => {
      const da = daysUntil(details[a.item_id]?.deadline);
      const db = daysUntil(details[b.item_id]?.deadline);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  }, [saved.items, tab, details]);

  if (saved.loading || loadingDetails) {
    return (
      <>
        <PageHeader title="Saved" />
        <LoadingState rows={2} />
      </>
    );
  }

  if (saved.error) {
    return (
      <>
        <PageHeader title="Saved" />
        <ErrorState message={saved.error.message} onRetry={saved.reload} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Saved"
        description="Everything you've bookmarked, and where each application stands."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-6" />

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Save scholarships, courses and careers to track them here."
          action={
            <Link
              to="/scholarships"
              className="inline-flex h-10 items-center rounded-input bg-pine-700 px-4 text-body-sm font-medium text-white hover:bg-pine-500"
            >
              Browse scholarships
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((item) => {
            const detail = details[item.item_id];
            return (
              <Card key={item.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-h3 font-sans">
                      {item.item_type === 'scholarship' && detail ? (
                        <Link
                          to={`/scholarships/${item.item_id}`}
                          className="text-ink-900 hover:underline"
                        >
                          {detail.name}
                        </Link>
                      ) : (
                        (detail?.name ?? 'This record is no longer available')
                      )}
                    </h3>
                    <p className="mt-0.5 text-body-sm text-ink-500">
                      {detail?.provider ??
                        detail?.university ??
                        detail?.field ??
                        detail?.field_of_study ??
                        ''}
                    </p>
                    {item.item_type === 'scholarship' && detail && (
                      <div className="mt-2">
                        <DeadlineBadge
                          deadline={detail.deadline}
                          expired={detail.status === 'expired'}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-end gap-2">
                    {item.item_type === 'scholarship' && (
                      <Select
                        label="Application status"
                        options={APPLICATION_STATUSES}
                        value={item.application_status ?? 'saved'}
                        onChange={(e) => saved.setStatus(item.id, e.target.value)}
                      />
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => saved.remove(item.item_type, item.item_id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

export default SavedItems;
