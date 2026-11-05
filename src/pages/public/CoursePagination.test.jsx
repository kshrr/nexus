import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { beforeEach, it, expect, vi } from 'vitest';
import CourseList from './CourseList';
import { fetchCoursePage } from '@/lib/courseCatalogue';
import { supabase } from '@/lib/supabase';
const fixture = vi.hoisted(() => ({ fetch: null, rows: [] }));
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return {
    supabase: createClient('https://pagination.test', 'test-public-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (...args) => fixture.fetch(...args) },
    }),
  };
});
beforeEach(() => {
  fixture.rows = Array.from({ length: 25 }, (_, index) => ({
    id: String(index),
    name: 'Degree ' + String(index + 1).padStart(2, '0'),
    field_of_study: 'Science',
    pathway_type: 'degree',
    duration_months: 36,
    universities:
      index === 24
        ? { id: 'ukm', name: 'UKM', state: 'Selangor', type: 'public' }
        : { id: 'um', name: 'UM', state: 'Kuala Lumpur', type: 'public' },
  }));
  fixture.fetch = async (url) => {
    const p = new URL(url).searchParams,
      offset = Number(p.get('offset') ?? 0);
    const matching = fixture.rows.filter(
      (row) =>
        !p.has('universities.state') ||
        p.get('universities.state') === 'eq.' + row.universities.state
    );
    if (offset >= matching.length && offset > 0)
      return new Response(
        JSON.stringify({
          code: 'PGRST103',
          message: 'Requested range not satisfiable',
          details:
            'An offset of ' +
            offset +
            ' was requested but there are only ' +
            matching.length +
            ' rows.',
        }),
        { status: 416, headers: { 'Content-Type': 'application/json' } }
      );
    const rows = matching.slice(offset, offset + Number(p.get('limit') ?? 1000));
    return new Response(JSON.stringify(rows), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Range':
          offset + '-' + (offset + Math.max(rows.length - 1, 0)) + '/' + matching.length,
      },
    });
  };
});
function HistoryBack() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Back in history</button>;
}
function show(path = '/courses') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <HistoryBack />
      <Routes>
        <Route path="/courses" element={<CourseList />} />
      </Routes>
    </MemoryRouter>
  );
}
it('preserves restored page two after navigating back from a smaller filtered catalogue', async () => {
  show();
  await screen.findByRole('heading', { name: 'Degree 01' });
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByRole('heading', { name: 'Degree 25' });
  fireEvent.change(screen.getByLabelText('Location / state'), {
    target: { value: 'Kuala Lumpur' },
  });
  await screen.findByRole('heading', { name: 'Degree 01' });
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Degree 25' })).not.toBeInTheDocument()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Back in history' }));
  expect(await screen.findByRole('heading', { name: 'Degree 25' })).toBeInTheDocument();
  expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
});
it('recovers an out-of-range shared URL to a real results page', async () => {
  show('/courses?page=100000');
  expect(await screen.findByRole('heading', { name: 'Degree 25' })).toBeInTheDocument();
  expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
});
it('handles PostgREST 416 using a fresh exact count rather than error-message parsing', async () => {
  const result = await fetchCoursePage(supabase, { page: 100000 });
  expect(result.total).toBe(25);
  expect(result.outOfRange).toBe(true);
});
