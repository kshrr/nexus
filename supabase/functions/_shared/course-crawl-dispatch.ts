import type { CallerContext } from './auth.ts';
import { fail, ok, preflight, corsHeaders } from './http.ts';
interface Dependencies {
  getCaller: (req: Request) => Promise<CallerContext | null>;
  fetch: typeof fetch;
  now: () => Date;
  uuid: () => string;
  config: { token?: string; repo?: string; ref: string; workflow: string };
}
export async function handleCourseCrawlDispatch(
  req: Request,
  deps: Dependencies
): Promise<Response> {
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Unsupported request.');
  try {
    const caller = await deps.getCaller(req);
    if (!caller) return fail(401, 'UNAUTHENTICATED', 'Sign in to refresh university courses.');
    const { client, userId } = caller;
    const admin = await client.rpc('is_admin');
    if (admin.error) throw admin.error;
    if (!admin.data)
      return fail(403, 'FORBIDDEN', 'Only an administrator can refresh university courses.');
    let source: string;
    try {
      const text = await req.text();
      if (text.length > 2000) throw new Error();
      const payload = text ? JSON.parse(text) : {};
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error();
      source = payload.source ?? 'um';
      if (!['um', 'unimap', 'usim', 'all'].includes(source)) throw new Error();
    } catch {
      return fail(400, 'INVALID_SOURCE', 'Choose a supported university source.');
    }
    const limit = await client.rpc('consume_rate_limit', {
      p_endpoint: 'trigger-course-crawl',
      p_limit: 5,
    });
    if (limit.error) throw limit.error;
    if (!limit.data?.allowed)
      return fail(429, 'RATE_LIMITED', 'Too many refresh requests. Try again in an hour.');
    const registry = await client.from('course_source_registry').select('source');
    if (registry.error) throw registry.error;
    const registered = (registry.data ?? []).map((row: { source: string }) => row.source);
    const choices =
      source === 'all'
        ? ['um', 'unimap', 'usim'].filter((key) => registered.includes(key))
        : [source];
    if (!choices.length || choices.some((key) => !registered.includes(key)))
      return fail(400, 'INVALID_SOURCE', 'Choose a supported university source.');
    const { token, repo, ref, workflow } = deps.config;
    if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[\w.-]+\.ya?ml$/.test(workflow))
      return fail(503, 'NOT_CONFIGURED', 'University course refresh is not configured yet.');
    const results = [];
    for (const selected of choices) {
      const errorResult = (status: number, code: string, message: string) => ({
        source: selected,
        dispatched: false,
        status,
        error: { code, message },
      });
      try {
        const running = await client
          .from('course_crawl_runs')
          .select('id,started_at')
          .eq('status', 'running')
          .eq('source', selected)
          .gt('started_at', new Date(deps.now().getTime() - 30 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();
        if (running.error) throw running.error;
        if (running.data) {
          results.push(
            errorResult(
              409,
              'ALREADY_RUNNING',
              'A course sync is already running for this university.'
            )
          );
          continue;
        }
        const request_id = deps.uuid(),
          requested_at = deps.now().toISOString();
        const response = await deps.fetch(
          'https://api.github.com/repos/' + repo + '/actions/workflows/' + workflow + '/dispatches',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + token,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              'User-Agent': 'nexus-course-sync',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ref,
              inputs: {
                source: selected,
                triggered_by: 'manual',
                triggered_by_user: userId,
                request_id,
              },
            }),
            signal: AbortSignal.timeout(25000),
          }
        );
        if (response.status !== 204) {
          results.push(
            errorResult(
              502,
              'DISPATCH_FAILED',
              'The course refresh could not be queued. Check the workflow configuration.'
            )
          );
          continue;
        }
        results.push({
          source: selected,
          dispatched: true,
          request_id,
          requested_at,
          run_hint: 'Course refresh queued. Results appear after the course crawler finishes.',
        });
        try {
          const audit = await client
            .from('audit_log')
            .insert({
              actor_user_id: userId,
              action: 'course_crawler.trigger',
              target_table: 'course_crawl_runs',
              metadata: { request_id, source: selected, ref },
            });
          if (audit.error) console.error('[course-sync] audit insert failed');
        } catch {
          console.error('[course-sync] audit insert failed');
        }
      } catch {
        results.push(
          errorResult(502, 'DISPATCH_FAILED', 'This university refresh could not be queued.')
        );
      }
    }
    if (source !== 'all') {
      const result = results[0];
      return result.dispatched
        ? ok(result)
        : fail(result.status!, result.error!.code, result.error!.message);
    }
    if (results.some((result) => result.dispatched)) return ok({ requests: results });
    return new Response(
      JSON.stringify({
        data: { requests: results },
        error: { code: 'DISPATCH_FAILED', message: 'No university refresh could be queued.' },
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch {
    return fail(
      500,
      'INTERNAL_ERROR',
      'The course refresh request could not be processed. Try again later.'
    );
  }
}
