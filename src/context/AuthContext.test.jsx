import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => {
  const state = { cb: null };
  const profileRow = {
    id: 'user-1',
    full_name: 'Student A',
    email: 'a@test.nexus',
    role: 'student',
    profile_completed: true,
  };
  const maybeSingle = vi.fn(async () => ({ data: profileRow, error: null }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn((cb) => {
      state.cb = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(async () => ({ error: null })),
    verifyOtp: vi.fn(async () => ({ error: null })),
    resend: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  return { state, profileRow, maybeSingle, eq, select, auth };
});

vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: h.auth, from: vi.fn(() => ({ select: h.select })) },
}));

import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
const SESSION = { user: { id: 'user-1', email: 'a@test.nexus' } };

beforeEach(() => {
  vi.clearAllMocks();
  h.state.cb = null;
  h.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  h.maybeSingle.mockResolvedValue({ data: h.profileRow, error: null });
});

describe('AuthProvider — session bootstrap', () => {
  it('resolves to an anonymous state when there is no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it('loads the profile row and exposes the role for an active session', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    await waitFor(() => expect(result.current.profile?.full_name).toBe('Student A'));
    expect(result.current.role).toBe('student');
    expect(h.select).toHaveBeenCalled();
    expect(h.eq).toHaveBeenCalledWith('id', 'user-1');
  });
});

describe('AuthProvider — actions', () => {
  it('signIn delegates to supabase and reports success', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let res;
    await act(async () => {
      res = await result.current.signIn('a@test.nexus', 'nexus2026');
    });
    expect(h.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@test.nexus',
      password: 'nexus2026',
    });
    expect(res.error).toBeNull();
  });

  it('signIn surfaces a normalised error on failure', async () => {
    h.auth.signInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let res;
    await act(async () => {
      res = await result.current.signIn('a@test.nexus', 'wrong');
    });
    expect(res.error).toMatchObject({ message: expect.any(String) });
  });

  it('signUp sends full name + consent metadata (FR-SEC-10) and never a session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signUp({
        email: 'new@test.nexus',
        password: 'nexus2026',
        fullName: 'New Student',
        consentVersion: '2026-01-01',
      });
    });
    const payload = h.auth.signUp.mock.calls[0][0];
    expect(payload.email).toBe('new@test.nexus');
    expect(payload.options.data.full_name).toBe('New Student');
    expect(payload.options.data.consent_version).toBe('2026-01-01');
    expect(payload.options.data.consent_at).toBeTruthy();
  });

  it('signOut clears the cached profile', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    await act(async () => {
      await result.current.signOut();
    });
    expect(h.auth.signOut).toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
  });

  it('updatePassword delegates to supabase.auth.updateUser', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.updatePassword('brandnew123');
    });
    expect(h.auth.updateUser).toHaveBeenCalledWith({ password: 'brandnew123' });
  });
});

describe('AuthProvider — reacts to auth-state changes (expired / revoked session)', () => {
  it('a SIGNED_OUT event drops the session and profile', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    await act(async () => {
      h.state.cb('SIGNED_OUT', null);
    });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(result.current.profile).toBeNull();
  });

  it('a PASSWORD_RECOVERY event enters recovery mode', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      h.state.cb('PASSWORD_RECOVERY', SESSION);
    });
    await waitFor(() => expect(result.current.recoveryMode).toBe(true));
  });
});
