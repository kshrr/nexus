import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EligibilityReadiness } from './EligibilityReadiness';
import { eligibilityInputs } from '@/lib/eligibilityInputs';

describe('scholarship check inputs', () => {
  it('marks each answer as added or missing', () => {
    const items = eligibilityInputs({
      nationality: 'malaysian',
      educationLevel: 'spm',
      careerGoal: '  ',
      targetIndustry: '',
      birthYear: 2008,
      householdIncomeBand: null,
      gradeCount: 0,
    });
    expect(Object.fromEntries(items.map((item) => [item.id, item.done]))).toEqual({
      citizenship: true,
      age: true,
      income: false,
      education: true,
      field: false,
      results: false,
    });
  });

  it('counts a career goal or an industry as the field, and any grade as results', () => {
    const items = eligibilityInputs({ targetIndustry: 'Technology', gradeCount: 3 });
    expect(items.find((item) => item.id === 'field').done).toBe(true);
    expect(items.find((item) => item.id === 'results').done).toBe(true);
  });
});

describe('EligibilityReadiness', () => {
  it('lists what is missing and lets the student jump to add it', () => {
    const onAdd = vi.fn();
    render(<EligibilityReadiness answers={{ educationLevel: 'spm' }} onAdd={onAdd} />);
    expect(screen.getByText(/1 of 6 ready/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    expect(onAdd).toHaveBeenCalledWith('scholarships');
  });

  it('shows no Add buttons when nothing can be navigated to', () => {
    render(<EligibilityReadiness answers={{}} />);
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
  });
});
