import { describe, expect, it } from 'vitest';
import { CAREER_ROUTES, PRE_UNIVERSITY, SOURCES, STATUS_LABELS } from '@/data/careerRoutes';
import { EDUCATION_LEVELS } from '@/types';
import { buildCareerRouteMap, formatYears, hasCareerRoutes, ROUTE_ORDER } from './careerRoutes';

describe('reviewed route data', () => {
  it('uses only known sources, all served over HTTPS', () => {
    for (const source of Object.values(SOURCES)) {
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.title).toBeTruthy();
      expect(source.publisher).toBeTruthy();
    }
    const cited = [
      ...Object.values(PRE_UNIVERSITY).flatMap((s) => s.sources),
      ...Object.values(CAREER_ROUTES).flatMap((p) => [
        ...p.degree.sources,
        ...p.afterDegree.flatMap((s) => s.sources),
        ...(p.workAfterDiploma?.sources ?? []),
      ]),
    ];
    for (const id of cited) expect(SOURCES, `unknown source "${id}"`).toHaveProperty(id);
  });

  it('cites a source for every pre-university stage and every degree', () => {
    for (const stage of Object.values(PRE_UNIVERSITY))
      expect(stage.sources.length).toBeGreaterThan(0);
    for (const [slug, profile] of Object.entries(CAREER_ROUTES)) {
      expect(profile.degree.sources.length, slug).toBeGreaterThan(0);
    }
  });

  it('gives every career a route status for each pre-university option', () => {
    for (const [slug, profile] of Object.entries(CAREER_ROUTES)) {
      for (const key of ROUTE_ORDER) {
        expect(profile.routes[key], `${slug}.${key}`).toBeDefined();
        expect(Object.keys(STATUS_LABELS)).toContain(profile.routes[key].status);
      }
      const [min, max] = profile.degree.years;
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThanOrEqual(min);
      for (const step of profile.afterDegree) expect(step.note, slug).toBeTruthy();
    }
  });

  it('covers all twenty published careers', () => {
    expect(Object.keys(CAREER_ROUTES).sort()).toEqual(
      [
        'accountant',
        'architect',
        'biomedical-scientist',
        'chef',
        'electrical-engineer',
        'lawyer',
        'mechanical-engineer',
        'physiotherapist',
        'psychologist',
        'civil-engineer',
        'cybersecurity-analyst',
        'data-analyst',
        'data-scientist',
        'graphic-designer',
        'medical-doctor',
        'multimedia-designer',
        'nurse',
        'pharmacist',
        'secondary-school-teacher',
        'software-engineer',
      ].sort()
    );
  });
});

describe('formatYears', () => {
  it('formats single values, ranges and half years', () => {
    expect(formatYears([1, 1])).toBe('1 year');
    expect(formatYears([4, 4])).toBe('4 years');
    expect(formatYears([3, 4])).toBe('3–4 years');
    expect(formatYears([1.5, 1.5])).toBe('1.5 years');
    expect(formatYears(null)).toBeNull();
  });
});

describe('buildCareerRouteMap', () => {
  it('returns nothing without a starting level or a reviewed career', () => {
    expect(buildCareerRouteMap('software-engineer', null)).toBeNull();
    expect(buildCareerRouteMap('astronaut', 'spm')).toBeNull();
    expect(hasCareerRoutes('astronaut')).toBe(false);
  });

  it('branches into every pre-university route for an SPM leaver, in a fixed order', () => {
    const map = buildCareerRouteMap('software-engineer', 'spm');
    expect(map.start.label).toBe('SPM');
    expect(map.routes.map((r) => r.id)).toEqual(ROUTE_ORDER);
    for (const route of map.routes) {
      expect(route.steps.map((s) => s.kind)).toEqual(['pre', 'degree']);
    }
  });

  it('adds up typical study time per route', () => {
    const map = buildCareerRouteMap('software-engineer', 'spm');
    const byId = Object.fromEntries(map.routes.map((r) => [r.id, r]));
    expect(byId.foundation.total).toEqual([4, 5]);
    expect(byId.matriculation.total).toEqual([4, 6]);
    expect(byId.stpm.total).toEqual([4.5, 5.5]);
    expect(byId.diploma.total).toEqual([5.5, 7]);
    expect(byId.foundation.totalLabel).toBe('About 4–5 years of study');
  });

  it('notes credit transfer and a work exit only on the diploma route', () => {
    const map = buildCareerRouteMap('software-engineer', 'spm');
    const diploma = map.routes.find((r) => r.id === 'diploma');
    const foundation = map.routes.find((r) => r.id === 'foundation');
    expect(diploma.steps[1].note).toMatch(/Credit transfer/);
    expect(foundation.steps[1].note).not.toMatch(/Credit transfer/);
    expect(diploma.workExit.label).toBe('Work after the diploma');
    expect(foundation.workExit).toBeNull();
  });

  it('flags restricted routes instead of hiding or confirming them', () => {
    const map = buildCareerRouteMap('medical-doctor', 'spm');
    const diploma = map.routes.find((r) => r.id === 'diploma');
    expect(diploma.status).toBe('check');
    expect(diploma.statusLabel).toBe('Check carefully');
    expect(diploma.steps[0].note).toMatch(/Check the specific medical school/);
    expect(diploma.workExit).toBeNull();
  });

  it('mentions professional steps in the total for regulated careers', () => {
    const map = buildCareerRouteMap('civil-engineer', 'spm');
    expect(map.afterDegree.map((s) => s.label)).toEqual([
      'Register as a Graduate Engineer (BEM)',
      'Professional Engineer (Ir.)',
    ]);
    expect(map.routes[0].totalLabel).toBe('About 5 years of study, then the professional steps');
  });

  it('gives a single route from the student’s current pre-university level', () => {
    for (const level of ['stpm', 'matriculation', 'foundation']) {
      const map = buildCareerRouteMap('pharmacist', level);
      expect(map.routes).toHaveLength(1);
      expect(map.routes[0].steps[0].kind).toBe('current');
      expect(map.routes[0].steps[0].label).toMatch(/where you are now/);
      expect(map.routes[0].total).toEqual([4, 4]);
    }
  });

  it('lets a diploma holder continue to a degree or go to work', () => {
    const map = buildCareerRouteMap('nurse', 'diploma');
    expect(map.routes).toHaveLength(1);
    expect(map.routes[0].steps[1].note).toMatch(/Credit transfer/);
    expect(map.routes[0].workExit.label).toBe('Register and work as a nurse');
  });

  it('asks STAM holders to check acceptance', () => {
    const map = buildCareerRouteMap('accountant', 'stam');
    expect(map.routes[0].status).toBe('check');
    expect(map.routes[0].steps[0].note).toMatch(/explicitly accepts STAM/);
  });

  it('builds a map for every career from every education level', () => {
    for (const slug of Object.keys(CAREER_ROUTES)) {
      for (const level of EDUCATION_LEVELS) {
        const map = buildCareerRouteMap(slug, level);
        expect(map.routes.length, `${slug} from ${level}`).toBeGreaterThan(0);
        for (const route of map.routes) {
          for (const step of route.steps) expect(step.label).toBeTruthy();
        }
      }
    }
  });
});
