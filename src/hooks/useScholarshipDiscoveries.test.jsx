import { it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
const h = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: h }));
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
import {
  useScholarshipDiscoveries,
  useScholarshipDiscoverySettings,
  discoveryRunState,
} from './useScholarshipDiscoveries';
beforeEach(() => {
  vi.clearAllMocks();
  h.rpc.mockResolvedValue({ data: { items: [], total: 0, providers: [] }, error: null });
});
it('passes literal filters and exact pagination to the authorised RPC', async () => {
  const { result } = renderHook(() => useScholarshipDiscoveries({ search: '(MY), Inc.', page: 2 }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(h.rpc).toHaveBeenCalledWith('list_scholarship_discoveries', {
    p_tab: 'discover',
    p_search: '(MY), Inc.',
    p_provider: '',
    p_review_state: 'all',
    p_page: 2,
    p_page_size: 20,
  });
});
it('retains latest results when an earlier search resolves last', async () => {
  let firstResolve;
  h.rpc
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          firstResolve = resolve;
        })
    )
    .mockResolvedValueOnce({
      data: { items: [{ id: 'latest' }], total: 25, providers: [] },
      error: null,
    });
  const { result, rerender } = renderHook(({ search }) => useScholarshipDiscoveries({ search }), {
    initialProps: { search: 'first' },
  });
  rerender({ search: 'second' });
  await waitFor(() => expect(result.current.total).toBe(25));
  await act(async () =>
    firstResolve({ data: { items: [{ id: 'old' }], total: 1, providers: [] }, error: null })
  );
  expect(result.current.items).toEqual([{ id: 'latest' }]);
});
it('suppresses duplicate Add requests and returns the existing publication', async () => {
  const { result } = renderHook(() => useScholarshipDiscoveries());
  await waitFor(() => expect(result.current.loading).toBe(false));
  let resolve;
  h.rpc.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  let first, second;
  await act(async () => {
    first = result.current.publish({ id: 'candidate', revision: 2 });
    second = result.current.publish({ id: 'candidate', revision: 2 });
  });
  expect(
    h.rpc.mock.calls.filter(([name]) => name === 'publish_scholarship_discovery')
  ).toHaveLength(1);
  await act(async () => {
    resolve({ data: 'publication', error: null });
    await first;
    await second;
  });
  expect(await first).toEqual({ data: 'publication', error: null });
});
it('saves a revision-aware draft without publishing and exposes conflicts', async () => {
  const { result } = renderHook(() => useScholarshipDiscoveries());
  await waitFor(() => expect(result.current.loading).toBe(false));
  h.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'STALE_REVIEW' } });
  let response;
  await act(async () => {
    response = await result.current.saveReview(
      { id: 'candidate', revision: 3 },
      {
        record: { name: 'Edited' },
        criteria: [],
        officialSourceConfirmed: true,
        approvedApplicationUrl: null,
      }
    );
  });
  expect(response.error.code).toBe('STALE_REVIEW');
  expect(h.rpc).toHaveBeenCalledWith(
    'save_discovery_review',
    expect.objectContaining({ p_revision: 3, p_record: { name: 'Edited' } })
  );
  expect(h.rpc.mock.calls.some(([name]) => name === 'publish_scholarship_discovery')).toBe(false);
});
it('loads and saves query settings through authorised boundaries', async () => {
  const settings = { queries: ['scholarships {year}'], target_count: 20, region: 'Malaysia' };
  h.from.mockReturnValue({
    select: () => ({ single: async () => ({ data: settings, error: null }) }),
  });
  const { result } = renderHook(() => useScholarshipDiscoverySettings());
  await waitFor(() => expect(result.current.settings).toEqual(settings));
  h.rpc.mockResolvedValueOnce({ data: settings, error: null });
  await act(async () => {
    await result.current.save(settings);
  });
  expect(h.rpc).toHaveBeenCalledWith('save_scholarship_discovery_settings', {
    p_settings: settings,
  });
});

it('keeps unrelated runs queued and a delayed start distinct from completion', () => {
  const request = { request_id: 'mine', requested_at: '2026-10-07T00:00:00Z' };
  const start = Date.parse(request.requested_at);
  expect(discoveryRunState(request, { request_id: 'other', status: 'success' }, start + 1000)).toBe(
    'queued'
  );
  expect(discoveryRunState(request, null, start + 180000)).toBe('delayed');
  expect(
    discoveryRunState(request, { request_id: 'mine', status: 'running' }, start + 200000)
  ).toBe('running');
  expect(
    discoveryRunState(request, { request_id: 'mine', status: 'success' }, start + 200000)
  ).toBe('success');
});
