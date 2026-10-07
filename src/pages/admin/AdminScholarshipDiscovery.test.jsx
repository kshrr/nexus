import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  invoke: vi.fn(),
  items: [],
  run: null,
}));
vi.mock('@/lib/supabase', () => ({ supabase: h }));
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/api', async (original) => ({ ...(await original()), invokeFunction: h.invoke }));
import AdminScholarshipDiscovery from './AdminScholarshipDiscovery';
beforeEach(() => {
  vi.clearAllMocks();
  h.run = null;
  h.items = Array.from({ length: 25 }, (_, i) => ({
    id: 'candidate-' + i,
    revision: 1,
    name: 'Programme ' + i,
    provider: 'Bright Foundation',
    canonical_url: 'https://bright.example/' + i,
    extracted_record: {
      name: 'Programme ' + i,
      provider: 'Bright Foundation',
      description: 'Scholarship for Malaysian school leavers.',
      education_levels: ['spm'],
      field_of_study: [],
      status: 'active',
      deadline: null,
      source_url: 'https://bright.example/' + i,
      application_link: null,
    },
    extracted_criteria: [],
    evidence: { official_source: true },
    review_reasons: [],
    review_state: 'ready',
    last_checked_at: null,
    scholarship_id: null,
    monitoring_enabled: false,
  }));
  h.rpc.mockImplementation(async (name, args) => {
    if (name === 'list_scholarship_discoveries') {
      const items = h.items
        .filter((item) => (args.p_tab === 'added' ? item.scholarship_id : !item.scholarship_id))
        .filter((item) => !args.p_search || item.name.includes(args.p_search));
      return {
        data: {
          items: items.slice((args.p_page - 1) * args.p_page_size, args.p_page * args.p_page_size),
          total: items.length,
          providers: ['Bright Foundation'],
        },
        error: null,
      };
    }
    if (name === 'publish_scholarship_discovery') {
      const item = h.items.find((i) => i.id === args.p_id);
      item.scholarship_id = 'publication';
      item.monitoring_enabled = true;
      return { data: 'publication', error: null };
    }
    if (name === 'set_discovery_ignored') {
      h.items.find((i) => i.id === args.p_id).review_state = 'ignored';
      return { data: null, error: null };
    }
    if (name === 'set_discovery_monitoring') {
      h.items.find((i) => i.id === args.p_id).monitoring_enabled = args.p_enabled;
      return { data: null, error: null };
    }
    if (name === 'save_discovery_review') {
      const item = h.items.find((i) => i.id === args.p_id);
      item.draft_record = args.p_record;
      item.review_state = 'ready';
      item.revision++;
      return { data: { ...item }, error: null };
    }
    if (name === 'approve_scholarship_discovery_changes') {
      h.items.find((item) => item.id === args.p_id).pending_review = false;
      return { data: 'publication', error: null };
    }
    return { data: null, error: null };
  });
  h.from.mockImplementation((_table) => {
    const query = {
      filterStatus: null,
      select() {
        return this;
      },
      eq(key, value) {
        if (key === 'status') this.filterStatus = value;
        return this;
      },
      gt() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      async maybeSingle() {
        return {
          data: this.filterStatus && h.run?.status !== this.filterStatus ? null : h.run,
          error: null,
        };
      },
      async single() {
        if (_table === 'scholarship_discoveries') return { data: h.items[0], error: null };
        return {
          data: { queries: ['Malaysia scholarships {year}'], region: 'Malaysia', target_count: 20 },
          error: null,
        };
      },
    };
    return query;
  });
  h.invoke.mockResolvedValue({
    data: {
      dispatched: true,
      request_id: 'request',
      requested_at: new Date().toISOString(),
      mode: 'discovery',
    },
    error: null,
  });
});
const mount = () =>
  render(
    <MemoryRouter>
      <AdminScholarshipDiscovery />
    </MemoryRouter>
  );
