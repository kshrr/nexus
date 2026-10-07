import { Badge } from '@/components/ui';
import { daysUntil, deadlineUrgency, formatDate } from '@/lib/format';

/**
 * Deadline treatment (report §3.4.2 / AC-30, ui-spec §3.10).
 *
 * Three visual levels plus rolling intake. The 7- and 30-day thresholds are
 * among the few precise numbers the report gives — do not change them. They are
 * mirrored by the SQL `deadline_urgency()` function.
 *
 * Colour never carries the meaning alone: every state has text.
 *
 * @param {{ deadline: string | null, expired?: boolean }} props
 */
export function DeadlineBadge({ deadline, expired = false }) {
  if (expired) {
    return <Badge variant="neutral">Closed</Badge>;
  }
  if (!deadline) {
    return <Badge variant="neutral">Rolling intake</Badge>;
  }

  const days = daysUntil(deadline);
  const urgency = deadlineUrgency(deadline);

  if (days != null && days < 0) {
    return <Badge variant="neutral">Closed {formatDate(deadline)}</Badge>;
  }

  const closesIn = days === 0 ? 'Closes today' : `Closes in ${days} ${days === 1 ? 'day' : 'days'}`;

  if (urgency === 'critical') return <Badge variant="critical">{closesIn}</Badge>;
  if (urgency === 'warning') return <Badge variant="warning">{closesIn}</Badge>;

  return (
    <span className="text-body-sm tabular-nums text-ink-500">Closes {formatDate(deadline)}</span>
  );
}

export default DeadlineBadge;
