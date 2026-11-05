import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AppShell } from '@/components/layout/AppShell';
import FindYourPath from './FindYourPath';

// Replace only account/network boundaries; render the real hub and shell.
const fixture = vi.hoisted(() => ({
  profile: { education_level: 'spm', full_name: 'Aina' },
  result: null,
  strengths: [],
  loading: false,
  error: null,
  reload: vi.fn(),
}));
vi.mock('@/context/useAuth', () => ({
  useAuth: () => ({
    profile: fixture.profile,
    user: { id: 'student-1', email: 'aina@nexus.test' },
    role: 'student',
    isAuthenticated: true,
    signOut: vi.fn(),
  }),
}));
vi.mock('@/hooks/useRiasec', () => ({
  useRiasecResult: () => ({
    result: fixture.result,
    loading: fixture.loading,
    error: fixture.error,
    reload: fixture.reload,
  }),
}));
vi.mock('@/hooks/useSubjectStrengths', () => ({
  useSubjectStrengths: () => ({
    strengths: fixture.strengths,
    loading: fixture.loading,
    error: fixture.error,
    reload: fixture.reload,
  }),
}));
vi.mock('@/components/chat/ChatLauncher', () => ({ ChatLauncher: () => null }));
beforeEach(() => {
  fixture.profile = { education_level: 'spm', full_name: 'Aina' };
  fixture.result = null;
  fixture.strengths = [];
  fixture.loading = false;
  fixture.error = null;
});
function show(path = '/find-your-path') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="find-your-path" element={<FindYourPath />} />
          <Route path="find-your-path/assessment" element={<h1>Assessment content</h1>} />
          <Route path="find-your-path/results" element={<h1>Interest results</h1>} />
          <Route path="find-your-path/academic" element={<h1>Academic content</h1>} />
          <Route path="recommendations" element={<h1>Recommendation content</h1>} />
          <Route path="dashboard" element={<h1>Dashboard content</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

it('provides the journey map and marks the assessment destination after navigating', () => {
  show();
  expect(screen.getByRole('heading', { name: 'Find your path', level: 1 })).toBeInTheDocument();
  const map = screen.getByRole('navigation', { name: 'Find your path route' });
  fireEvent.click(within(map).getByRole('link', { name: /RIASEC test/i }));
  expect(screen.getByRole('heading', { name: 'Assessment content' })).toBeInTheDocument();
  expect(within(map).getByRole('link', { name: /RIASEC test/i })).toHaveAttribute(
    'aria-current',
    'page'
  );
});
it('keeps recommendations unavailable until RIASEC is complete, with an explanation', () => {
  show();
  const map = screen.getByRole('navigation', { name: 'Find your path route' });
  expect(
    within(map).queryByRole('link', { name: /Nexus recommendations/i })
  ).not.toBeInTheDocument();
  expect(within(map).getByText('Complete RIASEC first')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'See my recommendations' })).toBeDisabled();
});
it('uses stored completion to link to interest results and unlock recommendations', () => {
  fixture.result = { holland_code: 'IAS', completed_at: '2026-10-11T00:00:00Z' };
  fixture.strengths = [
    { subjectCode: 'MAT', name: 'Mathematics', strength: 'strong', averagePoints: 8, examCount: 3 },
  ];
  show();
  const map = screen.getByRole('navigation', { name: 'Find your path route' });
  expect(within(map).getByRole('link', { name: /RIASEC test/i })).toHaveAttribute(
    'href',
    '/find-your-path/results'
  );
  expect(within(map).getByRole('link', { name: /Academic analysis/i })).toHaveTextContent(
    'Completed'
  );
  fireEvent.click(screen.getByRole('button', { name: 'See my recommendations' }));
  expect(screen.getByRole('heading', { name: 'Recommendation content' })).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: /Nexus recommendations/i, current: 'page' })
  ).toBeInTheDocument();
});
it('keeps non-SPM academic analysis an optional bypass, not a completion requirement', () => {
  fixture.profile.education_level = 'stpm';
  fixture.result = { holland_code: 'IAS', completed_at: '2026-10-11T00:00:00Z' };
  show();
  const map = screen.getByRole('navigation', { name: 'Find your path route' });
  expect(within(map).getByRole('link', { name: /Academic analysis/i })).toHaveTextContent(
    'SPM only · bypass'
  );
  expect(screen.queryByRole('button', { name: 'Add your results' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'See my recommendations' })).toBeEnabled();
});
it('allows collapsing the compact route panel', () => {
  show();
  const toggle = screen.getByRole('button', { name: /your route/i });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
it('does not restore a sidebar on unrelated student pages', () => {
  show('/dashboard');
  expect(
    screen.queryByRole('navigation', { name: 'Find your path route' })
  ).not.toBeInTheDocument();
});
it('keeps route navigation during loading without claiming completion', () => {
  fixture.loading = true;
  show('/find-your-path/academic');
  const map = screen.getByRole('navigation', { name: 'Find your path route' });
  expect(within(map).getByRole('link', { name: /Academic analysis/i })).toHaveAttribute(
    'aria-current',
    'page'
  );
  expect(within(map).queryByText('Completed')).not.toBeInTheDocument();
  expect(within(map).getAllByText('Checking…')).toHaveLength(2);
});
it('shows unavailable status rather than treating read errors as not-started data', () => {
  fixture.error = { message: 'Connection unavailable' };
  show();
  const map = screen.getByRole('navigation', { name: 'Find your path route' });
  expect(within(map).getAllByText('Status unavailable')).toHaveLength(2);
});
