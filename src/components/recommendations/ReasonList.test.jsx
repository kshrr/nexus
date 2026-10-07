import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReasonList } from './ReasonList';
import { CourseCard } from './CourseCard';
import { CareerCard } from './CareerCard';

const REASONS = [
  { condition: 'riasec_letter', satisfied: true, text: 'Investigative interests' },
  { condition: 'subject_strength', satisfied: true, text: 'Strong in Biology' },
  { condition: 'subject_strength', satisfied: false, text: 'Strong in Chemistry' },
  { condition: 'interest', satisfied: false, text: 'Interest in health sciences' },
];

describe('ReasonList — the transparency requirement (report §3.4.2)', () => {
  it('shows unsatisfied conditions rather than hiding them (ui-spec §3.9)', () => {
    render(<ReasonList reasons={REASONS} />);
    expect(screen.getByText('Strong in Chemistry')).toBeInTheDocument();
    expect(screen.getByText('Interest in health sciences')).toBeInTheDocument();
  });

  it('announces met / not met to assistive technology, not by colour alone', () => {
    render(<ReasonList reasons={REASONS} />);
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Met:')).toBeInTheDocument();
    expect(within(items[2]).getByText('Not met:')).toBeInTheDocument();
  });

  it('labels which signal each reason came from, so it is traceable', () => {
    render(<ReasonList reasons={REASONS} />);
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('interests')).toBeInTheDocument(); // RIASEC
    expect(within(items[1]).getByText('results')).toBeInTheDocument(); // academic
    expect(within(items[3]).getByText('goals')).toBeInTheDocument(); // stated interest
  });

  it('renders nothing when there are no reasons', () => {
    const { container } = render(<ReasonList reasons={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CourseCard — every field §3.4.2 requires (AC-22)', () => {
  const rec = {
    match_score: 85,
    rule_id: 'R-HEALTH-01',
    reasons: REASONS,
    detail: {
      name: 'Bachelor of Pharmacy',
      field_of_study: 'Pharmacy',
      university_name: 'Universiti Sains Malaysia',
      pathway_type: 'degree',
      duration_months: 48,
      entry_requirements: '5 credits including Biology and Chemistry',
    },
  };

  it('shows course name, university, pathway type, duration and entry requirements', () => {
    render(<CourseCard recommendation={rec} />);
    expect(screen.getByText('Bachelor of Pharmacy')).toBeInTheDocument();
    expect(screen.getByText(/Universiti Sains Malaysia/)).toBeInTheDocument();
    expect(screen.getByText(/Degree/)).toBeInTheDocument();
    expect(screen.getByText(/4 years/)).toBeInTheDocument();
    expect(screen.getByText(/5 credits including Biology and Chemistry/)).toBeInTheDocument();
  });

  it('shows the match as a plain number and names the rule that produced it', () => {
    render(<CourseCard recommendation={rec} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('R-HEALTH-01')).toBeInTheDocument();
    expect(document.querySelector('svg')).toBeNull(); // no gauge or ring
  });
});

describe('CareerCard', () => {
  it('renders the career with its reasons and rule id', () => {
    render(
      <MemoryRouter>
        <CareerCard
          recommendation={{
            match_score: 100,
            rule_id: 'R-HEALTH-01',
            reasons: REASONS,
            detail: {
              id: 'b0000000-0000-4000-8000-000000000002',
              name: 'Pharmacist',
              field: 'Healthcare',
              riasec_profile: 'ICR',
              description: 'Prepares and dispenses medicines.',
            },
          }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Pharmacist')).toBeInTheDocument();
    expect(screen.getByText(/Healthcare · ICR/)).toBeInTheDocument();
    expect(screen.getByText('R-HEALTH-01')).toBeInTheDocument();
    expect(screen.getByText('Investigative interests')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explore career pathway/i })).toHaveAttribute(
      'href',
      '/careers/b0000000-0000-4000-8000-000000000002'
    );
  });

  it('renders nothing when the catalog row is missing', () => {
    const { container } = render(
      <CareerCard recommendation={{ match_score: 50, rule_id: 'X', reasons: [], detail: null }} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
