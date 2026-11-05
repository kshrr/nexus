import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { useCourseSync } from './useCourseSync';
const fixture = vi.hoisted(() => ({
  catalogue: { items: [], total: 0 },
  run: null,
  error: null,
  pending: null,
  reads: 0,
  dispatch: null,
  queriedIds: [],
}));
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async (name, args) => {
      if (name === 'list_course_sync_runs') {
        fixture.queriedIds = args.p_request_ids;
        return {
          data: {
            latest: fixture.run ? [{ ...fixture.run, source: 'um' }] : [],
            correlated: fixture.run ? [{ ...fixture.run, source: 'um' }] : [],
          },
          error: fixture.error,
        };
      }
      fixture.reads += 1;
      return fixture.pending ?? { data: fixture.catalogue, error: fixture.error };
    },
    from: () => ({
      select: () => ({
        order: async () => ({
          data: [{ source: 'um', name: 'Universiti Malaya' }],
          error: fixture.error,
        }),
      }),
    }),
    functions: {
      invoke: async () => ({
        data: {
          data: fixture.dispatch ?? {
            dispatched: true,
            source: 'um',
            request_id: 'new-request',
            requested_at: '2026-10-10T00:00:00Z',
          },
        },
        error: null,
      }),
    },
  },
}));
beforeEach(() => {
  fixture.run = null;
  fixture.error = null;
  fixture.catalogue = { items: [], total: 0 };
  fixture.pending = null;
  fixture.reads = 0;
  fixture.dispatch = null;
  fixture.queriedIds = [];
});
afterEach(() => vi.useRealTimers());
it('keeps an accepted request correlated after its later batch dispatch fails', async () => {
  const { result } = renderHook(() => useCourseSync());
  await waitFor(() => expect(result.current.loading).toBe(false));
  const requested_at = new Date().toISOString();
  fixture.dispatch = {source:'um',dispatched:true,request_id:'accepted-um',requested_at};
  await act(async () => { await result.current.refresh('um'); });
  fixture.dispatch = {requests:[
    {source:'um',dispatched:false,error:{code:'ALREADY_RUNNING',message:'Already running'}},
    {source:'usim',dispatched:true,request_id:'accepted-usim',requested_at},
  ]};
  await act(async () => { await result.current.refresh('all'); });
  expect(result.current.requestsBySource.um.request_id).toBe('accepted-um');
  expect(result.current.requestsBySource.um.last_dispatch_error.message).toBe('Already running');
  await act(async () => { await result.current.reload(); });
  expect(fixture.queriedIds).toEqual(['accepted-um','accepted-usim']);
  expect(result.current.requestsBySource.um.request_id).toBe('accepted-um');
});
it('expires a queued request even when a later status read fails', async () => {
  const { result } = renderHook(() => useCourseSync());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.refresh();
  });
  fixture.error = { message: 'Status unavailable' };
  await act(async () => {
    await result.current.reload();
  });
  expect(result.current.queuedRequest.status).toBe('expired');
});
it('shows the actual source catalogue and latest run', async () => {
  fixture.catalogue = {
    items: [{ id: 'source-1', outcome: 'incomplete', issues: ['missing_entry_requirements'] }],
    total: 1,
  };
  fixture.run = { id: 'run-1', status: 'partial', inserted: 2, fetch_failed: 1 };
  const { result } = renderHook(() => useCourseSync());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.items[0].issues).toEqual(['missing_entry_requirements']);
  expect(result.current.lastRun.inserted).toBe(2);
});
it('keeps a refresh queued until its own correlated run completes', async () => {
  fixture.run = { id: 'old-run', request_id: 'old-request', status: 'completed' };
  const { result } = renderHook(() => useCourseSync());
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.queuedRequest.request_id).toBe('new-request');
  await act(async () => {
    await result.current.reload();
  });
  expect(result.current.queuedRequest.request_id).toBe('new-request');
  fixture.run = { id: 'new-run', request_id: 'new-request', status: 'completed' };
  await act(async () => {
    await result.current.reload();
  });
  expect(result.current.queuedRequest).toBeNull();
  expect(result.current.lastRun.id).toBe('new-run');
});
it('surfaces a failed catalogue read and supports retry', async () => {
  fixture.error = { message: 'Catalogue unavailable' };
  const { result } = renderHook(() => useCourseSync());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error.message).toBe('Catalogue unavailable');
  fixture.error = null;
  await act(async () => {
    await result.current.reload();
  });
  expect(result.current.error).toBeNull();
});
it('ignores an older catalogue response after a newer reload completes', async () => {
  const { result } = renderHook(() => useCourseSync());
  await waitFor(() => expect(result.current.loading).toBe(false));
  let resolveOlder, older;
  fixture.pending = new Promise((resolve) => {
    resolveOlder = resolve;
  });
  act(() => {
    older = result.current.reload();
  });
  fixture.pending = null;
  fixture.catalogue = { items: [{ id: 'current-source' }], total: 1 };
  await act(async () => {
    await result.current.reload();
  });
  await act(async () => {
    resolveOlder({ data: { items: [{ id: 'stale-source' }], total: 1 }, error: null });
    await older;
  });
  expect(result.current.items[0].id).toBe('current-source');
});
it('stops queued refresh polling when the admin screen unmounts', async () => {
  const { result, unmount } = renderHook(() => useCourseSync());
  await waitFor(() => expect(result.current.loading).toBe(false));
  vi.useFakeTimers();
  await act(async () => {
    await result.current.refresh();
  });
  const reads = fixture.reads;
  unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(fixture.reads).toBe(reads);
});
