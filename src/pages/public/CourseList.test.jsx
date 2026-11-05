import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, it, expect, vi } from 'vitest';
import CourseList from './CourseList';
const fixture = vi.hoisted(() => ({ fetch: null, rows: [] }));
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return {
    supabase: createClient('https://catalogue.test', 'test-public-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (...args) => fixture.fetch(...args) },
    }),
  };
});
const um = { id: 'um', name: 'Universiti Malaya', state: 'Kuala Lumpur', type: 'public' };
beforeEach(() => {
  fixture.rows = [
    {
      id: 'systems',
      name: 'Bachelor of Information Systems',
      field_of_study: 'Computer Science',
      pathway_type: 'degree',
      duration_months: 42,
      universities: um,
      university_id: 'um',
    },
    {
      id: 'medicine',
      name: 'Bachelor of Medicine',
      field_of_study: 'Medicine',
      pathway_type: 'degree',
      duration_months: 60,
      university_id: 'ukm',
      universities: {
        id: 'ukm',
        name: 'Universiti Kebangsaan Malaysia',
        state: 'Selangor',
        type: 'public',
      },
    },
  ];
  fixture.fetch = async (url) => {
    const p = new URL(url).searchParams;
    let rows = fixture.rows.filter(
      (row) =>
        (!p.has('universities.state') ||
          p.get('universities.state') === 'eq.' + row.universities.state) &&
        (!p.has('field_of_study') || p.get('field_of_study') === 'eq.' + row.field_of_study)
    );
    const total = rows.length;
    if (p.has('offset'))
      rows = rows.slice(Number(p.get('offset')), Number(p.get('offset')) + Number(p.get('limit')));
    return new Response(JSON.stringify(rows), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Range': `0-${Math.max(0, rows.length - 1)}/${total}`,
      },
    });
  };
});
function show(path = '/courses') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/courses" element={<CourseList />} />
      </Routes>
    </MemoryRouter>
  );
}
it('shows brief cards for scraped and other university courses with detail links', async () => {
  show();
  expect(
    await screen.findByRole('heading', { name: 'Bachelor of Information Systems' })
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Bachelor of Medicine' })).toBeInTheDocument();
  expect(screen.getByText('3.5 years')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: /view bachelor of information systems/i })
  ).toHaveAttribute('href', '/courses/systems');
  expect(screen.queryByText('Full local entry requirements.')).not.toBeInTheDocument();
});
it('combines filters and clears them to restore the entire catalogue', async () => {
  show();
  await screen.findByRole('option', { name: 'Selangor' });
  fireEvent.change(screen.getByLabelText('Location / state'), { target: { value: 'Selangor' } });
  await waitFor(() =>
    expect(
      screen.queryByRole('heading', { name: 'Bachelor of Information Systems' })
    ).not.toBeInTheDocument()
  );
  expect(screen.getByRole('heading', { name: 'Bachelor of Medicine' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Field of study'), {
    target: { value: 'Computer Science' },
  });
  expect(
    await screen.findByRole('heading', { name: 'No courses match your filters' })
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
  expect(
    await screen.findByRole('heading', { name: 'Bachelor of Information Systems' })
  ).toBeInTheDocument();
});
it('loads a selected state from a shareable catalogue URL', async () => {
  show('/courses?state=Selangor');
  expect(await screen.findByRole('heading', { name: 'Bachelor of Medicine' })).toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'Bachelor of Information Systems' })
  ).not.toBeInTheDocument();
});
it('can browse courses after the first results page', async () => {
  fixture.rows = Array.from({ length: 25 }, (_, index) => ({
    id: String(index),
    name: `Degree ${String(index + 1).padStart(2, '0')}`,
    field_of_study: 'Science',
    pathway_type: 'degree',
    duration_months: 36,
    universities: um,
  }));
  show();
  await screen.findByRole('heading', { name: 'Degree 01' });
  expect(screen.queryByRole('heading', { name: 'Degree 25' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /next page/i }));
  expect(await screen.findByRole('heading', { name: 'Degree 25' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Degree 01' })).not.toBeInTheDocument();
});
