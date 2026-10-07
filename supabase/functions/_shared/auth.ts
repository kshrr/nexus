/**
 * Caller-scoped Supabase client — FR-SEC-05 / vulnerability V-02.
 *
 * Every database query an Edge Function makes runs under the CALLING USER'S JWT,
 * not the service role, so Row-Level Security still applies to server-side code.
 * A flaw in `user_id` handling therefore cannot expose another student's data.
 *
 * The service-role key is never read in this file, and no function in this
 * project except the crawler (which has no calling user) is permitted to use it.
 */
// @ts-expect-error — resolved by the Deno runtime at deploy time
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export interface CallerContext {
  client: SupabaseClient;
  userId: string;
}

/**
 * Extracts the bearer token, builds a caller-scoped client, and confirms the
 * token resolves to a user. Returns null when the caller is unauthenticated.
 */
export async function getCaller(req: Request): Promise<CallerContext | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;

  // @ts-expect-error — Deno global
  const url = Deno.env.get('SUPABASE_URL');
  // @ts-expect-error — Deno global
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return null;

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;

  return { client, userId: data.user.id };
}
