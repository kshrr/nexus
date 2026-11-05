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
import { useCareer, useCareers } from './useCareers';
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
it('unknown education never receives an assumed SPM pathway', async () => {
  const { result } = renderHook(() => useCareer('software-engineer', null));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.stages).toEqual([]);
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
