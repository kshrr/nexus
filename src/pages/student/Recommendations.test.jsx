import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Recommendations from './Recommendations';

const data = vi.hoisted(() => ({
  careers: [],
  courses: [],
  result: { holland_code: 'IAS' },
  matchError: null,
}));
const download = vi.hoisted(() => ({ input: null, filename: null }));
vi.mock('@/lib/counselorSummary', () => ({
  createCounselorSummaryPdf: (input) => {
    download.input = input;
    return {
      save: (filename) => {
        download.filename = filename;
      },
    };
  },
}));
vi.mock('@/hooks/useRecommendations', () => ({
  useRecommendations: () => ({
    careers: data.careers,
    courses: data.courses,
    secondaryCareers: [],
    degradedMode: false,
    generatedAt: '2026-10-11T00:00:00Z',
    loading: false,
    generating: false,
    error: null,
    regenerate: vi.fn(),
    hasResults: data.careers.length > 0 || data.courses.length > 0,
  }),
}));
vi.mock('@/hooks/useRiasec', () => ({
  useRiasecResult: () => ({ result: data.result, loading: false, error: null }),
}));
vi.mock('@/hooks/useSubjectStrengths', () => ({
  useSubjectStrengths: () => ({ strengths: [], loading: false, error: null }),
}));
vi.mock('@/hooks/useAcademicResults', () => ({
  useAcademicResults: () => ({
    grades: { MATH: { form4_final: 'B', spm_trial: 'A-' } },
    loading: false,
    error: null,
  }),
}));
vi.mock('@/hooks/useSubjects', () => ({
  useSubjects: () => ({ subjects: [{ code: 'MATH', name: 'Mathematics' }], loading: false }),
}));
vi.mock('@/hooks/useScholarships', () => ({
  useScholarships: () => ({
    items: [
      {
        id: 'award-1',
        name: 'Student award',
        provider: 'Foundation',
        education_levels: ['spm'],
        field_of_study: ['Science'],
        funding_amount: 'Tuition support',
        deadline: null,
        status: 'active',
        application_link: 'https://example.test/apply',
      },
    ],
    total: 1,
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
    reload: vi.fn(),
  }),
}));
vi.mock('@/hooks/useScholarshipMatches', () => ({
  useScholarshipMatches: () => ({
    loading: false,
    error: data.matchError,
    reload: vi.fn(),
    byId: () => ({
      scholarship_id: 'award-1',
      eligibility_score: 75,
      satisfied_count: 3,
      checkable_count: 4,
    }),
  }),
}));
vi.mock('@/hooks/useSavedItems', () => ({
  useSavedItems: () => ({
    isSaved: () => false,
    toggle: vi.fn().mockResolvedValue({ error: null }),
    loading: false,
    error: null,
  }),
}));
vi.mock('@/context/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, profile: { education_level: 'spm' } }),
}));
beforeEach(() => {
  download.input = null;
  download.filename = null;
  data.result = { holland_code: 'IAS' };
  data.matchError = null;
  data.careers = Array.from({ length: 6 }, (_, i) => ({
    target_id: `career-${i + 1}`,
    match_score: 90 - i,
    rule_id: `rule-${i + 1}`,
    reasons: [
      { condition: 'riasec_letter', satisfied: true, text: 'Investigative interest' },
      { condition: 'subject_strength', satisfied: false, text: 'Maths strength not met' },
    ],
    detail: {
      id: `career-${i + 1}`,
      slug: `career-${i + 1}`,
      name: `Career ${i + 1}`,
      field: 'Science',
      description: 'A career to explore.',
      riasec_profile: 'IAS',
    },
  }));
  data.courses = [
    {
      target_id: 'course-1',
      match_score: 80,
      rule_id: 'rule-1',
      reasons: [],
      detail: {
        id: 'course-1',
        name: 'Science degree',
        field_of_study: 'Science',
        pathway_type: 'degree',
        university_name: 'University',
        duration_months: 36,
        entry_requirements: 'Check official requirements.',
      },
    },
  ];
});
const show = () =>
  render(
    <MemoryRouter>
      <Recommendations />
    </MemoryRouter>
  );

it('shows one recommendation category at a time and preserves each category page', () => {
  show();
  expect(screen.getAllByRole('article')).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByRole('heading', { name: 'Career 5' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Career 1' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /Courses/i }));
  expect(screen.getByRole('heading', { name: 'Science degree' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Career 5' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /Careers/i }));
  expect(screen.getByRole('heading', { name: 'Career 5' })).toBeInTheDocument();
});
it('keeps exact unmet reasons available in each compact recommendation card', () => {
  show();
  const card = screen.getAllByRole('article')[0];
  const disclosure = within(card).getByText('Why this match').closest('details');
  fireEvent.click(within(disclosure).getByText('Why this match'));
  expect(disclosure.open).toBe(true);
  expect(within(disclosure).getByText('Maths strength not met')).toBeVisible();
  expect(within(disclosure).getByText('rule-1')).toBeInTheDocument();
});
it('shows scholarship eligibility separately from career-match scoring', () => {
  show();
  fireEvent.click(screen.getByRole('tab', { name: /Scholarships/i }));
  expect(screen.getByRole('heading', { name: 'Student award' })).toBeInTheDocument();
  expect(screen.getByText('3/4 checked requirements met')).toBeInTheDocument();
  expect(screen.queryByText('Match 75%')).not.toBeInTheDocument();
});
it('does not present a matching failure as an empty list of eligible scholarships', () => {
  data.matchError = { message: 'Matching unavailable' };
  show();
  fireEvent.click(screen.getByRole('tab', { name: /Scholarships/i }));
  expect(screen.getByText('Matching unavailable')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Student award' })).not.toBeInTheDocument();
});
it('connects every destination tab to an existing panel through aria-controls', () => {
  show();
  for (const tab of screen.getAllByRole('tab')) {
    expect(document.getElementById(tab.getAttribute('aria-controls'))).toBeInTheDocument();
  }
});
it('downloads the current results and all recommendation rows for the counselor', async () => {
  show();
  const button = screen.getByRole('button', { name: 'Download counselor summary' });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  await waitFor(() => expect(download.filename).toBe('nexus-counselor-summary.pdf'));
  expect(download.input.riasec.holland_code).toBe('IAS');
  expect(download.input.careers).toHaveLength(6);
  expect(download.input.courses).toHaveLength(1);
  expect(download.input.academicGrades.MATH.spm_trial).toBe('A-');
  expect(download.input.subjects[0].name).toBe('Mathematics');
});
