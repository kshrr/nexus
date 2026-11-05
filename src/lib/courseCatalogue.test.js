import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, vi } from 'vitest';
import {
  fetchCoursePage,
  fetchCourseFacets,
  safeCourseSource,
  formatCourseDuration,
} from './courseCatalogue';

let clientNumber = 0;
function client(fetch) {
  return createClient('https://catalogue.test', 'test-public-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'course-test-' + ++clientNumber,
    },
    global: { fetch },
  });
}
const response = (data, total) =>
  new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Range': `0-${Math.max(0, data.length - 1)}/${total}`,
    },
  });

describe('published course browsing', () => {
  it('queries all active courses with brief metadata, stable server paging and real totals', async () => {
    let requested;
    const result = await fetchCoursePage(
      client(async (url) => {
        requested = new URL(url);
        return response([{ id: 'course-25', name: 'Medicine' }], 49);
      }),
      { page: 2 }
    );
    expect(requested).toBeDefined();
    expect(requested.searchParams.get('is_active')).toBe('eq.true');
    expect(requested.searchParams.get('offset')).toBe('24');
    expect(requested.searchParams.get('limit')).toBe('24');
    expect(requested.searchParams.get('order')).toBe('name.asc,id.asc');
    expect(requested.searchParams.get('select')).toContain('universities(');
    expect(requested.searchParams.get('select')).not.toContain('entry_requirements');
    expect(result.total).toBe(49);
    expect(result.items[0].id).toBe('course-25');
  });
  it('combines location, field, university, type, qualification and duration without filtering only one page', async () => {
    let requested;
    await fetchCoursePage(
      client(async (url) => {
        requested = new URL(url);
        return response([], 0);
      }),
      {
        search: 'Science, AI',
        state: 'Kuala Lumpur',
        field: 'Computer Science',
        university: 'um',
        type: 'public',
        pathway: 'degree',
        duration: '24-48',
        sort: 'duration',
        page: 1,
      }
    );
    expect(requested).toBeDefined();
    const p = requested.searchParams;
    expect(p.get('name')).toBe('ilike.%Science, AI%');
    expect(p.get('universities.state')).toBe('eq.Kuala Lumpur');
    expect(p.get('universities.type')).toBe('eq.public');
    expect(p.get('field_of_study')).toBe('eq.Computer Science');
    expect(p.get('university_id')).toBe('eq.um');
    expect(p.get('pathway_type')).toBe('eq.degree');
    expect(p.getAll('duration_months')).toEqual(['gte.24', 'lte.48']);
    expect(p.get('select')).toContain('universities!inner(');
    expect(p.get('order')).toBe('duration_months.asc.nullslast,name.asc,id.asc');
  });
  it('collects filter options beyond the database row cap from actual published course metadata', async () => {
    const first = Array.from({ length: 1000 }, (_, index) => ({
      id: String(index),
      field_of_study: 'Science',
      pathway_type: 'degree',
      universities: { id: 'um', name: 'Universiti Malaya', state: 'Kuala Lumpur', type: 'public' },
    }));
    const transport = vi.fn(async (url) => {
      const offset = new URL(url).searchParams.get('offset');
      return response(
        offset === '0'
          ? first
          : [
              {
                id: '1001',
                field_of_study: 'Law',
                pathway_type: 'diploma',
                universities: {
                  id: 'ukm',
                  name: 'Universiti Kebangsaan Malaysia',
                  state: 'Selangor',
                  type: 'public',
                },
              },
            ],
        1001
      );
    });
    const facets = await fetchCourseFacets(client(transport));
    expect(facets.fields).toEqual(['Law', 'Science']);
    expect(facets.states).toEqual(['Kuala Lumpur', 'Selangor']);
    expect(facets.universities.map((u) => u.id)).toEqual(['ukm', 'um']);
    expect(facets.total).toBe(1001);
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('reports a backend error rather than an empty catalogue', async () => {
    await expect(
      fetchCoursePage(
        client(
          async () =>
            new Response(JSON.stringify({ message: 'Catalogue unavailable' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            })
        ),
        {}
      )
    ).rejects.toMatchObject({ message: 'Catalogue unavailable' });
  });
  it('shows exact fractional durations and safe links for different university websites', () => {
    expect(formatCourseDuration(42)).toBe('3.5 years');
    expect(formatCourseDuration(18)).toBe('1.5 years');
    expect(formatCourseDuration(null)).toBe('Duration not listed');
    expect(safeCourseSource('https://admissions.ukm.my/degree/law?intake=2026')).toBe(
      'https://admissions.ukm.my/degree/law?intake=2026'
    );
    expect(safeCourseSource('javascript:alert(1)')).toBeNull();
    expect(safeCourseSource('https://user:password@study.um.edu.my/course')).toBeNull();
  });
});
