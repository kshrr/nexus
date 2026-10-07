/**
 * The single place Edge Functions are invoked from (architecture.md §2 directory
 * notes: "no component calls `fetch` directly"). Function bodies land in later
 * phases; this module fixes the call convention and the error envelope now.
 *
 * Error envelope (architecture.md §15): success `{ data }`, failure
 * `{ error: { code, message } }`. Never surface a raw stack trace or SQL string.
 */
import { supabase } from '@/lib/supabase';

/**
 * @typedef {Object} ApiError
 * @property {string} code
 * @property {string} message
 *
 * @template T
 * @typedef {{ data: T | null, error: ApiError | null }} ApiResult
 */

/**
 * Invoke a Supabase Edge Function with the caller's JWT automatically attached
 * by the supabase-js client.
 *
 * @template T
 * @param {string} name  function name, e.g. 'score-riasec'
 * @param {Object} [body]
 * @returns {Promise<ApiResult<T>>}
 */
export async function invokeFunction(name, body = {}) {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) return { data: null, error: await normaliseFunctionError(error) };
    return { data: /** @type {T} */ (data?.data ?? data), error: null };
  } catch (err) {
    return { data: null, error: normaliseError(err) };
  }
}

/**
 * GET an Edge Function with query parameters.
 *
 * @template T
 * @param {string} name
 * @param {Record<string, string>} [params]
 * @returns {Promise<ApiResult<T>>}
 */
export async function getFunction(name, params = {}) {
  const query = new URLSearchParams(params).toString();
  const path = query ? `${name}?${query}` : name;
  try {
    const { data, error } = await supabase.functions.invoke(path, { method: 'GET' });
    if (error) return { data: null, error: await normaliseFunctionError(error) };
    return { data: /** @type {T} */ (data?.data ?? data), error: null };
  } catch (err) {
    return { data: null, error: normaliseError(err) };
  }
}

/**
 * Edge Functions answer with `{ error: { code, message } }` (§15). supabase-js
 * wraps a non-2xx response in a FunctionsHttpError whose body holds that
 * envelope, so unwrap it to surface the real code the UI branches on.
 * @param {any} error
 * @returns {Promise<ApiError>}
 */
export async function normaliseFunctionError(error) {
  try {
    const body = await error?.context?.json?.();
    if (body?.error?.code) {
      return {
        code: String(body.error.code),
        message: String(body.error.message ?? ''),
        // Operator-facing hint, rendered only in a development build.
        ...(body.error.detail ? { detail: String(body.error.detail) } : {}),
      };
    }
  } catch {
    /* not a JSON envelope — fall through */
  }
  return normaliseError(error);
}

/**
 * @param {unknown} err
 * @returns {ApiError}
 */
export function normaliseError(err) {
  if (err && typeof err === 'object') {
    const anyErr = /** @type {Record<string, unknown>} */ (err);
    const code =
      typeof anyErr.code === 'string'
        ? anyErr.code
        : typeof anyErr.name === 'string'
          ? anyErr.name
          : 'UNKNOWN';
    const message =
      typeof anyErr.message === 'string' && anyErr.message
        ? anyErr.message
        : 'Something went wrong. Please try again.';
    return { code, message };
  }
  return { code: 'UNKNOWN', message: 'Something went wrong. Please try again.' };
}

/**
 * Registry of Edge Functions defined in architecture.md §15. Keeps names in one
 * place so call sites cannot drift.
 */
export const FUNCTIONS = Object.freeze({
  SCORE_RIASEC: 'score-riasec',
  RECOMMEND: 'recommend',
  MATCH_SCHOLARSHIP: 'match-scholarship',
  CHAT: 'chat',
  TRIGGER_CRAWL: 'trigger-crawl',
  DELETE_ACCOUNT: 'delete-account',
});
