/**
 * Builds the education route map for one career from a starting level.
 *
 * Pure and deterministic: it only arranges the reviewed facts in
 * src/data/careerRoutes.js. It never decides whether a student is eligible.
 */
import { CAREER_ROUTES, PRE_UNIVERSITY, SOURCES, STATUS_LABELS } from '@/data/careerRoutes';
import { EDUCATION_LEVEL_LABELS } from '@/types';

/** Order routes are shown in for SPM leavers. */
export const ROUTE_ORDER = ['foundation', 'matriculation', 'stpm', 'diploma'];

const CURRENT_NOTES = {
  stpm: 'Use your STPM subjects and grades to choose degree programmes that accept them.',
  matriculation:
    'Matriculation leads into a bachelor’s degree. Check your stream and results against the programme requirements.',
  foundation:
    'Foundation usually leads into a degree at the same university. Check that other universities accept your award before applying there.',
  diploma:
    'You can work with your diploma or continue to a degree. Ask the university how much credit transfer it grants for your diploma.',
  stam: 'Check that each degree programme explicitly accepts STAM and your subjects; acceptance differs between programmes.',
};

/** @param {number} n */
const years = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * "4 years", "4–5 years", "1.5 years".
 * @param {[number, number] | null | undefined} range
 */
export function formatYears(range) {
  if (!range) return null;
  const [min, max] = range;
  const unit = max === 1 ? 'year' : 'years';
  return min === max ? `${years(min)} ${unit}` : `${years(min)}–${years(max)} ${unit}`;
}

/** @param {string[] | undefined} ids */
function resolveSources(ids) {
  return (ids ?? []).map((id) => (SOURCES[id] ? { id, ...SOURCES[id] } : null)).filter(Boolean);
}

/** True when this career has a reviewed route profile. */
export function hasCareerRoutes(slug) {
  return Boolean(slug && Object.hasOwn(CAREER_ROUTES, slug));
}

function degreeStep(profile, { afterDiploma = false } = {}) {
  const notes = [profile.degree.note];
  if (afterDiploma) {
    notes.push(
      'Credit transfer from your diploma may shorten the degree, if the university grants it.'
    );
  }
  return {
    kind: 'degree',
    pathwayType: 'degree',
    label: profile.degree.label,
    years: profile.degree.years,
    duration: `Typically ${formatYears(profile.degree.years)}`,
    note: notes.filter(Boolean).join(' '),
    sources: resolveSources(profile.degree.sources),
  };
}

function preUniversityStep(key, routeConfig) {
  const base = PRE_UNIVERSITY[key];
  return {
    kind: 'pre',
    pathwayType: key === 'foundation' || key === 'diploma' ? key : null,
    stage: key,
    label: routeConfig.label ?? base.label,
    years: base.years,
    duration: base.duration,
    apply: base.apply,
    note: [routeConfig.note, base.note].filter(Boolean).join(' '),
    sources: resolveSources(base.sources),
  };
}

function currentStep(level) {
  const base = PRE_UNIVERSITY[level];
  return {
    kind: 'current',
    pathwayType: null,
    stage: level,
    label: `${EDUCATION_LEVEL_LABELS[level] ?? level.toUpperCase()} (where you are now)`,
    years: null,
    duration: null,
    note: CURRENT_NOTES[level] ?? '',
    sources: resolveSources(base?.sources),
  };
}

function totalOf(steps) {
  const timed = steps.filter((s) => s.years && s.kind !== 'current');
  if (!timed.length) return null;
  return [
    timed.reduce((sum, s) => sum + s.years[0], 0),
    timed.reduce((sum, s) => sum + s.years[1], 0),
  ];
}

function workExit(profile) {
  if (!profile.workAfterDiploma) return null;
  return {
    label: profile.workAfterDiploma.label,
    note: profile.workAfterDiploma.note,
    sources: resolveSources(profile.workAfterDiploma.sources),
  };
}

/**
 * @param {string} slug career slug
 * @param {string | null} startLevel one of EDUCATION_LEVELS
 * @returns {null | {
 *   start: { level: string, label: string },
 *   routes: Array<{ id: string, status: string, statusLabel: string, label: string,
 *     duration: string | null, steps: any[], total: [number, number] | null,
 *     totalLabel: string | null, workExit: any }>,
 *   degree: any,
 *   afterDegree: any[],
 * }}
 */
