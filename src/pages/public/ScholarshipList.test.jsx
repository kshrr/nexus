import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import ScholarshipList from './ScholarshipList';

const data = vi.hoisted(() => ({ fetch: null, rows: [], authenticated: false, saveError: null }));
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  return {
    supabase: createClient('https://scholarships.test', 'test-public-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (...args) => data.fetch(...args) },
    }),
  };
});
vi.mock('@/context/useAuth', () => ({ useAuth: () => ({ isAuthenticated: data.authenticated }) }));
vi.mock('@/hooks/useScholarshipMatches', () => ({
  useScholarshipMatches: () => ({
    byId: () => null,
    loading: false,
    error: null,
  }),
}));
vi.mock('@/hooks/useSavedItems', () => ({
  useSavedItems: () => ({
    isSaved: () => false,
    loading: false,
    error: null,
    reload: () => {},
    toggle: async () => ({ error: data.saveError }),
  }),
}));
beforeEach(() => {
  data.authenticated = false;
  data.saveError = null;
  data.rows = [
    {
      id: 'engineering',
      name: 'Engineering Award',
      provider: 'Rail Foundation',
      funding_amount: 'Full tuition',
      field_of_study: ['Engineering'],
      education_levels: ['degree'],
      deadline: null,
      status: 'active',
    },
    {
      id: 'art',
      name: 'Art Award',
      provider: 'Creative Foundation',
      funding_amount: 'Partial tuition',
      field_of_study: ['Art'],
      education_levels: ['diploma'],
      deadline: null,
      status: 'active',
    },
  ];
  data.fetch = async (url) => {
    const params = new URL(url).searchParams;
    let rows = data.rows;
    if (params.has('field_of_study')) {
      const field = params.get('field_of_study').slice(4, -1);
      rows = rows.filter((row) => row.field_of_study.includes(field));
    }
    if (params.has('or')) {
      const term = params.get('or').split('%')[1].toLowerCase();
      rows = rows.filter((row) => `${row.name} ${row.provider}`.toLowerCase().includes(term));
    }
    return new Response(JSON.stringify(rows), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Range': `0-${rows.length - 1}/${rows.length}`,
      },
    });
  };
});
const show = () =>
  render(
    <MemoryRouter>
      <ScholarshipList />
    </MemoryRouter>
  );

it('shows real catalogue counts on the hero ticket and updates its scholarship count after search', async () => {
  show();
  const ticket = screen.getByRole('complementary', { name: 'Scholarship directory' });
  await waitFor(() =>
    expect(within(ticket).getByLabelText('Published scholarships')).toHaveTextContent('2')
  );
  expect(within(ticket).getByLabelText('Listed providers')).toHaveTextContent('2');
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Creative' } });
  await waitFor(() =>
    expect(within(ticket).getByLabelText('Matching scholarships')).toHaveTextContent('1')
  );
  expect(within(ticket).getByLabelText('Listed providers')).toHaveTextContent('2');
});

it('shows placeholders rather than fabricated counts while catalogue data is pending', () => {
  data.fetch = () => new Promise(() => {});
  show();
  const ticket = screen.getByRole('complementary', { name: 'Scholarship directory' });
  expect(within(ticket).getByLabelText('Published scholarships')).toHaveTextContent('—');
  expect(within(ticket).getByLabelText('Listed providers')).toHaveTextContent('—');
});

it('does not advertise a zero scholarship count when the catalogue request fails', async () => {
  data.fetch = async () =>
    new Response(JSON.stringify({ message: 'Catalogue unavailable' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  show();
  await screen.findByText('We couldn’t load the scholarships');
  const ticket = screen.getByRole('complementary', { name: 'Scholarship directory' });
  expect(within(ticket).getByLabelText('Published scholarships')).toHaveTextContent('—');
  expect(within(ticket).getByLabelText('Listed providers')).toHaveTextContent('—');
});

it('keeps search and field filtering connected to the catalogue', async () => {
  show();
  await screen.findByRole('heading', { name: 'Engineering Award' });
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Creative' } });
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Engineering Award' })).not.toBeInTheDocument()
  );
  expect(screen.getByRole('heading', { name: 'Art Award' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: '' } });
  await screen.findByRole('heading', { name: 'Engineering Award' });
  fireEvent.click(screen.getByLabelText('Engineering'));
  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Art Award' })).not.toBeInTheDocument()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(await screen.findByRole('heading', { name: 'Art Award' })).toBeInTheDocument();
});

it('closes mobile filters with Escape and returns focus to the trigger', async () => {
  show();
  await screen.findByRole('heading', { name: 'Art Award' });
  const trigger = screen.getByRole('button', { name: 'Filters' });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Filters' });
  expect(within(dialog).getByRole('button', { name: 'Close filters' })).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('reports failed saving from a catalogue card', async () => {
  data.authenticated = true;
  data.saveError = { message: 'Please try again' };
  show();
  await screen.findByRole('heading', { name: 'Art Award' });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Please try again'));
});
