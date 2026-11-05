import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Recommendations from './Recommendations';

const server = vi.hoisted(() => ({
  generated: false,
  failGeneration: false,
  deferred: false,
  pending: [],
}));
vi.mock('@/context/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, profile: { education_level: 'spm' } }),
}));
vi.mock('@/hooks/useRiasec', () => ({
  useRiasecResult: () => ({ result: { holland_code: 'IAS' }, loading: false, error: null }),
}));
vi.mock('@/hooks/useSubjectStrengths', () => ({
  useSubjectStrengths: () => ({ strengths: [], loading: false, error: null }),
}));
vi.mock('@/hooks/useRecommendations', () => ({
  useRecommendations: () => ({
    careers: [],
    courses: [],
    secondaryCareers: [],
    degradedMode: false,
    generatedAt: null,
    loading: false,
    generating: false,
    error: null,
    hasResults: false,
    regenerate: async () => {
      if (server.failGeneration) return { error: { message: 'Generation failed' } };
      server.generated = true;
      return { error: null };
    },
  }),
}));
vi.mock('@/hooks/useScholarships', () => ({
  useScholarships: () => ({
    items: [
      {
        id: 'award-1',
        name: 'Science award',
        provider: 'Foundation',
        education_levels: ['spm'],
        field_of_study: ['Science'],
        deadline: null,
        status: 'active',
      },
    ],
    total: 1,
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    reload: vi.fn(),
  }),
}));
vi.mock('@/hooks/useSavedItems', () => ({
  useSavedItems: () => ({ isSaved: () => false, toggle: vi.fn(), loading: false, error: null }),
}));
// Keep scholarship matching state real; replace only its server transport.
vi.mock('@/lib/api', () => ({
  FUNCTIONS: { MATCH_SCHOLARSHIP: 'match-scholarship' },
  invokeFunction: async () =>
    server.deferred
      ? new Promise((resolve) => server.pending.push(resolve))
      : {
          data: {
            matches: [
              {
                scholarship_id: 'award-1',
                eligibility_score: server.generated ? 100 : 75,
                satisfied_count: server.generated ? 4 : 3,
                checkable_count: 4,
              },
            ],
          },
          error: null,
        },
}));
beforeEach(() => {
  server.generated = false;
  server.failGeneration = false;
  server.deferred = false;
  server.pending = [];
});

it('refreshes visible scholarship eligibility after successful recommendation generation', async () => {
  render(
    <MemoryRouter>
      <Recommendations />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('tab', { name: /Scholarships/i }));
  await waitFor(() => expect(screen.getByText('3/4 checked requirements met')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Generate', exact: true }));
  await waitFor(() => expect(screen.getByText('4/4 checked requirements met')).toBeInTheDocument());
});
it('keeps refreshed eligibility when an older pending request finishes last', async () => {
  server.deferred = true;
  render(
    <MemoryRouter>
      <Recommendations />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('tab', { name: /Scholarships/i }));
  await waitFor(() => expect(server.pending).toHaveLength(1));
  fireEvent.click(screen.getByRole('button', { name: 'Generate', exact: true }));
  await waitFor(() => expect(server.pending).toHaveLength(2));
  await act(async () =>
    server.pending[1]({
      data: {
        matches: [
          {
            scholarship_id: 'award-1',
            eligibility_score: 100,
            satisfied_count: 4,
            checkable_count: 4,
          },
        ],
      },
      error: null,
    })
  );
  expect(screen.getByText('4/4 checked requirements met')).toBeInTheDocument();
  await act(async () =>
    server.pending[0]({
      data: {
        matches: [
          {
            scholarship_id: 'award-1',
            eligibility_score: 75,
            satisfied_count: 3,
            checkable_count: 4,
          },
        ],
      },
      error: null,
    })
  );
  expect(screen.getByText('4/4 checked requirements met')).toBeInTheDocument();
  expect(screen.queryByText('3/4 checked requirements met')).not.toBeInTheDocument();
});
