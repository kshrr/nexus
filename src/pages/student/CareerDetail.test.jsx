import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { reviewedCareer, reviewedStage } from '@/test/fixtures/careerEvidence';
const f = vi.hoisted(() => ({
  career: null,
  stages: [],
  level: 'spm',
  authenticated: true,
  requestedLevel: vi.fn(),
  save: vi.fn(),
  saved: false,
  courses: [],
  scholarships: [],
}));
vi.mock('@/hooks/useCareers', () => ({
  useCareer: (_id, level) => {
    f.requestedLevel(level);
    return {
      career: f.career,
      stages: f.stages,
      courses: f.courses,
      scholarships: f.scholarships,
      loading: false,
      error: null,
      reload: () => {},
    };
  },
}));
vi.mock('@/context/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: f.authenticated,
    profile: f.authenticated ? { education_level: f.level } : null,
  }),
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
  f.authenticated = true;
  f.requestedLevel.mockClear();
  f.save.mockClear();
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
  f.courses = [];
  f.scholarships = [];
});
it('lets a visitor browse the detail and choose a starting level without saving', () => {
  f.authenticated = false;
  f.stages = [];
  show();
  expect(screen.getByRole('heading', { name: 'Career journey roadmap' })).toBeVisible();
  expect(screen.getByRole('link', { name: /Sign in to save pathway/ })).toHaveAttribute(
    'href',
    '/login'
  );
  expect(screen.queryByRole('button', { name: 'Save pathway' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Starting education level')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Starting education level'), {
    target: { value: 'stpm' },
  });
  expect(f.requestedLevel).toHaveBeenLastCalledWith('stpm');
  expect(f.save).not.toHaveBeenCalled();
});
it('shows source scope, actual reference and advisory subject guidance alongside the route map', () => {
  show();
  expect(screen.getByRole('heading', { name: 'Interest references' })).toBeInTheDocument();
  expect(screen.getAllByText(/Software Developers/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Useful preparation, not programme entry requirements/)).toBeVisible();
  expect(screen.getByRole('group', { name: 'Routes from SPM to Software Engineer' })).toBeVisible();
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
  expect(screen.getByText(/Choose your current education level/)).toBeVisible();
  expect(screen.queryByRole('group', { name: /Routes from/ })).not.toBeInTheDocument();
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
  ).toBeInTheDocument();
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
it('maps every SPM route to the career and lets the student compare them', () => {
  show();
  const map = screen.getByRole('group', { name: 'Routes from SPM to Software Engineer' });
  for (const name of [
    /Foundation in Science/,
    /Matriculation/,
    /STPM/,
    /Diploma in Computer Science/,
  ]) {
    expect(within(map).getByRole('button', { name })).toBeVisible();
  }
  expect(screen.getByText('routes to compare').previousElementSibling).toHaveTextContent('4');
  fireEvent.click(within(map).getByRole('button', { name: /Diploma in Computer Science/ }));
  expect(within(map).getByRole('button', { name: /Diploma in Computer Science/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(
    screen.getByRole('heading', {
      name: /SPM → Diploma in Computer Science or IT → Degree → Software Engineer/,
    })
  ).toBeVisible();
  expect(
    screen.getByText(/Credit transfer from your diploma may shorten the degree/)
  ).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Work after the diploma' })).toBeVisible();
});
it('shows a single straight route for a student already in STPM', () => {
  f.level = 'stpm';
  show();
  expect(
    screen.getByRole('group', { name: 'Routes from STPM to Software Engineer' })
  ).toBeVisible();
  expect(screen.getByText('route to follow').previousElementSibling).toHaveTextContent('1');
  expect(screen.getByText(/STPM \(where you are now\)/)).toBeVisible();
});

it('shows a short stage-by-stage roadmap ending in the career itself', () => {
  show();
  const roadmap = screen.getByRole('region', { name: 'Career journey roadmap' });
  expect(within(roadmap).getByText('4 stages')).toBeVisible();
  for (const name of [
    'SPM',
    'Choose a pre-university route',
    'Degree in Computer Science or Software Engineering',
    'Software Engineer',
  ]) {
    expect(within(roadmap).getByRole('heading', { name })).toBeVisible();
  }
  expect(within(roadmap).getByText('Mathematics')).toBeVisible();
  expect(within(roadmap).getByText('Evaluate user needs')).toBeVisible();
  expect(within(roadmap).getByText(/Diploma in Computer Science or IT/)).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Essential skills' })).toBeVisible();
});
it('keeps unreviewed duties and skills out of the roadmap and summary', () => {
  delete f.career.content_review.sections.responsibilities;
  delete f.career.content_review.sections.skills;
  show();
  expect(screen.queryByText('Evaluate user needs')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Essential skills' })).not.toBeInTheDocument();
});
it('lists matching courses and scholarships for the career', () => {
  f.courses = Array.from({ length: 8 }, (_, i) => ({
    id: `c${i}`,
    name: `Bachelor of Software Engineering ${i}`,
    pathway_type: i ? 'degree' : 'foundation',
    university_name: 'Universiti Malaya',
  }));
  f.scholarships = [
    { id: 's1', name: 'TNB SHINE', provider: 'YTN', openToAllFields: false },
    { id: 's2', name: 'BP40 Bursary', provider: 'Sabah', openToAllFields: true },
  ];
  show();
  const study = screen.getByRole('region', { name: 'Courses and scholarships' });
  expect(within(study).getByText('8 matching courses in the Nexus catalogue')).toBeVisible();
  // Six shown, the rest behind the catalogue link.
  expect(
    within(study).getAllByRole('link', { name: /Bachelor of Software Engineering/ })
  ).toHaveLength(6);
  expect(within(study).getByText('Foundation · Universiti Malaya')).toBeVisible();
  expect(within(study).getByRole('link', { name: /TNB SHINE/ })).toHaveAttribute(
    'href',
    '/scholarships/s1'
  );
  expect(within(study).getByText('Sabah · Any field of study')).toBeVisible();
  expect(within(study).getByText('Sorted for SPM')).toBeVisible();
});
it('says so when nothing matches yet', () => {
  show();
  const study = screen.getByRole('region', { name: 'Courses and scholarships' });
  expect(within(study).getByText('No matching courses in the catalogue yet.')).toBeVisible();
  expect(within(study).getByText('No related scholarships open right now.')).toBeVisible();
});
