/**
 * Supabase client singleton.
 *
 * The anon key is public by design — Row-Level Security is what protects data,
 * not key secrecy (architecture.md §14.1). No service-role key is ever used in
 * the browser.
 *
 * Session storage: `persistSession: true` is a deliberate, documented decision
 * (architecture.md §5.4 / D-33). True HTTP-only cookies need a server-side auth
 * proxy which is out of scope for the FYP; the compensating control is a strict
 * CSP plus React's default output escaping. The residual risk is stated in the
 * thesis.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/env';

/**
 * When Supabase is not yet configured we still need a non-null object so the
 * rest of the app can import it without guarding every call site. Calls will
 * reject with a clear message rather than throwing at import time.
 *
 * @type {import('@supabase/supabase-js').SupabaseClient}
 */
let client;

if (config.isConfigured) {
  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'nexus.auth',
    },
    global: {
      headers: { 'x-nexus-client': 'web' },
    },
  });
} else {
  const notConfigured = () =>
    Promise.reject(
      new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
    );

  // Minimal shape used by the auth foundation. Extend as real features land.
  client = /** @type {any} */ ({
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: notConfigured,
      signUp: notConfigured,
      signOut: async () => ({ error: null }),
      verifyOtp: notConfigured,
      resend: notConfigured,
      resetPasswordForEmail: notConfigured,
      updateUser: notConfigured,
    },
    from: () => ({
      select: notConfigured,
      insert: notConfigured,
      update: notConfigured,
      delete: notConfigured,
      upsert: notConfigured,
    }),
    rpc: notConfigured,
    functions: { invoke: notConfigured },
  });
}

export const supabase = client;
export default supabase;
