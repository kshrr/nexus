import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { ScholarshipCard } from './ScholarshipCard';

const scholarship = {
  id: 'rail-fund',
  name: 'Future Engineers Scholarship',
  provider: 'Example Foundation',
  description: 'Full programme explanation belongs on the details page.',
  funding_amount: 'Tuition and living allowance',
  deadline: null,
  status: 'active',
  education_levels: ['degree', 'diploma'],
  field_of_study: ['Engineering', 'Computing', 'Science', 'Design'],
};
const show = (props = {}) =>
  render(
    <MemoryRouter>
      <ScholarshipCard scholarship={scholarship} {...props} />
    </MemoryRouter>
  );

it('bounds category previews and keeps a route to the full information', () => {
  show();
  expect(screen.getByText('+3 more')).toBeInTheDocument();
  expect(screen.queryByText('Design')).not.toBeInTheDocument();
  expect(screen.queryByText(scholarship.description)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute(
    'href',
    '/scholarships/rail-fund'
  );
  expect(screen.getByText('Rolling intake')).toBeInTheDocument();
});

it('shows a concise checked-requirement count without claiming eligibility', () => {
  show({ authenticated: true, match: { satisfied_count: 2, checkable_count: 4 } });
  expect(screen.getByText('2/4 checked requirements met')).toBeInTheDocument();
  expect(screen.queryByText(/you qualify/i)).not.toBeInTheDocument();
});

it('exposes bookmark state and prevents saving while pending', () => {
  const toggle = vi.fn();
  show({ authenticated: true, saved: true, onToggleSave: toggle, saveDisabled: true });
  const button = screen.getByRole('button', { name: /saved/i });
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(toggle).not.toHaveBeenCalled();
});
