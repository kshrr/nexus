import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { reviewedCareer } from '@/test/fixtures/careerEvidence';
const f = vi.hoisted(() => ({ rows: [] }));
vi.mock('@/hooks/useCareers', () => ({
  useCareers: ({ search, category }) => ({
    careers: f.rows.filter(
      (c) =>
        (category === 'All' || c.field === category) &&
        c.name.toLowerCase().includes(search.toLowerCase())
    ),
    loading: false,
    error: null,
    reload: () => {},
  }),
}));
import Careers from './Careers';
beforeEach(() => {
  const pending = reviewedCareer({
    overrides: {
      id: 'pending',
      name: 'Pending role',
      field: 'Unknown long category',
      description: 'Unsupported career promise',
    },
  });
  pending.content_review.status = 'pending';
  f.rows = [reviewedCareer(), pending];
});
it('keeps named category browsing and search while withholding pending guidance', () => {
  render(
    <MemoryRouter>
      <Careers />
    </MemoryRouter>
  );
  expect(screen.getByRole('heading', { name: 'Browse by theme' })).toBeVisible();
  expect(screen.queryByText('Unsupported career promise')).not.toBeInTheDocument();
  expect(screen.getByText(/Content review pending/)).toBeVisible();
  const theme = screen.getByRole('button', { name: 'Computing & Technology' });
  fireEvent.click(theme);
  expect(theme).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('heading', { name: 'Pending role' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search careers'), { target: { value: 'software' } });
  expect(screen.getByRole('link', { name: /Explore.*Software Engineer/ })).toHaveAttribute(
    'href',
    '/careers/software-engineer'
  );
});
it('clears search and theme after an empty result', () => {
  render(
    <MemoryRouter>
      <Careers />
    </MemoryRouter>
  );
  fireEvent.change(screen.getByLabelText('Search careers'), { target: { value: 'missing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }));
  expect(screen.getByLabelText('Search careers')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
});
