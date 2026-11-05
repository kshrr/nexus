import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const fixture = vi.hoisted(() => ({
  user: { id: 'student-1' },
  read: vi.fn(),
}));

vi.mock('@/context/useAuth', () => ({ useAuth: () => ({ user: fixture.user }) }));
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: fixture.read }) }) }),
  },
}));

import { useRiasecResult } from './useRiasec';

describe('interest profile recovery', () => {
  it('clears the previous load error when a retry succeeds', async () => {
    fixture.read
      .mockResolvedValueOnce({ data: null, error: { message: 'Connection interrupted' } })
      .mockResolvedValueOnce({ data: { user_id: 'student-1', holland_code: 'ISA' }, error: null });

    const { result } = renderHook(() => useRiasecResult());
    await waitFor(() => expect(result.current.error?.message).toBe('Connection interrupted'));

    await act(async () => result.current.reload());

    expect(result.current.result?.holland_code).toBe('ISA');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
