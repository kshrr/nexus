import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { reviewedCareer } from '@/test/fixtures/careerEvidence';
const f = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table) => {
      const filters = {};
      let single = false;
      const q = {
        select: () => q,
        eq: (k, v) => {
          filters[k] = v;
          return q;
        },
        order: () => q,
        in: () => q,
        overlaps: () => q,
        or: () => q,
        limit: () => q,
        maybeSingle: () => {
          single = true;
          return f.read(table, filters, single);
        },
        then: (resolve, reject) => f.read(table, filters, single).then(resolve, reject),
      };
      return q;
    },
  },
}));
import { rankCourses, rankScholarships, useCareer, useCareers } from './useCareers';
beforeEach(() => {
  f.read.mockReset();
  f.read.mockImplementation(async (table, filters, single) => ({
    data:
      table === 'careers'
        ? single
          ? reviewedCareer({ overrides: { slug: filters.slug } })
          : [reviewedCareer()]
        : table === 'career_pathway_stages'
          ? [
              {
                id: 'stage',
                from_education_level: filters.from_education_level,
                stage_title: 'Recorded stage',
              },
            ]
          : [],
    error: null,
  }));
});
it('loads the career without the retired pathway-stage table', async () => {
  const { result } = renderHook(() => useCareer('software-engineer', 'spm'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.career.slug).toBe('software-engineer');
  expect(f.read.mock.calls.map(([table]) => table)).not.toContain('career_pathway_stages');
});
it('clears old results and reports unavailable source-backed schema honestly', async () => {
  f.read.mockResolvedValue({
    data: null,
    error: { code: '42703', message: 'column content_review does not exist' },
  });
  const { result } = renderHook(() => useCareers());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error.message).toMatch(/Career content update unavailable/i);
  expect(result.current.careers).toEqual([]);
});
it('a slower earlier career response cannot overwrite the new route', async () => {
  let resolveOld;
  const old = new Promise((resolve) => {
    resolveOld = resolve;
  });
  f.read.mockImplementation(async (table, filters) =>
    table === 'careers' && filters.slug === 'old'
      ? old
      : {
          data:
            table === 'careers'
              ? reviewedCareer({ overrides: { slug: 'new', name: 'New career' } })
              : [],
          error: null,
        }
  );
  const { result, rerender } = renderHook(({ slug }) => useCareer(slug, 'spm'), {
    initialProps: { slug: 'old' },
  });
  rerender({ slug: 'new' });
  await waitFor(() => expect(result.current.career?.slug).toBe('new'));
  await act(async () =>
    resolveOld({ data: reviewedCareer({ overrides: { slug: 'old' } }), error: null })
  );
  expect(result.current.career.slug).toBe('new');
});
it('puts the next study level first for the student', () => {
  const courses = [
    { id: 'd', name: 'Bachelor B', pathway_type: 'degree', universities: { name: 'UM' } },
    { id: 'f', name: 'Foundation A', pathway_type: 'foundation', universities: null },
    { id: 'p', name: 'Diploma C', pathway_type: 'diploma', universities: { name: 'UTM' } },
    { id: 'd', name: 'Bachelor B', pathway_type: 'degree', universities: { name: 'UM' } },
  ];
  expect(rankCourses(courses, 'spm').map((c) => c.id)).toEqual(['f', 'p', 'd']);
  expect(rankCourses(courses, 'diploma').map((c) => c.id)).toEqual(['d', 'p', 'f']);
  expect(rankCourses(courses, null)[0]).toMatchObject({ id: 'd', university_name: 'UM' });
});
it('lists field scholarships before open ones and drops those closed to the level', () => {
  const field = [
    { id: 'a', education_levels: ['spm'] },
    { id: 'b', education_levels: ['diploma'] },
  ];
  const open = [
    { id: 'c', education_levels: [] },
    { id: 'a', education_levels: ['spm'] },
  ];
  expect(rankScholarships(field, open, 'spm')).toEqual([
    { id: 'a', education_levels: ['spm'], openToAllFields: false },
    { id: 'c', education_levels: [], openToAllFields: true },
  ]);
  expect(rankScholarships(field, open, null).map((s) => s.id)).toEqual(['a', 'b', 'c']);
});
it('matches catalogue courses for careers that have no hand-made links', async () => {
  f.read.mockImplementation(async (table, filters, single) => ({
    data:
      table === 'careers'
        ? reviewedCareer({ overrides: { slug: 'software-engineer' } })
        : table === 'courses'
          ? [
              {
                id: 'x',
                name: 'Bachelor of Software Engineering',
                field_of_study: 'Computer Science',
                pathway_type: 'degree',
              },
              {
                id: 'y',
                name: 'Bachelor of Information Technology (Tourism)',
                field_of_study: 'Business and Economics',
                pathway_type: 'degree',
              },
              {
                id: 'z',
                name: 'Foundation in Computing',
                field_of_study: 'Science',
                pathway_type: 'foundation',
              },
            ]
          : table === 'scholarships'
            ? [{ id: 's', name: 'TNB', education_levels: [] }]
            : [],
    error: null,
    single,
  }));
  const { result } = renderHook(() => useCareer('software-engineer', 'spm'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  // A name match in an unrelated field is dropped; foundations are kept.
  expect(result.current.courses.map((c) => c.id)).toEqual(['z', 'x']);
  expect(result.current.scholarships.map((s) => s.id)).toEqual(['s']);
});
