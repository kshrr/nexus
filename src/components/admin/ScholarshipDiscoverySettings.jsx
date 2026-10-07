import { useState } from 'react';
import { Input, Button } from '@/components/ui';
import { DiscoveryDialog } from './DiscoveryDialog';
export function ScholarshipDiscoverySettings({ settings, onSave, onClose }) {
  const [queries, setQueries] = useState(settings.queries.join('\n'));
  const [region, setRegion] = useState(settings.region);
  const [target, setTarget] = useState(settings.target_count);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(event) {
    event.preventDefault();
    const list = queries
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean);
    if (!list.length || list.length > 6) {
      setError('Use between one and six search queries.');
      return;
    }
    setBusy(true);
    const result = await onSave({ queries: list, region, target_count: Number(target) });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else onClose();
  }
  return (
    <DiscoveryDialog title="Search settings" onClose={onClose}>
      <form onSubmit={save} className="space-y-5">
        <div>
          <label htmlFor="discovery-queries" className="mb-2 block text-caption font-medium">
            Search queries
          </label>
          <textarea
            id="discovery-queries"
            rows={7}
            value={queries}
            onChange={(event) => setQueries(event.target.value)}
            className="w-full rounded-input border border-ink-300 p-3"
            required
            aria-describedby="query-hint"
          />
          <p id="query-hint" className="mt-2 text-body-sm text-ink-500">
            One query per line, up to six. Use {'{year}'} for the current year.
          </p>
        </div>
        <Input
          label="Region"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          maxLength={100}
          required
        />
        <Input
          label="Catalogue target"
          type="number"
          min={1}
          max={1000}
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          required
          hint="A catalogue target; new results depend on available programmes."
        />
        {error && (
          <p role="alert" className="text-rust-600">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy}>
          Save settings
        </Button>
      </form>
    </DiscoveryDialog>
  );
}
