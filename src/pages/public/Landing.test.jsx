import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Landing } from './Landing';

const catalogue = vi.hoisted(() => ({ result: null }));
const counts = vi.hoisted(() => ({
  courses: 487,
  universities: 10,
  scholarships: 26,
  careers: 20,
}));
let observedSections = [];
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table) => ({
      select: (_columns, options) =>
        options?.head
          ? { eq: async () => ({ count: counts[table] ?? 0 }) }
          : { eq: () => ({ order: async () => catalogue.result }) },
    }),
  },
}));

beforeEach(() => {
  window.scrollTo = vi.fn();
  observedSections = [];
  catalogue.result = {
    data: [
      { id: 'upm', name: 'Universiti Putra Malaysia', type: 'public', state: 'Selangor' },
      { id: 'ums', name: 'Universiti Malaysia Sabah', type: 'public', state: 'Sabah' },
      { id: 'um', name: 'Universiti Malaya', type: 'public', state: 'Kuala Lumpur' },
    ],
    error: null,
  };
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback) {
        this.callback = callback;
        this.targets = [];
        observedSections.push(this);
      }
      observe(target) {
        this.targets.push(target);
      }
      unobserve() {}
      disconnect() {}
    }
  );
});

describe('Landing station page', () => {
  it('opens with the promise, the departure board and the university logos', async () => {
    showLanding();
    expect(
      screen.getByRole('heading', { level: 1, name: /work out what comes after/i })
    ).toBeInTheDocument();
    const board = screen.getByRole('region', { name: /nexus departures/i });
    for (const name of ['Interests', 'Academics', 'Courses', 'Careers', 'Scholarships']) {
      expect(within(board).getByRole('link', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
    const logos = screen.getByRole('region', { name: /universities on nexus/i });
    expect(within(logos).getAllByRole('img', { name: /universiti malaya/i })).toHaveLength(1);
    await explorerHas('Universiti Putra Malaysia');
  });

  it('shows live catalogue numbers and a slider of platform features', async () => {
    showLanding();
    const numbers = screen.getByRole('region', { name: /nexus in numbers/i });
    expect(await within(numbers).findByText('487')).toBeInTheDocument();
    expect(within(numbers).getByText('26')).toBeInTheDocument();
    expect(within(numbers).getByText('36')).toBeInTheDocument();
    const slider = screen.getByRole('region', { name: /platform features/i });
    expect(within(slider).getByRole('heading', { name: /ask nexus/i })).toBeInTheDocument();
    expect(within(slider).getByRole('heading', { name: /private/i })).toBeInTheDocument();
    expect(screen.queryByText(/compare courses/i)).not.toBeInTheDocument();
    await explorerHas('Universiti Putra Malaysia');
  });

  it('shows the product on a laptop and changes screen when a step is chosen', async () => {
    showLanding();
    const how = screen.getByRole('region', { name: /six steps/i });
    const preview = within(how).getByRole('region', { name: /nexus preview/i });
    expect(within(preview).getByText(/create your account/i)).toBeInTheDocument();
    fireEvent.click(within(how).getByRole('button', { name: /discover your interests/i }));
    expect(within(preview).getByText(/your interest profile/i)).toBeInTheDocument();
    expect(within(preview).getByRole('img', { name: /interest radar chart/i })).toBeInTheDocument();
    expect(within(how).getByRole('link', { name: /find my interests/i })).toHaveAttribute(
      'href',
      '/find-your-path/assessment'
    );
    await explorerHas('Universiti Putra Malaysia');
  });
});

function explorerHas(name) {
  const explorer = screen.getByRole('region', { name: /a place for your next chapter/i });
  return within(explorer).findByText(name);
}

function showLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );
}

describe('Landing university explorer', () => {
  it('keeps the explorer usable when a catalogue entry has no state', async () => {
    catalogue.result.data.push({
      id: 'unknown',
      name: 'Unassigned campus',
      type: 'public',
      state: null,
    });
    showLanding();
    const explorer = screen.getByRole('region', { name: /a place for your next chapter/i });
    expect(await within(explorer).findByText('Universiti Putra Malaysia')).toBeInTheDocument();
    expect(within(explorer).queryByText('Unassigned campus')).not.toBeInTheDocument();
    fireEvent.change(within(explorer).getByRole('combobox'), { target: { value: 'Sabah' } });
    expect(within(explorer).getByText('Universiti Malaysia Sabah')).toBeInTheDocument();
  });

  it('updates the university list when a visitor selects a state on the map', async () => {
    showLanding();
    const explorer = screen.getByRole('region', { name: /a place for your next chapter/i });
    expect(await within(explorer).findByText('Universiti Putra Malaysia')).toBeInTheDocument();
    fireEvent.click(within(explorer).getByRole('button', { name: 'Sabah', exact: true }));
    expect(within(explorer).getByText('Universiti Malaysia Sabah')).toBeInTheDocument();
    expect(within(explorer).queryByText('Universiti Putra Malaysia')).not.toBeInTheDocument();
    expect(within(explorer).getByRole('combobox')).toHaveValue('Sabah');
  });

  it('starts with a full-width map and links each university to its filtered courses', async () => {
    showLanding();
    const explorer = screen.getByRole('region', { name: /a place for your next chapter/i });
    await within(explorer).findByText('Universiti Putra Malaysia');
    const layout = explorer.querySelector('.st-map-layout');
    expect(layout).not.toHaveClass('is-open');
    fireEvent.click(within(explorer).getByRole('button', { name: 'Selangor', exact: true }));
    expect(layout).toHaveClass('is-open');
    expect(
      within(explorer).getByRole('link', { name: /universiti putra malaysia/i })
    ).toHaveAttribute('href', '/courses?university=upm');
  });

  it('supports the state selector and catalogue names without a federal territory prefix', async () => {
    showLanding();
    const explorer = screen.getByRole('region', { name: /a place for your next chapter/i });
    await within(explorer).findByText('Universiti Putra Malaysia');
    fireEvent.change(within(explorer).getByRole('combobox'), {
      target: { value: 'W.P. Kuala Lumpur' },
    });
    expect(within(explorer).getByText('Universiti Malaya')).toBeInTheDocument();
    expect(
      within(explorer).getByRole('button', { name: 'Kuala Lumpur', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('distinguishes an empty state from a catalogue request failure and lets visitors retry', async () => {
    catalogue.result = { data: null, error: { message: 'Offline' } };
    showLanding();
    const explorer = screen.getByRole('region', { name: /a place for your next chapter/i });
    expect(await within(explorer).findByRole('alert')).toHaveTextContent(/couldn.t load/i);
    catalogue.result = { data: [], error: null };
    fireEvent.click(within(explorer).getByRole('button', { name: /try again/i }));
    expect(
      await within(explorer).findByText(/no universities listed in nexus for this state yet/i)
    ).toBeInTheDocument();
    expect(within(explorer).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lets keyboard users select a state with Enter or Space', async () => {
    showLanding();
    const explorer = screen.getByRole('region', { name: /a place for your next chapter/i });
    await within(explorer).findByText('Universiti Putra Malaysia');
    const sabah = within(explorer).getByRole('button', { name: 'Sabah', exact: true });
    fireEvent.keyDown(sabah, { key: 'Enter' });
    expect(within(explorer).getByText('Universiti Malaysia Sabah')).toBeInTheDocument();
    fireEvent.keyDown(within(explorer).getByRole('button', { name: 'Selangor', exact: true }), {
      key: ' ',
    });
    expect(within(explorer).getByText('Universiti Putra Malaysia')).toBeInTheDocument();
  });
});
