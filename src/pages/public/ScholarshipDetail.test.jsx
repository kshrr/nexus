import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import ScholarshipDetail from './ScholarshipDetail';

const data = vi.hoisted(() => ({ authenticated: true, record: null, saveError: null, documents: [] }));
vi.mock('@/context/useAuth', () => ({ useAuth: () => ({ isAuthenticated: data.authenticated }) }));
vi.mock('@/hooks/useScholarships', () => ({
  useScholarship: () => ({
    scholarship: data.record,
    criteria: [{ id: 'grade', label: 'Minimum grade B', is_checkable: true }],
    documents: data.documents,
    loading: false,
    error: null,
    reload: () => {},
  }),
}));
vi.mock('@/hooks/useScholarshipMatches', () => ({
  useScholarshipMatches: () => ({
    byId: () => ({
      satisfied_count: 0,
      checkable_count: 1,
      checklist: [{ criterion_id: 'grade', label: 'Minimum grade B', status: 'unknown' }],
    }),
    loading: false,
    error: null,
  }),
}));
vi.mock('@/hooks/useSavedItems', () => ({
  useSavedItems: () => ({
    isSaved: () => false,
    loading: false,
    error: null,
    toggle: async () => ({ error: data.saveError }),
  }),
}));
beforeEach(() => {
  data.authenticated = true;
  data.saveError = null;
  data.documents = [];
  data.record = {
    id: 'rail-fund',
    name: 'Future Engineers Scholarship',
    provider: 'Example Foundation',
    status: 'active',
    deadline: null,
    description: 'Full programme description with important conditions.',
    funding_amount: 'Tuition and living allowance',
    education_levels: ['degree'],
    field_of_study: ['Engineering'],
    application_link: 'https://provider.example/apply',
    source_url: 'https://provider.example/scholarship',
  };
});
const show = () =>
  render(
    <MemoryRouter initialEntries={['/scholarships/rail-fund']}>
      <Routes>
        <Route path="/scholarships/:id" element={<ScholarshipDetail />} />
      </Routes>
    </MemoryRouter>
  );

it('reveals full information in separate overview, eligibility and applying panels', () => {
  show();
  expect(screen.getByRole('tabpanel', { name: 'Overview' })).toHaveTextContent(
    data.record.description
  );
  expect(screen.queryByRole('link', { name: /apply on/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Eligibility' }));
  expect(screen.getByRole('tabpanel', { name: 'Eligibility' })).toHaveTextContent(
    'Cannot be checked:'
  );
  expect(screen.queryByText(data.record.description)).not.toBeVisible();
  fireEvent.click(screen.getByRole('tab', { name: 'Applying' }));
  const apply = within(screen.getByRole('tabpanel', { name: 'Applying' })).getByRole('link', {
    name: /apply on provider.example/i,
  });
  expect(apply).toHaveAttribute('href', 'https://provider.example/apply');
  expect(apply).toHaveAttribute('rel', 'noopener noreferrer');
  expect(
    within(screen.getByRole('tabpanel', { name: 'Applying' })).getByText('Rolling intake')
  ).toBeInTheDocument();
});

it('supports keyboard tab selection with correctly linked panels', () => {
  show();
  const overview = screen.getByRole('tab', { name: 'Overview' });
  overview.focus();
  fireEvent.keyDown(overview, { key: 'ArrowRight' });
  const eligibility = screen.getByRole('tab', { name: 'Eligibility' });
  expect(eligibility).toHaveFocus();
  expect(eligibility).toHaveAttribute('aria-selected', 'true');
  for (const tab of screen.getAllByRole('tab')) {
    expect(document.getElementById(tab.getAttribute('aria-controls'))).toHaveAttribute(
      'aria-labelledby',
      tab.id
    );
  }
});

it('keeps closed-round warnings visible regardless of the selected tab', () => {
  data.record = { ...data.record, status: 'expired', deadline: '2025-01-01' };
  show();
  fireEvent.click(screen.getByRole('tab', { name: 'Eligibility' }));
  expect(screen.getByText('This round has closed.')).toBeVisible();
  expect(screen.getByText('Closed')).toBeVisible();
});

it('keeps public requirements available without pretending to check an anonymous profile', () => {
  data.authenticated = false;
  show();
  fireEvent.click(screen.getByRole('tab', { name: 'Eligibility' }));
  expect(screen.getByText('Minimum grade B')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
});

it('reports an unsuccessful bookmark action instead of silently ignoring it', async () => {
  data.saveError = { message: 'Connection unavailable' };
  show();
  fireEvent.click(screen.getByRole('button', { name: /save this/i }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Connection unavailable')
  );
});

it('links official requirement PDFs from the eligibility panel, opening in a new tab', () => {
  data.documents = [
    {
      label: 'Universiti-universiti yang diluluskan (PDF)',
      url: 'https://www.bnm.gov.my/documents/20124/1514833/Approved_Universities_for_Academic_Year_2026.pdf',
    },
  ];
  show();
  fireEvent.click(screen.getByRole('tab', { name: 'Eligibility' }));
  const panel = screen.getByRole('tabpanel', { name: 'Eligibility' });
  expect(within(panel).getByText('Requirement documents')).toBeInTheDocument();
  const link = within(panel).getByRole('link', { name: /universiti-universiti yang diluluskan/i });
  expect(link).toHaveAttribute('href', data.documents[0].url);
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(link).toHaveTextContent('www.bnm.gov.my');
  expect(link).toHaveAccessibleName(/opens in a new tab/i);
});

it('shows no requirement documents block when there are none', () => {
  show();
  fireEvent.click(screen.getByRole('tab', { name: 'Eligibility' }));
  expect(screen.queryByText('Requirement documents')).not.toBeInTheDocument();
});
