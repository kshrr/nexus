import { useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Input, Select } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/feedback';
import { useAdminCriteria, useAdminScholarships } from '@/hooks/useAdminScholarships';
import { EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS } from '@/types';
import { formatDate } from '@/lib/format';

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'flagged', label: 'Flagged for review' },
  { value: 'expired', label: 'Expired' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_VARIANT = {
  active: 'success',
  flagged: 'warning',
  expired: 'neutral',
  archived: 'neutral',
};

const CRITERION_TYPES = [
  'citizenship',
  'education_level',
  'field_of_study',
  'min_grade',
  'subject_grade',
  'age',
  'other',
];
const OPERATORS = ['eq', 'in', 'gte', 'lte', 'contains'];

const VALUE_HINT = {
  education_level: 'e.g. "spm" or ["spm","stpm"]',
  field_of_study: 'e.g. ["Computer Science","Engineering"]',
  min_grade: 'e.g. "B" (a letter grade) or 5 (points)',
  subject_grade: 'e.g. {"subject":"MATH","grade":"B"}',
  citizenship: 'Nexus cannot verify this — turn Checkable off',
  age: 'Nexus cannot verify this — turn Checkable off',
  other: 'Free text; usually not checkable',
};

const emptyForm = {
  name: '',
  provider: '',
  description: '',
  funding_amount: '',
  field_of_study: '',
  education_levels: [],
  deadline: '',
  application_link: '',
  status: 'active',
  source_url: '',
};

/**
 * Scholarship management (FR14 / FR-ADMIN-02, ui-spec §10.2).
 *
 * This is the administrator-managed half of the data model. Crawler-provided
 * records arrive with a source_url and no is_manual flag; the moment an admin
 * edits one, PostgreSQL sets is_manual so the weekly run leaves it alone.
 *
 * Authorisation lives in RLS (`is_admin()`), not in this component.
 */
export function AdminScholarships() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const { items, loading, error, reload, create, update, archive } = useAdminScholarships({
    search,
    status,
  });

  const [editing, setEditing] = useState(null); // scholarship row | 'new' | null
  const [criteriaFor, setCriteriaFor] = useState(null);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 font-serif">Scholarships</h1>
          <p className="mt-1 text-body-sm text-ink-700">
            Records entered here are protected from the weekly crawler automatically.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>New scholarship</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input
          label="Search"
          className="min-w-56 flex-1"
          placeholder="Name or provider"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="search"
        />
        <Select
          label="Status"
          options={STATUS_FILTERS}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </div>

      {loading ? (
        <LoadingState rows={2} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No scholarship records"
          description="Add records manually from a provider's official page, or wait for the weekly crawler. Nothing is seeded automatically — the data has to be real."
          action={<Button onClick={() => setEditing('new')}>Add the first one</Button>}
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-ink-300 text-left text-caption text-ink-500">
                <th className="p-3">Name</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Deadline</th>
                <th className="p-3">Status</th>
                <th className="p-3">Source</th>
                <th className="p-3">Updated</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-ink-100 align-top">
                  <td className="p-3 font-medium text-ink-900">{s.name}</td>
                  <td className="p-3 text-ink-700">{s.provider}</td>
                  <td className="p-3 tabular-nums text-ink-700">
                    {s.deadline ? formatDate(s.deadline) : 'Rolling'}
                  </td>
                  <td className="p-3">
                    <Badge variant={STATUS_VARIANT[s.status] ?? 'neutral'}>{s.status}</Badge>
                  </td>
                  <td className="p-3 text-ink-700">
                    {s.is_manual ? 'Manual' : s.source_url ? 'Crawler' : '—'}
                  </td>
                  <td className="p-3 tabular-nums text-ink-500">{formatDate(s.updated_at)}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="text-pine-700 hover:underline"
                        onClick={() => setEditing(s)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-pine-700 hover:underline"
                        onClick={() => setCriteriaFor(s)}
                      >
                        Criteria
                      </button>
                      {s.status !== 'archived' && (
                        <button
                          type="button"
                          className="text-rust-600 hover:underline"
                          onClick={() => archive(s.id)}
                        >
                          Archive
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
        <ScholarshipForm
          scholarship={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            const res =
              editing === 'new' ? await create(payload) : await update(editing.id, payload);
            if (!res.error) setEditing(null);
            return res;
          }}
        />
      )}

      {criteriaFor && (
        <CriteriaEditor scholarship={criteriaFor} onClose={() => setCriteriaFor(null)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
function Panel({ title, subtitle, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink-900/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-paper p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h2 font-serif">{title}</h2>
            {subtitle && <p className="mt-1 text-body-sm text-ink-700">{subtitle}</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function ScholarshipForm({ scholarship, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    scholarship
      ? {
          name: scholarship.name ?? '',
          provider: scholarship.provider ?? '',
          description: scholarship.description ?? '',
          funding_amount: scholarship.funding_amount ?? '',
          field_of_study: (scholarship.field_of_study ?? []).join(', '),
          education_levels: scholarship.education_levels ?? [],
          deadline: scholarship.deadline ?? '',
          application_link: scholarship.application_link ?? '',
          status: scholarship.status ?? 'active',
          source_url: scholarship.source_url ?? '',
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.provider.trim()) {
      setError({ message: 'Name and provider are both required.' });
      return;
    }
    if (form.application_link && !form.application_link.startsWith('https://')) {
      setError({ message: 'The application link must start with https://' });
      return;
    }
    setError(null);
    setSaving(true);
    const res = await onSave({
      name: form.name.trim(),
      provider: form.provider.trim(),
      description: form.description.trim() || null,
      funding_amount: form.funding_amount.trim() || null,
      field_of_study: form.field_of_study
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      education_levels: form.education_levels,
      deadline: form.deadline || null,
      application_link: form.application_link.trim() || null,
      status: form.status,
      source_url: form.source_url.trim() || null,
    });
    setSaving(false);
    if (res?.error) setError(res.error);
  }

  return (
    <Panel
      title={scholarship ? 'Edit scholarship' : 'New scholarship'}
      subtitle="Enter details exactly as the provider states them. Don't guess a deadline or an amount."
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert variant="error">{error.message}</Alert>}

        <Input label="Name" value={form.name} onChange={set('name')} required />
        <Input label="Provider" value={form.provider} onChange={set('provider')} required />

        <div>
          <label htmlFor="sch-desc" className="mb-1.5 block text-caption font-medium text-ink-700">
            Description
          </label>
          <textarea
            id="sch-desc"
            rows={4}
            value={form.description}
            onChange={set('description')}
            className="w-full rounded-input border border-ink-300 bg-surface p-3 text-body text-ink-900 focus:border-pine-700 focus:outline-none focus:ring-[3px] focus:ring-pine-100"
          />
        </div>

        <Input
          label="Funding amount"
          hint="Free text — providers describe this inconsistently."
          value={form.funding_amount}
          onChange={set('funding_amount')}
        />
        <Input
          label="Fields of study"
          hint="Comma separated. These must match course field names for relevance ranking."
          value={form.field_of_study}
          onChange={set('field_of_study')}
        />

        <fieldset>
          <legend className="mb-2 text-caption font-medium text-ink-700">Education levels</legend>
          <div className="flex flex-wrap gap-3">
            {EDUCATION_LEVELS.map((level) => (
              <label key={level} className="flex items-center gap-2 text-body-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-pine-700"
                  checked={form.education_levels.includes(level)}
                  onChange={() =>
                    setForm((f) => ({
                      ...f,
                      education_levels: f.education_levels.includes(level)
                        ? f.education_levels.filter((l) => l !== level)
                        : [...f.education_levels, level],
                    }))
                  }
                />
                {EDUCATION_LEVEL_LABELS[level]}
              </label>
            ))}
          </div>
        </fieldset>

        <Input
          label="Deadline"
          type="date"
          hint="Leave blank for a rolling intake."
          value={form.deadline}
          onChange={set('deadline')}
        />
        <Input
          label="Application link"
          hint="Must start with https://"
          value={form.application_link}
          onChange={set('application_link')}
        />
        <Input
          label="Source URL"
          hint="Where this information came from."
          value={form.source_url}
          onChange={set('source_url')}
        />
        <Select
          label="Status"
          options={['active', 'flagged', 'expired', 'archived']}
          value={form.status}
          onChange={set('status')}
        />

        <Alert variant="info" title="Protected from crawler updates">
          Saving marks this record as manually managed, so the weekly crawler will not overwrite it.
          Without that, every correction would be reverted at the next run.
        </Alert>

        <div className="flex gap-2">
          <Button type="submit" loading={saving}>
            Save scholarship
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
function CriteriaEditor({ scholarship, onClose }) {
  const { criteria, loading, add, update, remove } = useAdminCriteria(scholarship.id);
  const [draft, setDraft] = useState({
    criterion_type: 'education_level',
    operator: 'eq',
    value: '',
    label: '',
    is_checkable: true,
  });
  const [error, setError] = useState(null);

  function parseValue(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed; // stored as a JSON string
    }
  }

  async function addCriterion(e) {
    e.preventDefault();
    if (!draft.label.trim()) {
      setError({ message: 'Every criterion needs a label — it becomes the checklist line.' });
      return;
    }
    setError(null);
    const res = await add({
      criterion_type: draft.criterion_type,
      operator: draft.operator,
      value: parseValue(draft.value),
      label: draft.label.trim(),
      is_checkable: draft.is_checkable,
    });
    if (res.error) setError(res.error);
    else setDraft({ ...draft, value: '', label: '' });
  }

  return (
    <Panel title="Eligibility criteria" subtitle={scholarship.name} onClose={onClose}>
      <Alert
        variant="info"
        title="Turn Checkable off for anything Nexus can't verify"
        className="mb-4"
      >
        Interviews, essays, leadership experience — anything not in a student&rsquo;s profile.
        Unverifiable criteria show as a grey dash, never a red cross, so a student is never told
        they fail something we simply cannot see.
      </Alert>

      {error && (
        <Alert variant="error" className="mb-4">
          {error.message}
        </Alert>
      )}

      {loading ? (
        <LoadingState rows={1} />
      ) : criteria.length === 0 ? (
        <p className="mb-4 text-body-sm text-ink-500">
          No criteria yet. Without them the eligibility checklist has nothing to show.
        </p>
      ) : (
        <ul className="mb-6 flex flex-col gap-2">
          {criteria.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-card border border-ink-300 bg-surface p-3"
            >
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-ink-900">{c.label}</p>
                <p className="mt-0.5 text-caption text-ink-500">
                  {c.criterion_type} · {c.operator} · {JSON.stringify(c.value)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <label className="flex items-center gap-1.5 text-caption text-ink-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-pine-700"
                    checked={c.is_checkable}
                    onChange={() => update(c.id, { is_checkable: !c.is_checkable })}
                  />
                  Checkable
                </label>
                <button
                  type="button"
                  className="text-caption text-rust-600 hover:underline"
                  onClick={() => remove(c.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addCriterion} className="flex flex-col gap-3 border-t border-ink-300 pt-4">
        <h3 className="text-h4 font-sans">Add a criterion</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Type"
            options={CRITERION_TYPES}
            value={draft.criterion_type}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                criterion_type: e.target.value,
                is_checkable: !['citizenship', 'age', 'other'].includes(e.target.value),
              }))
            }
          />
          <Select
            label="Operator"
            options={OPERATORS}
            value={draft.operator}
            onChange={(e) => setDraft((d) => ({ ...d, operator: e.target.value }))}
          />
        </div>
        <Input
          label="Value"
          hint={VALUE_HINT[draft.criterion_type]}
          value={draft.value}
          onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
        />
        <Input
          label="Label"
          hint="The exact line a student will read on the checklist."
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          required
        />
        <label className="flex items-center gap-2 text-body-sm text-ink-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-pine-700"
            checked={draft.is_checkable}
            onChange={(e) => setDraft((d) => ({ ...d, is_checkable: e.target.checked }))}
          />
          Nexus can check this from a student&rsquo;s profile
        </label>
        <Button type="submit" className="w-fit">
          Add criterion
        </Button>
      </form>
    </Panel>
  );
}

export default AdminScholarships;
