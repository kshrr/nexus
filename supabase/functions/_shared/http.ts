/**
 * Shared HTTP plumbing for the Edge Functions.
 *
 * Response envelope (architecture.md §15): success `200 { data }`, failure
 * `4xx/5xx { error: { code, message } }`. A stack trace or SQL string must never
 * reach the client.
 */

/** Headers the browser always needs on the ACTUAL response. */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Default allow-list, used when a preflight arrives without
 * Access-Control-Request-Headers. `x-nexus-client` is the custom header the
 * browser client sets in src/lib/supabase.js.
 */
const DEFAULT_ALLOWED_HEADERS =
  'authorization, apikey, content-type, x-client-info, x-nexus-client, x-supabase-api-version';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export const ok = (data: unknown) => json({ data }, 200);

/**
 * `detail` is an OPERATOR-facing hint (an upstream status, a provider's own
 * error text) shown only in a development build — see ChatPanel. `message`
 * stays the exact user-facing wording the specification fixes, and a stack
 * trace or SQL string never appears in either (§15).
 *
 * Anything credential-shaped is redacted before it leaves the function.
 */
export const fail = (status: number, code: string, message: string, detail?: string) =>
  json({ error: { code, message, ...(detail ? { detail: redact(detail) } : {}) } }, status);

/** Strip anything key-shaped out of a diagnostic string before returning it. */
export function redact(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{30,}/g, '[redacted-key]')
    .replace(/\bAQ\.[A-Za-z0-9_-]{20,}/g, '[redacted-key]')
    .replace(/("?key"?\s*[:=]\s*)"?[A-Za-z0-9._-]{20,}"?/gi, '$1[redacted]')
    .slice(0, 300);
}

/**
 * CORS preflight. The requested headers are REFLECTED rather than matched
 * against a fixed list: the browser refuses to send the real request if any
 * header it asks for is missing from the reply, and supabase-js adds headers of
 * its own over time. Reflecting keeps this from silently breaking again.
 */
export const preflight = (req?: Request) =>
  new Response('ok', {
    headers: {
      ...corsHeaders,
      'Access-Control-Allow-Headers':
        req?.headers.get('Access-Control-Request-Headers') ?? DEFAULT_ALLOWED_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
  });

/** Generic 500 that never leaks internals. */
export function serverError(err: unknown): Response {
  console.error('[edge]', err);
  return fail(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
}
