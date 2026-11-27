import { supabase } from '@/lib/supabase';
import { normaliseError } from '@/lib/api';

/** Everything Nexus stores for one student. Each read runs under the student's own session (RLS). */
const SOURCES = [
  { key: 'profile', table: 'profiles', column: 'id', single: true },
  { key: 'academic_results', table: 'academic_results', column: 'user_id' },
  { key: 'subject_strengths', table: 'subject_strengths', column: 'user_id' },
  { key: 'riasec_result', table: 'riasec_results', column: 'user_id', single: true },
  { key: 'riasec_responses', table: 'riasec_responses', column: 'user_id' },
  { key: 'recommendations', table: 'recommendations', column: 'user_id' },
  { key: 'saved_items', table: 'saved_items', column: 'user_id' },
  { key: 'chat_messages', table: 'chat_messages', column: 'user_id' },
  { key: 'consent_records', table: 'consent_records', column: 'user_id' },
];

/**
 * Collect a copy of the signed-in student's data.
 * @param {{ id: string, email?: string }} user
 * @returns {Promise<{ data: Record<string, unknown> | null, error: import('@/lib/api').ApiError | null }>}
 */
export async function collectMyData(user) {
  try {
    const entries = await Promise.all(
      SOURCES.map(async ({ key, table, column, single }) => {
        const { data, error } = await supabase.from(table).select('*').eq(column, user.id);
        if (error) throw error;
        return [key, single ? (data?.[0] ?? null) : (data ?? [])];
      })
    );
    return {
      data: {
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email ?? null },
        ...Object.fromEntries(entries),
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: normaliseError(err) };
  }
}

/** Save an object as a JSON file in the browser. */
export function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Permanently delete the signed-in student's account (database function, migration 0038). */
export async function deleteMyAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  return { error: error ? normaliseError(error) : null };
}