export function buildCareerRouteMap(slug, startLevel) {
  if (!hasCareerRoutes(slug) || !startLevel) return null;
  const profile = CAREER_ROUTES[slug];
  const degree = degreeStep(profile);
  const afterDegree = (profile.afterDegree ?? []).map((step) => ({
    kind: 'after',
    label: step.label,
    duration: step.duration ?? null,
    note: step.note,
    sources: resolveSources(step.sources),
  }));

  let routes;
  if (startLevel === 'spm') {
    routes = ROUTE_ORDER.filter((key) => profile.routes[key]).map((key) => {
      const config = profile.routes[key];
      const pre = preUniversityStep(key, config);
      const steps = [pre, degreeStep(profile, { afterDiploma: key === 'diploma' })];
      return {
        id: key,
        status: config.status,
        statusLabel: STATUS_LABELS[config.status],
        label: pre.label,
        // Short form for the diagram; the step keeps the full wording.
        duration: formatYears(pre.years),
        steps,
        total: totalOf(steps),
        workExit: key === 'diploma' ? workExit(profile) : null,
      };
    });
  } else {
    const steps = [
      currentStep(startLevel),
      degreeStep(profile, { afterDiploma: startLevel === 'diploma' }),
    ];
    routes = [
      {
        id: startLevel,
        status: startLevel === 'stam' ? 'check' : 'common',
        statusLabel: STATUS_LABELS[startLevel === 'stam' ? 'check' : 'common'],
        label: EDUCATION_LEVEL_LABELS[startLevel] ?? startLevel,
        duration: null,
        steps,
        total: totalOf(steps),
        workExit: startLevel === 'diploma' ? workExit(profile) : null,
      },
    ];
  }

  for (const route of routes) {
    const total = formatYears(route.total);
    route.totalLabel = total
      ? `About ${total} of study${afterDegree.length ? ', then the professional steps' : ''}`
      : null;
  }

  return {
    start: { level: startLevel, label: EDUCATION_LEVEL_LABELS[startLevel] ?? startLevel },
    routes,
    degree,
    afterDegree,
  };
}

/**
 * The whole journey to a career as a short list of stages, independent of the
 * student's level: SPM, the pre-university options, the degree, any professional
 * steps and the career itself. It only rearranges the reviewed route data.
 *
 * @param {string} slug career slug
 * @returns {null | Array<{ id: string, step: string, title: string,
 *   duration: string | null, summary: string | null,
 *   options?: Array<{ id: string, label: string, duration: string | null, status: string, statusLabel: string }>,
 *   sources: any[] }>}
 */
export function buildCareerJourney(slug) {
  if (!hasCareerRoutes(slug)) return null;
  const profile = CAREER_ROUTES[slug];
  const options = ROUTE_ORDER.filter((key) => profile.routes[key]).map((key) => ({
    id: key,
    label: profile.routes[key].label,
    duration: formatYears(PRE_UNIVERSITY[key].years),
    status: profile.routes[key].status,
    statusLabel: STATUS_LABELS[profile.routes[key].status],
  }));
  const preSources = ROUTE_ORDER.flatMap((key) => PRE_UNIVERSITY[key].sources);
  const stages = [
    {
      id: 'school',
      step: 'Secondary school',
      title: 'SPM',
      duration: null,
      summary: 'Build the school subjects this career uses most.',
      sources: [],
    },
    {
      id: 'pre-university',
      step: 'After SPM',
      title: 'Choose a pre-university route',
      duration: null,
      summary: profile.workAfterDiploma
        ? `With a diploma you can also start work: ${profile.workAfterDiploma.note}`
        : null,
      options,
      sources: resolveSources([...new Set(preSources)]),
    },
    {
      id: 'degree',
      step: 'Degree',
      title: profile.degree.label,
      duration: `Typically ${formatYears(profile.degree.years)}`,
      summary: profile.degree.note ?? null,
      sources: resolveSources(profile.degree.sources),
    },
    ...(profile.afterDegree ?? []).map((step, index) => ({
      id: `after-${index}`,
      step: 'Professional step',
      title: step.label,
      duration: step.duration ?? null,
      summary: step.note,
      sources: resolveSources(step.sources),
    })),
  ];
  return stages;
}
