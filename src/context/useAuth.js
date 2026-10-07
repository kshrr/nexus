import { createContext, useContext } from 'react';

/**
 * Auth context object + consumer hook, kept in a non-component module so the
 * provider file can stay fast-refresh friendly.
 *
 * @type {React.Context<(import('@/types').AuthState & import('./AuthContext').AuthActions) | null>}
 */
export const AuthContext = createContext(null);

/** @returns {import('@/types').AuthState & import('./AuthContext').AuthActions} */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
