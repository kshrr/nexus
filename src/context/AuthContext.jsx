/**
 * Authentication + session state (architecture.md §5).
 *
 * Owns the Supabase session, the current user, and their `profiles` row (role
 * lives there and is read by RLS server-side — §3.1). This context is UX state,
 * NOT a security boundary: every protected read/write is enforced by RLS in the
 * database regardless of what this holds.
 *
 * Session persistence (§5.4 / D-33): the Supabase client keeps the refresh token
 * in its default storage and auto-refreshes the access token. `onAuthStateChange`
 * keeps this context in step with SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED /
 * USER_UPDATED / PASSWORD_RECOVERY, so an expired or revoked session propagates
 * to the route guards on the next render.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { normaliseError } from '@/lib/api';
import { AuthContext } from './useAuth';

/**
 * @typedef {Object} AuthActions
 * @property {(email: string, password: string) => Promise<{ error: import('@/lib/api').ApiError | null }>} signIn
 * @property {(input: { email: string, password: string, fullName: string, consentVersion: string }) => Promise<{ error: import('@/lib/api').ApiError | null }>} signUp
 * @property {(email: string, token: string) => Promise<{ error: import('@/lib/api').ApiError | null }>} verifyOtp
 * @property {(email: string) => Promise<{ error: import('@/lib/api').ApiError | null }>} resendOtp
 * @property {(email: string) => Promise<{ error: import('@/lib/api').ApiError | null }>} requestPasswordReset
 * @property {(newPassword: string) => Promise<{ error: import('@/lib/api').ApiError | null }>} updatePassword
 * @property {() => Promise<void>} signOut
 * @property {() => Promise<void>} refreshProfile
 * @property {boolean} recoveryMode  true while a password-recovery link session is active
 */

/** @param {{ children: React.ReactNode }} props */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(
    /** @type {import('@supabase/supabase-js').Session | null} */ (null)
  );
  const [profile, setProfile] = useState(/** @type {import('@/types').Profile | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const mounted = useRef(true);

  const loadProfile = useCallback(async (userId) => {
    if (!config.isConfigured || !userId) {
      setProfile(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      if (mounted.current) setProfile(data ?? null);
    } catch (err) {
      // A missing table (pre-migration) or RLS denial must not crash the shell.
      if (import.meta.env.DEV)
        console.warn('[auth] profile load skipped:', normaliseError(err).message);
      if (mounted.current) setProfile(null);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted.current) return;
      setSession(data.session ?? null);
      await loadProfile(data.session?.user?.id);
      if (mounted.current) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted.current) return;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setRecoveryMode(false);
      } else {
        loadProfile(nextSession?.user?.id);
      }
    });

    return () => {
      mounted.current = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? normaliseError(error) : null };
  }, []);

  const signUp = useCallback(async ({ email, password, fullName, consentVersion }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          consent_version: consentVersion,
          consent_at: new Date().toISOString(),
        },
      },
    });
    return { error: error ? normaliseError(error) : null };
  }, []);

  const verifyOtp = useCallback(async (email, token) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    return { error: error ? normaliseError(error) : null };
  }, []);

  const resendOtp = useCallback(async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return { error: error ? normaliseError(error) : null };
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? normaliseError(error) : null };
  }, []);

  const updatePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setRecoveryMode(false);
    return { error: error ? normaliseError(error) : null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRecoveryMode(false);
  }, []);

  const refreshProfile = useCallback(() => loadProfile(session?.user?.id), [loadProfile, session]);

  const value = useMemo(() => {
    const user = session?.user ? { id: session.user.id, email: session.user.email } : null;
    return {
      session,
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      isAuthenticated: Boolean(session),
      recoveryMode,
      signIn,
      signUp,
      verifyOtp,
      resendOtp,
      requestPasswordReset,
      updatePassword,
      signOut,
      refreshProfile,
    };
  }, [
    session,
    profile,
    loading,
    recoveryMode,
    signIn,
    signUp,
    verifyOtp,
    resendOtp,
    requestPasswordReset,
    updatePassword,
    signOut,
    refreshProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
