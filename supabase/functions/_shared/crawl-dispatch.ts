import type { CallerContext } from './auth.ts';
import { fail, ok, preflight } from './http.ts';

export interface CrawlDispatchDependencies {
  getCaller: (req: Request) => Promise<CallerContext | null>;
  fetch: typeof fetch;
  now: () => Date;
  uuid: () => string;
  config: { token?: string; repo?: string; ref: string; workflow: string };
}

export async function handleCrawlDispatch(
  req: Request,
  deps: CrawlDispatchDependencies
): Promise<Response> {
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Unsupported request.');
  try {
    const caller = await deps.getCaller(req);
    if (!caller) return fail(401, 'UNAUTHENTICATED', 'Sign in to refresh scholarships.');
    const { client, userId } = caller;
    const admin = await client.rpc('is_admin');
    if (admin.error) throw admin.error;
    if (!admin.data)
      return fail(403, 'FORBIDDEN', 'Only an administrator can refresh scholarships.');
    let payload: { mode?: unknown } = {};
    try {
      const text = await req.text();
      if (text.length > 2000) throw new Error();
      payload = text ? JSON.parse(text) : {};
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error();
    } catch {
      return fail(400, 'INVALID_MODE', 'Choose discovery, monitoring or combined.');
    }
    const mode = payload.mode ?? 'combined';
    if (!['discovery', 'monitoring', 'combined'].includes(String(mode)))
      return fail(400, 'INVALID_MODE', 'Choose discovery, monitoring or combined.');
    const limit = await client.rpc('consume_rate_limit', {
      p_endpoint: 'trigger-crawl',
      p_limit: 5,
    });
    if (limit.error) throw limit.error;
    if (!limit.data?.allowed)
      return fail(429, 'RATE_LIMITED', 'Too many refresh requests. Try again in an hour.');
    const running = await client
      .from('crawl_logs')
      .select('id,started_at')
      .eq('status', 'running')
      .gt('started_at', new Date(deps.now().getTime() - 30 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();
    if (running.error) throw running.error;
    if (running.data)
      return fail(
        409,
        'ALREADY_RUNNING',
        'A crawler run is already in progress. Wait for it to finish.'
      );
    const { token, repo, ref, workflow } = deps.config;
    if (!token || !repo)
      return fail(
        503,
        'NOT_CONFIGURED',
        'Configure the GitHub dispatch token, repository and workflow branch in the Edge Function secrets.'
      );
    const request_id = deps.uuid();
    const requested_at = deps.now().toISOString();
    const response = await deps.fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'nexus-trigger-crawl',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref,
          inputs: { triggered_by: 'manual', triggered_by_user: userId, mode, request_id },
        }),
        signal: AbortSignal.timeout(25000),
      }
    );
    if (response.status !== 204)
      return fail(
        502,
        'DISPATCH_FAILED',
        'The refresh could not be queued. Check the workflow branch and GitHub dispatch configuration.',
        `GitHub HTTP ${response.status}`
      );
    const audit = await client
      .from('audit_log')
      .insert({
        actor_user_id: userId,
        action: 'crawler.trigger',
        target_table: 'crawl_logs',
        metadata: { via: 'trigger-crawl', ref, mode, request_id },
      });
    if (audit.error) console.error('[trigger-crawl] audit insert failed');
    return ok({
      dispatched: true,
      mode,
      request_id,
      requested_at,
      run_hint: 'Refresh queued. Results appear after the crawler finishes.',
    });
  } catch {
    return fail(
      500,
      'INTERNAL_ERROR',
      'The refresh request could not be processed. Please try again.'
    );
  }
}
