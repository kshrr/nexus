import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Card, Spinner } from '@/components/ui';

/**
 * The eligibility checklist (FR10 / AC-31 / AC-32, architecture.md §10.6,
 * ui-spec §3.11).
 *
 * Three states, and the third is the important one:
 *   ✓ satisfied    green
 *   ✗ unsatisfied  red, with a hint saying what to do where one is available
 *   — unknown      grey, "we can't check this"
 *
 * An `unknown` criterion is NEVER rendered as a failure. Showing a false ✗ on
 * something Nexus cannot verify could stop a student applying for a scholarship
 * they actually qualify for — a real harm, and the reason this is a design
 * decision rather than an implementation detail.
 *
 * @param {{
 *   criteria: { id: string, label: string, is_checkable: boolean }[],
 *   match: { checklist: any[], satisfied_count: number, checkable_count: number } | null,
 *   authenticated: boolean,
 *   loading?: boolean,
 *   error?: { message: string } | null,
 * }} props
 */
export function EligibilityChecklist({ criteria, match, authenticated, loading, error }) {
  // --- anonymous: matching needs a profile (Conflict C-09 resolution) ------
  if (!authenticated) {
    return (
      <Card variant="titled" title="Eligibility check">
        <p className="text-body-sm text-ink-700">
          Sign in to see which of these requirements you already meet.
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            to="/login"
            className="inline-flex h-9 items-center rounded-input bg-pine-700 px-3 text-body-sm font-medium text-white hover:bg-pine-500"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="inline-flex h-9 items-center rounded-input border border-ink-300 px-3 text-body-sm font-medium text-ink-900 hover:border-ink-500"
          >
            Create account
          </Link>
        </div>
        {criteria.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 border-t border-ink-300 pt-3">
            {criteria.map((c) => (
              <li key={c.id} className="flex gap-2 text-body-sm text-ink-700">
                <span aria-hidden="true" className="text-ink-300">
                  •
                </span>
                {c.label}
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  if (loading) {
    return (
      <Card variant="titled" title="Eligibility check">
        <div className="flex items-center gap-2 text-body-sm text-ink-500">
          <Spinner size="sm" /> Checking your profile…
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="titled" title="Eligibility check">
        <p className="text-body-sm text-rust-600">
          We couldn&rsquo;t check your eligibility just now. The requirements are still listed
          below.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {criteria.map((c) => (
            <li key={c.id} className="text-body-sm text-ink-700">
              {c.label}
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (criteria.length === 0) {
    return (
      <Card variant="titled" title="Eligibility check">
        <p className="text-body-sm text-ink-700">
          No eligibility requirements have been recorded for this scholarship yet. Check the
          provider&rsquo;s page for the conditions.
        </p>
      </Card>
    );
  }

  const checklist = match?.checklist ?? [];

  return (
    <Card variant="titled" title="Eligibility check">
      {match && match.checkable_count > 0 ? (
        <p className="text-body text-ink-900">
          You meet{' '}
          <span className="font-medium tabular-nums">
            {match.satisfied_count} of {match.checkable_count}
          </span>{' '}
          requirements we can check
        </p>
      ) : (
        <p className="text-body-sm text-ink-700">
          None of these requirements can be checked from your profile.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {checklist.map((item) => (
          <li key={item.criterion_id} className="flex gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'w-4 shrink-0 text-center font-medium',
                item.status === 'satisfied' && 'text-pine-700',
                item.status === 'unsatisfied' && 'text-rust-600',
                item.status === 'unknown' && 'text-slate-600'
              )}
            >
              {item.status === 'satisfied' ? '✓' : item.status === 'unsatisfied' ? '✗' : '—'}
            </span>
            <span className="flex-1">
              <span className="sr-only">
                {item.status === 'satisfied'
                  ? 'Met: '
                  : item.status === 'unsatisfied'
                    ? 'Not met: '
                    : 'Cannot be checked: '}
              </span>
              <span
                className={cn(
                  'text-body-sm',
                  item.status === 'unknown' ? 'text-ink-700' : 'text-ink-900'
                )}
              >
                {item.label}
              </span>
              {item.hint && <span className="block text-body-sm text-ink-500">{item.hint}</span>}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-ink-300 pt-3 text-body-sm text-ink-500">
        This is a guide, not a decision. Always confirm the conditions on the provider&rsquo;s
        official page before applying.
      </p>
    </Card>
  );
}

export default EligibilityChecklist;
