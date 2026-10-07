import { useState } from 'react';
import { Alert, Card, EmptyState, Select } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/feedback';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAuditLog } from '@/hooks/useAdminOps';

const FILTERS = [
  { value: 'all', label: 'All activity' },
  { value: 'scholarships', label: 'Scholarships' },
  { value: 'scholarship_criteria', label: 'Eligibility criteria' },
  { value: 'courses', label: 'Courses' },
  { value: 'universities', label: 'Universities' },
  { value: 'careers', label: 'Careers' },
  { value: 'role', label: 'Role grants' },
];

/**
 * Audit log (NFR09 / FR-SEC-09, ui-spec §10.5).
 *
 * Read-only, with no delete control anywhere in the UI — and the absence is the
 * design. `audit_log` has no UPDATE and no DELETE policy, and those privileges
 * are revoked from anon and authenticated (§4.7), so the trail is append-only by
 * construction rather than by convention. That is what makes it worth anything
 * as evidence.
 *
 * Rows are written by database triggers on every administrator write, so an
 * admin cannot make a change that escapes the log.
 */
export function AdminAudit() {
  const [filter, setFilter] = useState('all');
  const { entries, loading, error, reload } = useAuditLog({ action: filter });

  return (
    <>
      <AdminPageHeader
        title="Audit log"
        description="Every administrator write, with who made it and when."
      />

      <Alert variant="info" title="This log cannot be edited or deleted." className="mb-4">
        Not by an administrator, and not through the API. The table has no UPDATE or DELETE policy
        and those privileges are revoked, so entries can only ever be added.
      </Alert>

      <Select
        label="Filter by area"
        className="mb-4 max-w-xs"
        options={FILTERS}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {loading ? (
        <LoadingState rows={2} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Create or edit a scholarship, course or career and it will appear here immediately."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-body-sm">
            <caption className="sr-only">Administrator activity, newest first</caption>
            <thead>
              <tr className="border-b border-ink-300 text-left text-caption text-ink-500">
                <th className="p-3">When</th>
                <th className="p-3">Who</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-ink-100 align-top">
                  <td className="p-3 whitespace-nowrap tabular-nums text-ink-700">
                    {new Date(entry.created_at).toLocaleString('en-GB')}
                  </td>
                  <td className="p-3 font-mono text-caption text-ink-500">
                    {entry.actor_user_id ? `${entry.actor_user_id.slice(0, 8)}…` : 'system'}
                  </td>
                  <td className="p-3 text-ink-900">{entry.action}</td>
                  <td className="p-3 text-ink-700">
                    {entry.metadata?.name || entry.metadata?.label || entry.target_table || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

export default AdminAudit;
