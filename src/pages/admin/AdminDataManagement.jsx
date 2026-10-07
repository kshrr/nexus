import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Input, Select, Tabs } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/feedback';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Panel } from '@/components/admin/Panel';
import { useAdminCatalog } from '@/hooks/useAdminCatalog';
import { useAdminCareerCourses } from '@/hooks/useAdminCareerCourses';

const TABS = [
  { id: 'courses', label: 'Courses' },
  { id: 'universities', label: 'Universities' },
  { id: 'careers', label: 'Careers' },
];

const UNIVERSITY_TYPES = ['public', 'private', 'polytechnic', 'college'];
const PATHWAY_TYPES = ['foundation', 'diploma', 'matriculation', 'stpm', 'degree'];

const SINGULAR = { courses: 'course', universities: 'university', careers: 'career' };

/** Comma-separated text <-> a text[] column. */
const toArray = (text) =>
  String(text ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const fromArray = (arr) => (arr ?? []).join(', ');

/**
 * Data management (FR-ADMIN-03, architecture.md §13.1).
 *
 * CRUD over the reference catalog the recommendation engine resolves its rule
 * outputs against: courses, universities and careers. Getting these wrong is
 * what makes a matching rule produce no card, so this screen is what keeps the
 * engine's output non-empty.
 *
 * Two things are deliberately absent:
 *   * the recommendation rule base and the RIASEC question bank — §3.3.2C keeps
 *     them in server-side config precisely so they cannot be inspected or
 *     manipulated, and requirements.md §18 lists an editor for them SHOULD NOT
 *   * any student record — §13.1 grants administrators none, and RLS enforces
 *     that regardless of what this code asks for
 */
export function AdminDataManagement() {
  const [tab, setTab] = useState('courses');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // row | 'new' | null

  const catalog = useAdminCatalog(tab, { search });
  const universities = useAdminCatalog('universities');
  const courses = useAdminCatalog('courses');

  const switchTab = (next) => {
    setTab(next);
    setSearch('');
    setEditing(null);
  };

  return (
    <>
      <AdminPageHeader
        title="Data management"
        description="The courses, universities and careers the recommendation engine resolves against."
        actions={<Button onClick={() => setEditing('new')}>Add {SINGULAR[tab]}</Button>}
      />

      <Tabs tabs={TABS} active={tab} onChange={switchTab} className="mb-4" />

      <Input
        label="Search by name"
        className="mb-4 max-w-sm"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {catalog.loading ? (
        <LoadingState rows={2} />
      ) : catalog.error ? (
        <ErrorState message={catalog.error.message} onRetry={catalog.reload} />
      ) : catalog.items.length === 0 ? (
        <EmptyState
          title={`No ${tab} yet`}
          description="Recommendations resolve rule outputs against these records. Without them, a rule can match a student perfectly and still show nothing."
          action={<Button onClick={() => setEditing('new')}>Add {SINGULAR[tab]}</Button>}
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-ink-300 text-left text-caption text-ink-500">
                <th className="p-3">Name</th>
                <th className="p-3">{tab === 'universities' ? 'Type' : 'Field'}</th>
                <th className="p-3">
                  {tab === 'courses' ? 'University' : tab === 'careers' ? 'RIASEC' : 'State'}
                </th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {catalog.items.map((row) => (
                <tr key={row.id} className="border-b border-ink-100">
                  <td className="p-3 font-medium text-ink-900">{row.name}</td>
                  <td className="p-3 text-ink-700">
                    {tab === 'universities' ? (row.type ?? '—') : (row.field_of_study ?? row.field)}
                  </td>
                  <td className="p-3 text-ink-700">
                    {tab === 'courses'
                      ? (row.universities?.name ?? '—')
                      : tab === 'careers'
                        ? row.riasec_profile
                        : (row.state ?? '—')}
                  </td>
                  <td className="p-3">
                    <Badge variant={row.is_active ? 'success' : 'neutral'}>
                      {row.is_active ? 'active' : 'inactive'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        className="text-pine-700 hover:underline"
                        onClick={() => setEditing(row)}
                      >
                        Edit
                      </button>
                      {row.is_active ? (
                        <button
                          type="button"
                          className="text-rust-600 hover:underline"
                          onClick={() => catalog.deactivate(row.id)}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-pine-700 hover:underline"
                          onClick={() => catalog.reactivate(row.id)}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editing && (
        <CatalogForm
          table={tab}
          row={editing === 'new' ? null : editing}
          universities={universities.items}
          courses={courses.items}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            const res =
              editing === 'new'
                ? await catalog.create(payload)
                : await catalog.update(editing.id, payload);
            if (!res.error) setEditing(null);
            return res;
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
function CatalogForm({ table, row, universities, courses, onClose, onSave }) {
  const [form, setForm] = useState(() => initialForm(table, row));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const mappings = useAdminCareerCourses(table === 'careers' ? row?.id : null);
  const [courseIds, setCourseIds] = useState(() => mappings.selectedIds);

  useEffect(() => {
    if (!mappings.loading) setCourseIds(mappings.selectedIds);
  }, [mappings.loading, mappings.selectedIds]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const problem = validate(table, form);
    if (problem) return setError({ message: problem });
    setError(null);
    setSaving(true);
    const res = await onSave(toPayload(table, form));
    if (!res?.error && table === 'careers' && row?.id) {
      const [mappingResult, pathwayResult] = await Promise.all([
        mappings.replace(courseIds),
        mappings.updateRoutes(toArray(form.education_routes)),
      ]);
      if (mappingResult.error || pathwayResult.error) {
        setSaving(false);
        setError(mappingResult.error ?? pathwayResult.error);
        return undefined;
      }
    }
    setSaving(false);
    if (res?.error) setError(res.error);
    return undefined;
  }

  return (
    <Panel
      title={`${row ? 'Edit' : 'New'} ${SINGULAR[table]}`}
      subtitle="Record what the institution actually publishes — a guessed duration or entry requirement is worse than a missing one."
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert variant="error">{error.message}</Alert>}

        <Input label="Name" value={form.name} onChange={set('name')} required />

        {table === 'universities' && (
          <>
            <Select
              label="Type"
              placeholder="Choose one…"
              options={UNIVERSITY_TYPES}
              value={form.type}
              onChange={set('type')}
            />
            <Input label="State" value={form.state} onChange={set('state')} />
          </>
        )}

        {table === 'courses' && (
          <>
            <Input
              label="Field of study"
              hint="Must match the course field a rule emits, or the rule produces no card."
              value={form.field_of_study}
              onChange={set('field_of_study')}
              required
            />
            <Select
              label="University"
              placeholder="Choose one…"
              options={universities.map((u) => ({ value: u.id, label: u.name }))}
              value={form.university_id}
              onChange={set('university_id')}
            />
            <Select
              label="Pathway type"
              placeholder="Choose one…"
              options={PATHWAY_TYPES}
              value={form.pathway_type}
              onChange={set('pathway_type')}
            />
            <Input
              label="Duration (months)"
              type="number"
              min="1"
              value={form.duration_months}
              onChange={set('duration_months')}
            />
            <div>
              <label
                htmlFor="entry-req"
                className="mb-1.5 block text-caption font-medium text-ink-700"
              >
                Entry requirements <span className="font-normal text-ink-500">· Required</span>
              </label>
              <textarea
                id="entry-req"
                rows={3}
                value={form.entry_requirements}
                onChange={set('entry_requirements')}
                className="w-full rounded-input border border-ink-300 bg-surface p-3 text-body text-ink-900 focus:border-pine-700 focus:outline-none focus:ring-[3px] focus:ring-pine-100"
              />
            </div>
            <Input
              label="Required subject codes"
              hint="Comma separated, e.g. BIOLOGY, CHEMISTRY, MATH"
              value={form.required_subject_codes}
              onChange={set('required_subject_codes')}
            />
          </>
        )}

        {table === 'careers' && (
          <>
            <Input label="Field" value={form.field} onChange={set('field')} required />
            <Input
              label="URL slug"
              hint="Lowercase words separated by hyphens. Generated from the name if left blank."
              value={form.slug}
              onChange={set('slug')}
            />
            <div>
              <label
                htmlFor="career-desc"
                className="mb-1.5 block text-caption font-medium text-ink-700"
              >
                Description <span className="font-normal text-ink-500">· Required</span>
              </label>
              <textarea
                id="career-desc"
                rows={3}
                value={form.description}
                onChange={set('description')}
                className="w-full rounded-input border border-ink-300 bg-surface p-3 text-body text-ink-900 focus:border-pine-700 focus:outline-none focus:ring-[3px] focus:ring-pine-100"
              />
            </div>
            <Input
              label="Required skills"
              hint="Comma separated."
              value={form.required_skills}
              onChange={set('required_skills')}
            />
            <Input
              label="Typical responsibilities"
              hint="Comma separated. Keep each item concise and student-friendly."
              value={form.responsibilities}
              onChange={set('responsibilities')}
            />
            <Input
              label="Useful subject codes"
              hint="Comma separated, e.g. MATH, ADD_MATH, ICT."
              value={form.useful_subjects}
              onChange={set('useful_subjects')}
            />
            <Input
              label="Common education routes"
              hint="Comma separated. Include alternatives rather than implying one required route."
              value={form.education_routes}
              onChange={set('education_routes')}
            />
            <Input
              label="RIASEC profile"
              hint="Exactly three letters from RIASEC, e.g. ICR. Drives the secondary signal in §9.6."
              maxLength={3}
              value={form.riasec_profile}
              onChange={(e) =>
                setForm((f) => ({ ...f, riasec_profile: e.target.value.toUpperCase() }))
              }
              required
            />
            {row && (
              <fieldset className="rounded-card border border-ink-300 p-4">
                <legend className="px-1 text-caption font-medium text-ink-700">Related courses</legend>
                <p className="mb-3 text-body-sm text-ink-500">Map existing course records to this pathway. Changes are saved with the career.</p>
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {courses.map((course) => (
                    <label key={course.id} className="flex min-h-11 items-start gap-3 rounded-input px-2 py-2 hover:bg-pine-50">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-pine-700"
                        checked={courseIds.includes(course.id)}
                        onChange={(event) => setCourseIds((ids) => event.target.checked ? [...ids, course.id] : ids.filter((id) => id !== course.id))}
                      />
                      <span className="text-body-sm"><span className="font-medium text-ink-900">{course.name}</span><span className="block text-ink-500">{course.field_of_study}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </>
        )}

        <div className="flex gap-2">
          <Button type="submit" loading={saving}>
            Save {SINGULAR[table]}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function initialForm(table, row) {
  const base = { name: row?.name ?? '' };
  if (table === 'universities') {
    return { ...base, type: row?.type ?? '', state: row?.state ?? '' };
  }
  if (table === 'courses') {
    return {
      ...base,
      field_of_study: row?.field_of_study ?? '',
      university_id: row?.university_id ?? '',
      pathway_type: row?.pathway_type ?? '',
      duration_months: row?.duration_months ?? '',
      entry_requirements: row?.entry_requirements ?? '',
      required_subject_codes: fromArray(row?.required_subject_codes),
    };
  }
  return {
    ...base,
    slug: row?.slug ?? '',
    field: row?.field ?? '',
    description: row?.description ?? '',
    responsibilities: fromArray(row?.responsibilities),
    required_skills: fromArray(row?.required_skills),
    useful_subjects: fromArray(row?.useful_subjects),
    education_routes: fromArray(row?.education_routes),
    riasec_profile: row?.riasec_profile ?? '',
  };
}

/** Mirrors the CHECK constraints in migration 0003 so errors arrive inline. */
function validate(table, form) {
  if (!form.name.trim()) return 'A name is required.';
  if (table === 'courses') {
    if (!form.field_of_study.trim()) return 'A field of study is required.';
    if (!form.entry_requirements.trim()) return 'Entry requirements are required.';
  }
  if (table === 'careers') {
    if (!form.field.trim()) return 'A field is required.';
    if (!form.description.trim()) return 'A description is required.';
    if (!/^[RIASEC]{3}$/.test(form.riasec_profile)) {
      return 'The RIASEC profile must be exactly three letters from R, I, A, S, E and C.';
    }
  }
  return null;
}

function toPayload(table, form) {
  if (table === 'universities') {
    return {
      name: form.name.trim(),
      type: form.type || null,
      state: form.state.trim() || null,
    };
  }
  if (table === 'courses') {
    return {
      name: form.name.trim(),
      field_of_study: form.field_of_study.trim(),
      university_id: form.university_id || null,
      pathway_type: form.pathway_type || null,
      duration_months: form.duration_months ? Number(form.duration_months) : null,
      entry_requirements: form.entry_requirements.trim(),
      required_subject_codes: toArray(form.required_subject_codes),
    };
  }
  return {
    name: form.name.trim(),
    slug: form.slug.trim() || form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    field: form.field.trim(),
    description: form.description.trim(),
    responsibilities: toArray(form.responsibilities),
    required_skills: toArray(form.required_skills),
    useful_subjects: toArray(form.useful_subjects),
    education_routes: toArray(form.education_routes),
    riasec_profile: form.riasec_profile,
  };
}

export default AdminDataManagement;
