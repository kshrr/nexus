import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JourneyLayout } from './JourneyLayout';
import AcademicAnalysis from '@/pages/student/AcademicAnalysis';
import { useState } from 'react';

const server = vi.hoisted(() => ({ result: null, strengths: [], clearedDraft: false }));
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/context/useAuth', () => {
  const account = { user: { id: 'student-1' }, profile: { education_level: 'spm' } };
  return { useAuth: () => account };
});
vi.mock('@/hooks/useSubjects', () => ({
  useSubjects: () => ({
    subjects: [{ code: 'MAT', name: 'Mathematics', domain: 'science' }],
    loading: false,
    error: null,
  }),
}));
vi.mock('@/hooks/useAcademicResults', () => ({
  useAcademicResults: () => {
    const [selectedCodes, setSelectedCodes] = useState(server.clearedDraft ? [] : ['MAT']);
    const [grades, setGrades] = useState(
      server.clearedDraft ? {} : { MAT: { form4_final: 'A', spm_trial: 'A', spm_actual: 'A' } }
    );
    return {
      selectedCodes,
      grades,
      loading: false,
      setSelectedCodes,
      setGrades,
      reload: vi.fn(),
    };
  },
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    saving: false,
    replaceGrades: async (grades) => {
      server.strengths =
        grades.length === 0
          ? []
          : [
              {
                subject_code: 'MAT',
                strength: 'strong',
                average_points: 8,
                exam_count: 3,
                subjects: { name: 'Mathematics', domain: 'science' },
              },
            ];
      return { error: null };
    },
  }),
}));
// Keep data hooks real; replace only their database transport.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table) => ({
      select: () => ({
        eq: () =>
          table === 'riasec_results'
            ? { maybeSingle: async () => ({ data: server.result, error: null }) }
            : Promise.resolve({ data: server.strengths, error: null }),
      }),
    }),
  },
}));
beforeEach(() => {
  // JSDOM has no layout observer; chart sizing is outside this save-state test.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  server.result = null;
  server.strengths = [];
  server.clearedDraft = false;
});
afterEach(() => vi.unstubAllGlobals());

it('refreshes completion after returning from an assessment that saved a new result', async () => {
  render(
    <MemoryRouter initialEntries={['/find-your-path/assessment']}>
      <JourneyLayout>
        <Link to="/find-your-path/results">Finish journey step</Link>
      </JourneyLayout>
    </MemoryRouter>
  );
  const map = screen.getByRole('navigation', { name: 'Find your path route' });
  await waitFor(() =>
    expect(within(map).getByRole('link', { name: /RIASEC test/i })).toHaveTextContent('Not started')
  );
  server.result = {
    user_id: 'student-1',
    holland_code: 'IAS',
    completed_at: '2026-10-11T00:00:00Z',
    realistic_score: 5,
    investigative_score: 22,
    artistic_score: 18,
    social_score: 16,
    enterprising_score: 10,
    conventional_score: 12,
  };
  fireEvent.click(screen.getByRole('link', { name: 'Finish journey step' }));
  await waitFor(() =>
    expect(within(map).getByRole('link', { name: /RIASEC test/i })).toHaveTextContent('Completed')
  );
  expect(within(map).getByRole('link', { name: /Nexus recommendations/i })).toHaveAttribute(
    'href',
    '/recommendations'
  );
});

it('updates the academic map stop immediately after saving grades on the same page', async () => {
  render(
    <MemoryRouter initialEntries={['/find-your-path/academic']}>
      <JourneyLayout>
        <AcademicAnalysis />
      </JourneyLayout>
    </MemoryRouter>
  );
  const map = screen.getByRole('navigation', { name: 'Find your path route' });
  await waitFor(() =>
    expect(within(map).getByRole('link', { name: /Academic analysis/i })).toHaveTextContent(
      'Not started'
    )
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Save results' }));
  await waitFor(() =>
    expect(within(map).getByRole('link', { name: /Academic analysis/i })).toHaveTextContent(
      'Completed'
    )
  );
  expect(within(map).getByRole('link', { name: /Academic analysis/i })).toHaveAttribute(
    'aria-current',
    'page'
  );
});

it('removes academic completion after saving an empty grade draft', async () => {
  server.strengths = [
    {
      subject_code: 'MAT',
      strength: 'strong',
      average_points: 8,
      exam_count: 3,
      subjects: { name: 'Mathematics', domain: 'science' },
    },
  ];
  server.clearedDraft = true;
  render(
    <MemoryRouter initialEntries={['/find-your-path/academic']}>
      <JourneyLayout>
        <AcademicAnalysis />
      </JourneyLayout>
    </MemoryRouter>
  );
  const map = screen.getByRole('navigation', { name: 'Find your path route' });
  await waitFor(() =>
    expect(within(map).getByRole('link', { name: /Academic analysis/i })).toHaveTextContent(
      'Completed'
    )
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Save results' }));
  await waitFor(() =>
    expect(within(map).getByRole('link', { name: /Academic analysis/i })).toHaveTextContent(
      'Not started'
    )
  );
});

it('preserves unsaved grade edits while switching academic tabs', async () => {
  render(
    <MemoryRouter initialEntries={['/find-your-path/academic']}>
      <JourneyLayout>
        <AcademicAnalysis />
      </JourneyLayout>
    </MemoryRouter>
  );
  const grade = await screen.findByRole('combobox', { name: 'Mathematics — Form 4 Final' });
  fireEvent.change(grade, { target: { value: 'B' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Subject strengths' }));
  expect(screen.getByRole('tabpanel', { name: 'Subject strengths' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Enter results' }));
  expect(screen.getByRole('combobox', { name: 'Mathematics — Form 4 Final' })).toHaveValue('B');
});
