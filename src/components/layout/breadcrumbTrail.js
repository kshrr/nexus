const LABELS = {
  '/dashboard': 'Dashboard',
  '/courses': 'Courses',
  '/careers': 'Careers',
  '/scholarships': 'Scholarships',
  '/find-your-path': 'Find Your Path',
  '/find-your-path/assessment': 'Interest assessment',
  '/find-your-path/results': 'Your results',
  '/find-your-path/academic': 'Academic analysis',
  '/recommendations': 'Recommendations',
  '/saved': 'Saved',
  '/profile': 'Profile',
  '/profile-setup': 'Profile setup',
  '/privacy': 'Privacy notice',
  '/login': 'Log in',
  '/register': 'Create account',
  '/verify': 'Verify email',
  '/reset-password': 'Reset password',
  '/admin': 'Admin',
  '/admin/scholarships': 'Scholarships',
  '/admin/scholarship-discovery': 'Scholarship discovery',
  '/admin/courses': 'Data management',
  '/admin/crawler': 'Crawler',
  '/admin/updates': 'Manual updates',
  '/admin/audit': 'Audit log',
};
// Pages that sit under a section other than the one their URL suggests.
const PARENTS = { '/recommendations': '/find-your-path' };
const DETAIL_ROOTS = new Set(['/courses', '/careers', '/scholarships']);

const parentOf = (path) => {
  if (PARENTS[path]) return PARENTS[path];
  const parts = path.split('/').filter(Boolean);
  return parts.length <= 1 ? '/' : `/${parts.slice(0, -1).join('/')}`;
};

const titleCase = (value) =>
  value.replace(/[-_]+/g, ' ').replace(/^\w/, (char) => char.toUpperCase());

function labelFor(path, labels) {
  if (LABELS[path]) return LABELS[path];
  if (labels[path]) return labels[path];
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 2 && DETAIL_ROOTS.has(`/${parts[0]}`)) return 'Details';
  return titleCase(parts[parts.length - 1] ?? '');
}

/** Home › Section › Page, derived from the URL. `items` overrides it (used for 404). */
export function buildTrail(pathname, labels = {}) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return [];
  const chain = [];
  let path = clean;
  while (path && path !== '/') {
    chain.unshift({ label: labelFor(path, labels), to: path });
    path = parentOf(path);
  }
  return [{ label: 'Home', to: '/' }, ...chain];
}
