import { it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
const h = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal()),
  invokeFunction: h.invoke,
}));
import { useTriggerCrawl } from './useAdminOps';
it('dispatches discovery and exposes queued correlation without completion', async () => {
  h.invoke.mockResolvedValue({
    data: { dispatched: true, request_id: 'request', mode: 'discovery' },
    error: null,
  });
  const { result } = renderHook(() => useTriggerCrawl());
  await act(async () => {
    await result.current.trigger('discovery');
  });
  expect(h.invoke).toHaveBeenCalledWith('trigger-crawl', { mode: 'discovery' });
  expect(result.current.result.request_id).toBe('request');
  expect(result.current.result.completed).toBeUndefined();
});
