/**
 * Presentation helpers. Pure functions, no React. Copy conventions follow
 * ui-specifications.md §0.4 and §16 (sentence case, plain language).
 */

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * @param {string | number | Date | null | undefined} value
 * @returns {string}  e.g. "15 Oct 2026", or "" when absent
 */
export function formatDate(value) {
  if (value == null) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : DATE_FMT.format(d);
}

/**
 * Whole days from now until `deadline` (negative when past).
 * @param {string | Date | null | undefined} deadline
 * @param {Date} [now]
 * @returns {number | null}
 */
export function daysUntil(deadline, now = new Date()) {
  if (deadline == null) return null;
  const d = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  const msPerDay = 86_400_000;
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((end - start) / msPerDay);
}

/**
 * Deadline urgency band — mirrors the SQL `deadline_urgency()` thresholds
 * (architecture.md §3.8 / §10.2). Do not change these numbers.
 * @param {string | Date | null | undefined} deadline
 * @param {Date} [now]
 * @returns {'critical' | 'warning' | 'normal' | 'none'}
 */
export function deadlineUrgency(deadline, now = new Date()) {
  const days = daysUntil(deadline, now);
  if (days == null) return 'none';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'warning';
  return 'normal';
}

/**
 * "Good morning" / "Good afternoon" / "Good evening" for the dashboard greeting.
 * @param {Date} [now]
 * @returns {string}
 */
export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * First name only — the chatbot and greeting use the given name (architecture.md §12.2).
 * @param {string | null | undefined} fullName
 * @returns {string}
 */
export function firstName(fullName) {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0] ?? '';
}

/**
 * @param {number} count
 * @param {string} singular
 * @param {string} [plural]
 * @returns {string}  "1 scholarship" / "3 scholarships"
 */
export function pluralise(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Grade points -> letter, the inverse of the §8.2 mapping used by
 * `grade_to_points()`. Display only: §3.4.2 requires the subject card to show an
 * "average grade", and the stored value is an average of points. Non-integer
 * averages are shown as the nearest grade.
 *
 * @param {number | null | undefined} points
 * @returns {string}
 */
export function pointsToGrade(points) {
  if (points == null || Number.isNaN(Number(points))) return '—';
  const table = ['G', 'E', 'D', 'C', 'C+', 'B', 'B+', 'A-', 'A', 'A+']; // index = points 0..9
  const idx = Math.max(0, Math.min(9, Math.round(Number(points))));
  return table[idx];
}

/** Human label for a subject strength band (§8.3). */
export function strengthLabel(strength) {
  return { strong: 'Strong', average: 'Average', weak: 'Weak' }[strength] ?? '—';
}

/** Badge variant for a subject strength (ui-spec §2.4). */
export function strengthVariant(strength) {
  return { strong: 'success', average: 'neutral', weak: 'critical' }[strength] ?? 'neutral';
}
