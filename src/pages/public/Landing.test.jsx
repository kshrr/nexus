import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Landing } from './Landing';

const catalogue = vi.hoisted(() => ({ result: null }));
let observedSections = [];
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => catalogue.result }) }),
    }),
  },
}));

beforeEach(() => {
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

describe('Landing opening journey', () => {
  it('introduces students and their common decisions before the feature showcase', async () => {
    showLanding();
    expect(
      screen.getByRole('img', { name: /students exploring their futures/i })
    ).toBeInTheDocument();
    const challenges = screen.getByRole('region', { name: /so many choices/i });
    expect(within(challenges).getByText(/which path fits me/i)).toBeInTheDocument();
    expect(within(challenges).getByText(/where can i study/i)).toBeInTheDocument();
    expect(within(challenges).getByText(/how can i afford it/i)).toBeInTheDocument();
    await screen.findByText('Universiti Putra Malaysia');
  });

  it('updates the laptop preview as the next feature enters the reading area', async () => {
    showLanding();
    const journey = screen.getByRole('region', { name: /explore nexus features/i });
    const preview = within(journey).getByRole('region', { name: /nexus feature preview/i });
    expect(within(preview).getByText(/discover what drives you/i)).toBeInTheDocument();

    const academics = within(journey)
      .getByRole('heading', { name: /connect your strengths/i })
      .closest('article');
    const observer = observedSections.find((item) => item.targets.includes(academics));
    expect(observer).toBeDefined();
    act(() =>
      observer.callback([{ target: academics, isIntersecting: true, intersectionRatio: 1 }])
    );

    expect(within(preview).getByText(/see your academic picture/i)).toBeInTheDocument();
    expect(within(preview).queryByText(/discover what drives you/i)).not.toBeInTheDocument();
    await screen.findByText('Universiti Putra Malaysia');
  });
});

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
