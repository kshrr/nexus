import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { JourneyDashboard } from './JourneyDashboard';
import { formatDate } from '@/lib/format';

const profile = {
  full_name: 'Aina Nur Farhana',
  email: 'aina@example.test',
  education_level: 'spm',
  career_goal: 'Software engineer',
  target_industry: 'Technology',
  created_at: '2026-09-18T08:00:00Z',
  profile_completed: true,
};
const user = { email: 'aina@example.test' };
function setup(props = {}) {
  return render(
    <MemoryRouter>
      <JourneyDashboard profile={profile} user={user} {...props} />
    </MemoryRouter>
  );
}

describe('Rail-ticket dashboard', () => {
  it('puts the stored profile on the ticket and offers profile editing', () => {
    setup();
    expect(screen.getByText(profile.full_name)).toBeInTheDocument();
    expect(screen.getByText(profile.email)).toBeInTheDocument();
    expect(screen.getByText(profile.career_goal)).toBeInTheDocument();
    expect(screen.getByText(profile.target_industry)).toBeInTheDocument();
    expect(screen.getByText(formatDate(profile.created_at))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /update passenger details/i })).toHaveAttribute(
      'href',
      '/profile'
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByRole('link', { name: 'Start my assessment' })).toHaveAttribute(
      'href',
      '/find-your-path/assessment'
    );
  });

  it('shows the actual Holland Code and sends an SPM student to academic results next', () => {
    setup({ riasec: { holland_code: 'ISA' } });
    expect(
      within(screen.getByRole('article', { name: 'Nexus Express' })).getByText('ISA')
    ).toBeInTheDocument();
    expect(screen.getByText('Investigative · Social · Artistic')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view my results/i })).toHaveAttribute(
      'href',
      '/find-your-path/results'
    );
    expect(screen.getByRole('link', { name: /add my results/i })).toHaveAttribute(
      'href',
      '/find-your-path/academic'
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('uses academic and recommendation completion to advance the departure', () => {
    const props = {
      riasec: { holland_code: 'ISA' },
      strengths: [{ name: 'Mathematics', strength: 'strong' }],
    };
    const view = setup(props);
    expect(screen.getByRole('link', { name: 'See my recommendations' })).toHaveAttribute(
      'href',
      '/recommendations'
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
    view.rerender(
      <MemoryRouter>
        <JourneyDashboard
          profile={profile}
          user={user}
          {...props}
          careers={[{ target_id: 'career-1' }]}
          courses={[{ target_id: 'course-1' }]}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Browse scholarships' })).toHaveAttribute(
      'href',
      '/scholarships'
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getAllByText('1 career · 1 course')).toHaveLength(2);
  });

  it('omits the SPM-only academic stop for pre-university students', () => {
    setup({
      profile: { ...profile, education_level: 'foundation' },
      riasec: { holland_code: 'SEC' },
    });
    expect(screen.queryByText('Your academics')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See my recommendations' })).toHaveAttribute(
      'href',
      '/recommendations'
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '2 of 3 foundations complete'
    );
    expect(screen.getByRole('link', { name: /02 \/ academic strengths/i })).toHaveAttribute(
      'href',
      '/find-your-path'
    );
  });

  it('labels unset passenger details without fabricating a code or destination', () => {
    setup({
      profile: {
        full_name: 'Sam',
        education_level: null,
        career_goal: null,
        target_industry: null,
        created_at: null,
      },
    });
    expect(
      within(screen.getByRole('article', { name: 'Nexus Express' })).getByText('Your possibilities')
    ).toBeInTheDocument();
    expect(screen.getByText('Date not available')).toBeInTheDocument();
    expect(screen.getByText('— — —')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /discover my interests/i })).toHaveAttribute(
      'href',
      '/find-your-path/assessment'
    );
  });

  it('keeps passenger details visible without reporting progress while queries load', () => {
    setup({ loading: true });
    expect(screen.getByText(profile.full_name)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Loading your journey' })).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Start my assessment' })).not.toBeInTheDocument();
  });

  it('does not treat a failed request as an incomplete assessment', () => {
    const retry = vi.fn();
    setup({
      errors: [
        { area: 'interest profile', error: { message: 'Unable to connect' }, reload: retry },
      ],
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to connect');
    expect(screen.getByText('Interest profile unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry interest profile/i })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Start my assessment' })).not.toBeInTheDocument();
  });
});
