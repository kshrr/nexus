import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { reviewedCareer, reviewedStage } from '@/test/fixtures/careerEvidence';
const f = vi.hoisted(() => ({
  career: null,
  stages: [],
  level: 'spm',
  save: vi.fn(),
  saved: false,
}));
vi.mock('@/hooks/useCareers', () => ({
  useCareer: () => ({
    career: f.career,
    stages: f.stages,
    courses: [],
    scholarships: [],
    loading: false,
    error: null,
    reload: () => {},
  }),
}));
vi.mock('@/context/useAuth', () => ({
  useAuth: () => ({ profile: { education_level: f.level } }),
}));
vi.mock('@/hooks/useRiasec', () => ({
  useRiasecResult: () => ({ result: { holland_code: 'ICS' }, loading: false }),
}));
vi.mock('@/hooks/useSubjectStrengths', () => ({
  useSubjectStrengths: () => ({ strengths: [], loading: false }),
}));
vi.mock('@/hooks/useSavedItems', () => ({
  useSavedItems: () => ({ toggle: f.save, isSaved: () => f.saved, loading: false }),
}));
import CareerDetail from './CareerDetail';
function show() {
  render(
    <MemoryRouter initialEntries={['/careers/software-engineer']}>
      <Routes>
        <Route path="/careers/:id" element={<CareerDetail />} />
      </Routes>
    </MemoryRouter>
  );
}
beforeEach(() => {
  f.level = 'spm';
  f.career = reviewedCareer();
  f.stages = [
    {
      id: 'stage',
      stage_order: 1,
      stage_title: 'Check current route',
      stage_description: 'No automatic admission',
      focus_points: [],
      content_review: reviewedStage({ kind: 'nexus_planning' }),
    },
  ];
  f.save.mockResolvedValue({ error: null });
  f.saved = false;
});
it('shows source scope, actual reference and advisory subject guidance without hiding the roadmap', () => {
  show();
  expect(screen.getByRole('heading', { name: 'Reference occupations' })).toBeVisible();
  expect(screen.getAllByText(/Software Developers/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Useful preparation, not programme entry requirements/)).toBeVisible();
  expect(screen.getByText('Check current route').closest('details')).toBeNull();
  expect(screen.getAllByRole('link', { name: /Software Developers/ })[0]).toHaveAttribute(
    'rel',
    'noopener noreferrer'
  );
});
it('withholds unreviewed descriptions and acknowledges unavailable guidance', () => {
  f.career.content_review.status = 'pending';
  f.career.description = 'Unsupported legacy guarantee';
  show();
  expect(screen.queryByText('Unsupported legacy guarantee')).not.toBeInTheDocument();
  expect(screen.getByText(/Content review pending/)).toBeVisible();
});
it('asks for an education level instead of implying an SPM route', () => {
  f.level = null;
  f.stages = [];
  show();
  expect(screen.getByText(/Set your education level/)).toBeVisible();
});
it('reports a failed save instead of implying it worked', async () => {
  f.save.mockResolvedValue({ error: { message: 'Save interrupted' } });
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Save pathway' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Save interrupted'));
});
it('keeps source-access limitations visible', () => {
  f.career.content_review.status = 'limited';
  f.career.content_review.limitations = ['Specific registration mapping unavailable'];
  show();
  expect(screen.getAllByText('Specific registration mapping unavailable').length).toBeGreaterThan(
    0
  );
});
it('limits O*NET attribution to the occupational interest codes', () => {
  show();
  expect(
    screen.getByText(/O\*NET is used only for occupational RIASEC interest codes/)
  ).toBeVisible();
  expect(
    screen.queryByText(/Occupational summaries adapted by Nexus from O\*NET/)
  ).not.toBeInTheDocument();
});
it('does not turn malformed source URLs into actionable links', () => {
  f.career.content_review.sections.overview.sources[0].url = 'javascript:alert(1)';
  show();
  expect(screen.queryByText('Develops and tests software.')).not.toBeInTheDocument();
  for (const link of screen.getAllByRole('link')) {
    expect(link.getAttribute('href')).not.toMatch(/^javascript:/);
  }
});
it('labels a future effective source as upcoming rather than current', () => {
  f.career.content_review.sections.overview.sources[0].effective_on = '2099-01-01';
  show();
  expect(screen.getAllByText(/Upcoming · effective 1 Jan 2099/).length).toBeGreaterThan(0);
});
