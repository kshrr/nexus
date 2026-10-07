import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EligibilityChecklist } from './EligibilityChecklist';
import { DeadlineBadge } from './DeadlineBadge';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

const CRITERIA = [
  { id: 'c1', label: 'Malaysian citizen', is_checkable: true },
  { id: 'c2', label: 'SPM leaver', is_checkable: true },
  { id: 'c3', label: 'Minimum B average', is_checkable: true },
  { id: 'c4', label: 'Leadership experience', is_checkable: false },
];

const MATCH = {
  satisfied_count: 1,
  checkable_count: 2,
  checklist: [
    {
      criterion_id: 'c1',
      criterion_type: 'citizenship',
      label: 'Malaysian citizen',
      status: 'unknown',
      hint: "Nexus can't check this. See the provider's page.",
    },
    {
      criterion_id: 'c2',
      criterion_type: 'education_level',
      label: 'SPM leaver',
      status: 'satisfied',
      hint: null,
    },
    {
      criterion_id: 'c3',
      criterion_type: 'min_grade',
      label: 'Minimum B average',
      status: 'unsatisfied',
      hint: "You haven't added any exam results yet.",
    },
    {
      criterion_id: 'c4',
      criterion_type: 'other',
      label: 'Leadership experience',
      status: 'unknown',
      hint: "Nexus can't check this. See the provider's page.",
    },
  ],
};

describe('EligibilityChecklist — the three states (FR10 / AC-31 / AC-32)', () => {
  it('renders satisfied, unsatisfied and unknown distinctly', () => {
    wrap(<EligibilityChecklist criteria={CRITERIA} match={MATCH} authenticated />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(within(items[1]).getByText('Met:')).toBeInTheDocument();
    expect(within(items[2]).getByText('Not met:')).toBeInTheDocument();
    expect(within(items[3]).getByText('Cannot be checked:')).toBeInTheDocument();
  });

  it('NEVER renders an unverifiable criterion as a failure (AC-32)', () => {
    wrap(<EligibilityChecklist criteria={CRITERIA} match={MATCH} authenticated />);
    const leadership = screen
      .getAllByRole('listitem')
      .find((li) => li.textContent?.includes('Leadership experience'));
    expect(within(leadership).queryByText('Not met:')).not.toBeInTheDocument();
    expect(within(leadership).getByText('Cannot be checked:')).toBeInTheDocument();
    expect(leadership.textContent).toMatch(/provider/i);
  });

  it('counts only the criteria it could actually check', () => {
    wrap(<EligibilityChecklist criteria={CRITERIA} match={MATCH} authenticated />);
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });

  it('explains an unsatisfied criterion rather than just failing it', () => {
    wrap(<EligibilityChecklist criteria={CRITERIA} match={MATCH} authenticated />);
    expect(screen.getByText(/haven't added any exam results/i)).toBeInTheDocument();
  });

  it('always tells the student to confirm with the provider', () => {
    wrap(<EligibilityChecklist criteria={CRITERIA} match={MATCH} authenticated />);
    expect(screen.getByText(/confirm the conditions on the provider/i)).toBeInTheDocument();
  });

  it('gates the checklist behind sign-in for an anonymous visitor (AC-33)', () => {
    wrap(<EligibilityChecklist criteria={CRITERIA} match={null} authenticated={false} />);
    expect(screen.getByText(/sign in to see which/i)).toBeInTheDocument();
    expect(screen.queryByText('Met:')).not.toBeInTheDocument();
    // the requirements themselves are still listed, just not evaluated
    expect(screen.getByText('Leadership experience')).toBeInTheDocument();
  });

  it('shows a loading state while matching', () => {
    wrap(<EligibilityChecklist criteria={CRITERIA} match={null} authenticated loading />);
    expect(screen.getByText(/checking your profile/i)).toBeInTheDocument();
  });

  it('degrades to a plain requirement list if matching fails', () => {
    wrap(
      <EligibilityChecklist
        criteria={CRITERIA}
        match={null}
        authenticated
        error={{ message: 'boom' }}
      />
    );
    expect(screen.getByText(/couldn’t check your eligibility/i)).toBeInTheDocument();
    expect(screen.getByText('Malaysian citizen')).toBeInTheDocument();
  });

  it('says so honestly when no criteria have been recorded', () => {
    wrap(<EligibilityChecklist criteria={[]} match={null} authenticated />);
    expect(screen.getByText(/no eligibility requirements have been recorded/i)).toBeInTheDocument();
  });

  it('handles a scholarship where nothing at all is checkable', () => {
    wrap(
      <EligibilityChecklist
        criteria={[CRITERIA[3]]}
        match={{ satisfied_count: 0, checkable_count: 0, checklist: [MATCH.checklist[3]] }}
        authenticated
      />
    );
    expect(screen.getByText(/none of these requirements can be checked/i)).toBeInTheDocument();
  });
});

describe('DeadlineBadge — §3.4.2 thresholds (AC-30)', () => {
  const iso = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    // Keep the instant so parsing preserves the intended local calendar day.
    return d.toISOString();
  };

  it('flags 7 days as critical', () => {
    render(<DeadlineBadge deadline={iso(7)} />);
    expect(screen.getByText('Closes in 7 days')).toBeInTheDocument();
  });

  it('flags 30 days as a warning', () => {
    render(<DeadlineBadge deadline={iso(30)} />);
    expect(screen.getByText('Closes in 30 days')).toBeInTheDocument();
  });

  it('does not flag 31 days — it shows the plain date', () => {
    render(<DeadlineBadge deadline={iso(31)} />);
    expect(screen.queryByText(/closes in/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Closes \d/)).toBeInTheDocument();
  });

  it('labels a missing deadline as a rolling intake, never as urgent', () => {
    render(<DeadlineBadge deadline={null} />);
    expect(screen.getByText('Rolling intake')).toBeInTheDocument();
  });

  it('shows a past deadline as closed rather than critical', () => {
    render(<DeadlineBadge deadline={iso(-3)} />);
    expect(screen.getByText(/^Closed /)).toBeInTheDocument();
  });

  it('marks an expired record as closed', () => {
    render(<DeadlineBadge deadline={iso(10)} expired />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('carries text in every state, never colour alone', () => {
    const { container } = render(<DeadlineBadge deadline={iso(2)} />);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
  });
});

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