it('shows real totals and 20+5 pagination', async () => {
  mount();
  await screen.findByText('25 scholarships');
  expect(screen.getAllByRole('button', { name: 'Add to Nexus' })).toHaveLength(20);
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Add to Nexus' })).toHaveLength(5)
  );
});
it('adds one programme and exposes monitoring in Added to Nexus', async () => {
  mount();
  await screen.findByText('25 scholarships');
  await userEvent.click(screen.getAllByRole('button', { name: 'Add to Nexus' })[0]);
  await screen.findByText('Scholarship added to Nexus.');
  await userEvent.click(screen.getByRole('tab', { name: 'Added to Nexus' }));
  await screen.findByRole('button', { name: 'Stop monitoring' });
  expect(screen.getByText('Deadline unknown')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Stop monitoring' }));
  await screen.findByRole('button', { name: 'Resume monitoring' });
});
it('reviews incomplete details with evidence and retains the corrected draft', async () => {
  h.items = [{ ...h.items[0], review_state: 'needs_review', review_reasons: ['Confirm provider'] }];
  mount();
  await screen.findByText('1 scholarship');
  expect(screen.queryByRole('button', { name: 'Add to Nexus' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Review details' }));
  const dialog = screen.getByRole('dialog');
  const input = within(dialog).getByLabelText(/Provider/);
  await userEvent.clear(input);
  await userEvent.type(input, 'Correct Foundation');
  await userEvent.click(within(dialog).getByRole('checkbox', { name: /official source/i }));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save review' }));
  await screen.findByText('Review saved.');
  expect(h.items[0].draft_record.provider).toBe('Correct Foundation');
  expect(h.items[0].scholarship_id).toBeNull();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Review details' })).toHaveFocus();
});
it('keeps a dispatched request queued and distinguishes correlated completion', async () => {
  mount();
  await screen.findByText('25 scholarships');
  await userEvent.click(screen.getByRole('button', { name: 'Refresh from web' }));
  await screen.findByText('Refresh queued.');
  expect(h.invoke).toHaveBeenCalledWith('trigger-crawl', { mode: 'discovery' });
  expect(screen.queryByText('Refresh finished.')).not.toBeInTheDocument();
});
it('shows missing-key failures honestly instead of fabricated results', async () => {
  h.run = {
    id: 'run',
    request_id: 'request',
    status: 'failed',
    error_message: 'Configure BRAVE_SEARCH_API_KEY',
    candidates_created: 0,
  };
  mount();
  await screen.findByText('25 scholarships');
  await userEvent.click(screen.getByRole('button', { name: 'Refresh from web' }));
  await screen.findByText('Configure BRAVE_SEARCH_API_KEY');
  expect(screen.queryByText('Refresh finished.')).not.toBeInTheDocument();
});
it('shows honest empty state and query settings', async () => {
  h.items = [];
  mount();
  await screen.findByText('No discoveries yet');
  await userEvent.click(screen.getByRole('button', { name: 'Search settings' }));
  expect(await screen.findByLabelText('Search queries')).toHaveValue(
    'Malaysia scholarships {year}'
  );
  fireEvent.change(screen.getByLabelText('Search queries'), {
    target: { value: 'one\ntwo\nthree\nfour\nfive\nsix\nseven' },
  });
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(screen.getByRole('alert')).toHaveTextContent('between one and six');
  expect(h.rpc.mock.calls.some(([name]) => name === 'save_scholarship_discovery_settings')).toBe(
    false
  );
});

it('allows comma-separated fields and protects corrected eligibility wording', async () => {
  h.items = [
    {
      ...h.items[0],
      extracted_criteria: [
        {
          criterion_type: 'min_grade',
          operator: 'gte',
          value: 6,
          label: 'At least six As',
          is_checkable: true,
        },
      ],
    },
  ];
  mount();
  await screen.findByText('1 scholarship');
  await userEvent.click(screen.getByRole('button', { name: 'Review details' }));
  const dialog = screen.getByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('Study fields'), 'Engineering, Medicine');
  expect(within(dialog).getByLabelText('Study fields')).toHaveValue('Engineering, Medicine');
  const condition = within(dialog).getByLabelText('Condition 1');
  await userEvent.clear(condition);
  await userEvent.type(condition, 'At least five As');
  await userEvent.click(within(dialog).getByRole('checkbox', { name: /official source/i }));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save review' }));
  await screen.findByText('Review saved.');
  const payload = h.rpc.mock.calls.find(([name]) => name === 'save_discovery_review')[1];
  expect(payload.p_criteria[0]).toMatchObject({
    criterion_type: 'other',
    is_checkable: false,
    value: 'At least five As',
  });
  expect(payload.p_record.field_of_study).toEqual(['Engineering', 'Medicine']);
});

it('opens fresh provider snapshots instead of stale full saved drafts', async () => {
  const original = h.items[0].extracted_record;
  h.items = [
    {
      ...h.items[0],
      extracted_record: { ...original, deadline: '2031-04-30' },
      draft_record: { ...original, deadline: '2028-04-30', provider: 'Correct Foundation' },
      review_overrides: { provider: 'Correct Foundation' },
      criteria_overridden: false,
      extracted_criteria: [
        {
          criterion_type: 'other',
          operator: 'eq',
          value: 'New condition',
          label: 'New condition',
          is_checkable: false,
        },
      ],
      draft_criteria: [
        {
          criterion_type: 'other',
          operator: 'eq',
          value: 'Old condition',
          label: 'Old condition',
          is_checkable: false,
        },
      ],
    },
  ];
  mount();
  await screen.findByText('1 scholarship');
  await userEvent.click(screen.getByRole('button', { name: 'Review details' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByLabelText('Closing date')).toHaveValue('2031-04-30');
  expect(within(dialog).getByLabelText('Condition 1')).toHaveValue('New condition');
});

it('requires an explicit approval action for pending published changes', async () => {
  h.items = [
    {
      ...h.items[0],
      scholarship_id: 'publication',
      pending_review: true,
      official_source_confirmed: true,
      review_overrides: { description: 'Pending correction' },
    },
  ];
  mount();
  await screen.findByText('0 scholarships');
  await userEvent.click(screen.getByRole('tab', { name: 'Added to Nexus' }));
  await screen.findByText('1 scholarship');
  await userEvent.click(screen.getByRole('button', { name: 'Review details' }));
  await userEvent.click(screen.getByRole('button', { name: 'Approve updates' }));
  await screen.findByText('Changes approved.');
  expect(h.rpc).toHaveBeenCalledWith('approve_scholarship_discovery_changes', {
    p_id: 'candidate-0',
    p_revision: 1,
  });
  expect(h.rpc.mock.calls.some(([name]) => name === 'publish_scholarship_discovery')).toBe(false);
});

it('reloads fresh details after a stale review conflict', async () => {
  h.items = [h.items[0]];
  const implementation = h.rpc.getMockImplementation();
  h.rpc.mockImplementation((name, args) =>
    name === 'save_discovery_review'
      ? Promise.resolve({ data: null, error: { code: 'P0001', message: 'STALE_REVIEW' } })
      : implementation(name, args)
  );
  mount();
  await screen.findByText('1 scholarship');
  await userEvent.click(screen.getByRole('button', { name: 'Review details' }));
  await userEvent.click(screen.getByRole('checkbox', { name: /official source/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Save review' }));
  await screen.findByText('This candidate changed. Reload its details before saving.');
  h.items[0] = {
    ...h.items[0],
    revision: 9,
    extracted_record: { ...h.items[0].extracted_record, deadline: '2032-05-20' },
  };
  await userEvent.click(screen.getByRole('button', { name: 'Reload latest details' }));
  await screen.findByText('Latest details loaded.');
  expect(screen.getByLabelText('Closing date')).toHaveValue('2032-05-20');
});
