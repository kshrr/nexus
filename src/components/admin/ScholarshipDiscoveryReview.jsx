import { useState } from 'react';
import { Input, Select, Button } from '@/components/ui';
import { DiscoveryDialog, OfficialSourceLink } from './DiscoveryDialog';

const LEVELS = ['spm', 'stpm', 'stam', 'matriculation', 'foundation', 'diploma'];
export function ScholarshipDiscoveryReview({
  candidate,
  onSave,
  onPublish,
  onApprove,
  onReload,
  onAlias,
  onClose,
  busy = false,
  duplicateOptions = [],
}) {
  const [current, setCurrent] = useState(candidate);
  const [record, setRecord] = useState(() => ({
    ...candidate.extracted_record,
    ...candidate.review_overrides,
  }));
  const [fieldsText, setFieldsText] = useState((record.field_of_study ?? []).join(', '));
  const [criteria, setCriteria] = useState(() =>
    candidate.criteria_overridden
      ? (candidate.draft_criteria ?? [])
      : (candidate.extracted_criteria ?? [])
  );
  const [confirmed, setConfirmed] = useState(Boolean(candidate.official_source_confirmed));
  const [applicationConfirmed, setApplicationConfirmed] = useState(
    !record.application_link ||
      record.application_link ===
        (candidate.draft_application_url ?? candidate.approved_application_url)
  );
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [alias, setAlias] = useState('');
  const [conflict, setConflict] = useState(false);
  const change = (key, value) => {
    setRecord((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
    if (key === 'source_url') setConfirmed(false);
    if (key === 'application_link') setApplicationConfirmed(false);
  };
  async function save(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    const result = await onSave(current, {
      record: {
        ...record,
        deadline: record.deadline || null,
        application_link: record.application_link || null,
        funding_amount: record.funding_amount || null,
      },
      criteria,
      officialSourceConfirmed: confirmed,
      approvedApplicationUrl: applicationConfirmed ? record.application_link || null : null,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      setConflict(result.error.code === 'STALE_REVIEW');
    } else {
      setCurrent({ ...result.data, is_manual: current.is_manual });
      setDirty(false);
      setMessage('Review saved.');
    }
  }
  async function add() {
    setError('');
    const result = await onPublish(current);
    if (result.error) setError(result.error.message);
    else onClose();
  }
  async function approve() {
    setError('');
    const result = await onApprove(current);
    if (result.error) {
      setError(result.error.message);
      setConflict(result.error.code === 'STALE_REVIEW');
    } else onClose();
  }
  async function reload() {
    const result = await onReload(current.id);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const next = result.data;
    const fresh = { ...next.extracted_record, ...next.review_overrides };
    setCurrent(next);
    setRecord(fresh);
    setFieldsText((fresh.field_of_study ?? []).join(', '));
    setCriteria(
      next.criteria_overridden ? (next.draft_criteria ?? []) : (next.extracted_criteria ?? [])
    );
    setConfirmed(Boolean(next.official_source_confirmed));
    setApplicationConfirmed(
      !fresh.application_link ||
        fresh.application_link === (next.draft_application_url ?? next.approved_application_url)
    );
    setDirty(false);
    setConflict(false);
    setError('');
    setMessage('Latest details loaded.');
  }
  const fields = current.evidence?.fields ?? {};
  return (
    <DiscoveryDialog title="Review scholarship" onClose={onClose}>
      <div className="mb-6">
        <OfficialSourceLink url={record.source_url || candidate.canonical_url} />
        {current.approved_source_url && current.approved_source_url !== record.source_url && (
          <p className="mt-2 text-body-sm text-ink-500">
            Current published source: <OfficialSourceLink url={current.approved_source_url} />
          </p>
        )}
        {current.last_error && <p className="mt-2 text-rust-600">{current.last_error}</p>}
        {(current.review_reasons ?? []).length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-body-sm text-ink-700">
            {current.review_reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        )}
      </div>
      <form onSubmit={save} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Programme name"
            value={record.name ?? ''}
            onChange={(event) => change('name', event.target.value)}
            maxLength={500}
            required
          />
          <Input
            label="Provider"
            value={record.provider ?? ''}
            onChange={(event) => change('provider', event.target.value)}
            maxLength={500}
            required
          />
        </div>
        <div>
          <label htmlFor="review-description" className="mb-2 block text-caption font-medium">
            Description
          </label>
          <textarea
            id="review-description"
            rows={4}
            value={record.description ?? ''}
            onChange={(event) => change('description', event.target.value)}
            maxLength={12000}
            required
            className="w-full rounded-input border border-ink-300 p-3"
          />
        </div>
        <Input
          label="Official source URL"
          type="url"
          value={record.source_url ?? candidate.canonical_url}
          onChange={(event) => change('source_url', event.target.value)}
          required
        />
        <label className="flex items-start gap-3 text-body-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => {
              setConfirmed(event.target.checked);
              setDirty(true);
            }}
            className="mt-1"
          />
          I confirm this is the provider’s official source.
        </label>
        <fieldset>
          <legend className="mb-2 text-caption font-medium">Eligible education levels</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {LEVELS.map((level) => (
              <label key={level} className="flex items-center gap-2 text-body-sm">
                <input
                  type="checkbox"
                  checked={(record.education_levels ?? []).includes(level)}
                  onChange={(event) =>
                    change(
                      'education_levels',
                      event.target.checked
                        ? [...(record.education_levels ?? []), level]
                        : (record.education_levels ?? []).filter((value) => value !== level)
                    )
                  }
                />
                {level.length <= 4 ? level.toUpperCase() : level[0].toUpperCase() + level.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>
        <Input
          label="Study fields"
          value={fieldsText}
          onChange={(event) => {
            setFieldsText(event.target.value);
            change(
              'field_of_study',
              event.target.value
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
            );
          }}
          hint="Separate fields with commas. Leave blank when unspecified."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Closing date"
            type="date"
            value={record.deadline ?? ''}
            onChange={(event) => change('deadline', event.target.value || null)}
            hint="Leave blank for unknown or rolling deadlines."
          />
          <Select
            label="Application status"
            value={record.status ?? 'unknown'}
            onChange={(event) => change('status', event.target.value)}
            options={[
              { value: 'unknown', label: 'Needs confirmation' },
              { value: 'active', label: 'Open' },
              { value: 'expired', label: 'Closed' },
            ]}
          />
        </div>
        <Input
          label="Funding"
          value={record.funding_amount ?? ''}
          onChange={(event) => change('funding_amount', event.target.value)}
          maxLength={2000}
        />
        <Input
          label="Application URL"
          type="url"
          value={record.application_link ?? ''}
          onChange={(event) => change('application_link', event.target.value || null)}
        />
        {record.application_link && (
          <>
            <OfficialSourceLink url={record.application_link}>
              Open application destination
            </OfficialSourceLink>
            <label className="flex items-start gap-3 text-body-sm">
              <input
                type="checkbox"
                checked={applicationConfirmed}
                onChange={(event) => {
                  setApplicationConfirmed(event.target.checked);
                  setDirty(true);
                }}
                className="mt-1"
              />
              I confirm the provider uses this application destination.
            </label>
          </>
        )}
        <fieldset className="space-y-3">
          <legend className="mb-2 text-caption font-medium">Eligibility conditions</legend>
          <p className="text-body-sm text-ink-500">
            Edited conditions are shown for guidance; Nexus cannot verify them automatically.
          </p>
          {criteria.map((criterion, index) => (
            <div key={index} className="flex items-end gap-2">
              <Input
                className="flex-1"
                label={`Condition ${index + 1}`}
                value={criterion.label ?? ''}
                onChange={(event) => {
                  setCriteria((old) =>
                    old.map((row, i) =>
                      i === index
                        ? {
                            criterion_type: 'other',
                            operator: 'eq',
                            is_checkable: false,
                            label: event.target.value,
                            value: event.target.value,
                          }
                        : row
                    )
                  );
                  setDirty(true);
                }}
              />
              <Button
                variant="tertiary"
                onClick={() => {
                  setCriteria((old) => old.filter((_, i) => i !== index));
                  setDirty(true);
                }}
                aria-label={`Remove condition ${index + 1}`}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCriteria((old) => [
                ...old,
                {
                  criterion_type: 'other',
                  operator: 'eq',
                  value: '',
                  label: '',
                  is_checkable: false,
                },
              ]);
              setDirty(true);
            }}
          >
            Add condition
          </Button>
        </fieldset>
        <details className="border-t border-ink-200 pt-4">
          <summary className="cursor-pointer font-medium">Source evidence</summary>
          <dl className="mt-3 space-y-3 text-body-sm">
            {Object.entries(fields).map(([key, value]) => (
              <div key={key}>
                <dt className="font-medium capitalize">{key.replaceAll('_', ' ')}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink-700">
                  {value.text || 'No evidence captured'}
                </dd>
              </div>
            ))}
          </dl>
          {!Object.keys(fields).length && (
            <p className="mt-2 text-body-sm text-ink-500">
              Review the official source to confirm missing details.
            </p>
          )}
        </details>
        {message && (
          <p role="status" className="text-pine-700">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-rust-600">
            {error}
          </p>
        )}
        {conflict && onReload && (
          <Button variant="secondary" onClick={reload} disabled={busy}>
            Reload latest details
          </Button>
        )}
        {current.scholarship_id && (
          <p className="text-body-sm text-ink-500">
            Save keeps a draft. Approve updates applies it to Nexus.
          </p>
        )}
        {current.is_manual && (
          <p className="text-body-sm text-ink-500">
            Manual corrections are protected. Apply publication edits in Scholarships.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={saving} disabled={busy}>
            Save review
          </Button>
          {!current.scholarship_id && current.review_state === 'ready' && (
            <Button variant="secondary" disabled={dirty || busy || saving} onClick={add}>
              Add to Nexus
            </Button>
          )}
          {current.scholarship_id &&
            current.pending_review &&
            current.review_state === 'ready' &&
            onApprove && (
              <Button
                variant="secondary"
                disabled={dirty || busy || saving || current.is_manual}
                onClick={approve}
              >
                Approve updates
              </Button>
            )}
        </div>
      </form>
      {onAlias && duplicateOptions.length > 0 && (
        <details className="mt-6 border-t border-ink-200 pt-4">
          <summary className="cursor-pointer text-body-sm">Link duplicate programme</summary>
          <p className="my-3 text-body-sm text-ink-500">
            Choose the same programme from this page. Keep separate intakes separate.
          </p>
          <Select
            label="Duplicate programme"
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            options={[
              { value: '', label: 'Choose a programme' },
              ...duplicateOptions.map((item) => ({
                value: item.id,
                label: `${item.name || 'Unresolved programme'} — ${item.provider || 'Unknown provider'}`,
              })),
            ]}
          />
          <Button
            className="mt-3"
            variant="secondary"
            disabled={!alias || busy}
            onClick={async () => {
              const result = await onAlias(current.id, alias);
              if (result.error) setError(result.error.message);
              else {
                setMessage('Duplicate linked.');
                setAlias('');
              }
            }}
          >
            Link duplicate
          </Button>
        </details>
      )}
    </DiscoveryDialog>
  );
}
