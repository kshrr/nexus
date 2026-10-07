/**
 * Navigation model. Routes match docs/ui-specifications.md §1.1 and
 * architecture.md §6.1. Pages that belong to later phases are marked
 * `{ placeholder: true }` so the shell can render them as "coming soon"
 * without pretending they work.
 */

/**
 * @typedef {Object} NavItem
 * @property {string} to
 * @property {string} label
 * @property {string} [group]
 * @property {boolean} [placeholder]
 * @property {boolean} [end]  exact-match active state
 */

/** @type {NavItem[]} */
export const PUBLIC_NAV = [
  { to: '/scholarships', label: 'Scholarships' },
  { to: '/careers', label: 'Careers' },
  { to: '/#how-it-works', label: 'How it works' },
];

/** @type {NavItem[]} */
export const STUDENT_NAV = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/find-your-path', label: 'Overview', group: 'Find your path', end: true },
  { to: '/find-your-path/assessment', label: 'Assessment', group: 'Find your path' },
  { to: '/find-your-path/results', label: 'Results', group: 'Find your path' },
  { to: '/find-your-path/academic', label: 'Academic', group: 'Find your path' },
  { to: '/recommendations', label: 'Recommendations', group: 'Find your path' },
  { to: '/scholarships', label: 'Scholarships' },
  { to: '/careers', label: 'Careers' },
  { to: '/saved', label: 'Saved' },
  { to: '/profile', label: 'Profile' },
];

/** Bottom tab bar on mobile — the five constant destinations (ui-spec §1.5). */
/** @type {NavItem[]} */
export const MOBILE_TABS = [
  { to: '/dashboard', label: 'Home', end: true },
  { to: '/find-your-path', label: 'Path' },
  { to: '/scholarships', label: 'Scholarships' },
  { to: '/careers', label: 'Careers' },
  { to: '/profile', label: 'Profile' },
];

/** @type {NavItem[]} */
export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/scholarships', label: 'Scholarships' },
  { to: '/admin/scholarship-discovery', label: 'Scholarship discovery' },
  { to: '/admin/crawler', label: 'Crawler logs' },
  { to: '/admin/updates', label: 'Manual updates' },
  { to: '/admin/courses', label: 'Data management' },
  { to: '/admin/audit', label: 'Audit log' },
];
