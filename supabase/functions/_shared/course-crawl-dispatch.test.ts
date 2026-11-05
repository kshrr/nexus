import { describe, it, expect } from 'vitest';
import { handleCourseCrawlDispatch } from './course-crawl-dispatch';

function dependencies({
  admin = true,
  running = null,
  allowed = true,
  configured = true,
  status = 204,
  signedIn = true,
} = {}) {
  return {
    getCaller: async () =>
      signedIn
        ? {
            userId: 'admin-1',
            client: {
              rpc: async (name: string) => ({
                data: name === 'is_admin' ? admin : { allowed },
                error: null,
              }),
              from: (table: string) => {
                if (table === 'course_source_registry')
                  return {
                    select: async () => ({
                      data: [{ source: 'um' }, { source: 'unimap' }, { source: 'usim' }],
                      error: null,
                    }),
                  };
                const query: any = {
                  select: () => query,
                  eq: () => query,
                  gt: () => query,
                  limit: () => query,
                  maybeSingle: async () => ({ data: running, error: null }),
                  insert: async () => ({ error: null }),
                };
                return query;
              },
            },
          }
        : null,
    fetch: async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      expect(body.inputs.source).toBe('um');
      expect(body.inputs.request_id).toBe('request-1');
      return new Response(null, { status });
    },
    config: {
      token: configured ? 'fixture-token' : undefined,
      repo: 'owner/private-repo',
      ref: 'main',
      workflow: 'course-crawler.yml',
    },
    now: () => new Date('2026-10-10T00:00:00Z'),
    uuid: () => 'request-1',
  } as any;
}
const request = (payload: any = { source: 'um' }) =>
  new Request('https://test.nexus/course-refresh', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
describe('Course crawl dispatch', () => {
  it('requires an authenticated administrator', async () => {
    expect(
      (await handleCourseCrawlDispatch(request(), dependencies({ signedIn: false }))).status
    ).toBe(401);
    expect(
      (await handleCourseCrawlDispatch(request(), dependencies({ admin: false }))).status
    ).toBe(403);
  });
  it('accepts only the registered university source', async () => {
    expect(
      (await handleCourseCrawlDispatch(request({ source: 'https://example.org' }), dependencies()))
        .status
    ).toBe(400);
  });
  it('limits refreshes and refuses overlapping runs', async () => {
    expect(
      (await handleCourseCrawlDispatch(request(), dependencies({ allowed: false }))).status
    ).toBe(429);
    expect(
      (await handleCourseCrawlDispatch(request(), dependencies({ running: { id: 'run-1' } })))
        .status
    ).toBe(409);
  });
  it('reports configuration and dispatch failures honestly', async () => {
    expect(
      (await handleCourseCrawlDispatch(request(), dependencies({ configured: false }))).status
    ).toBe(503);
    expect((await handleCourseCrawlDispatch(request(), dependencies({ status: 404 }))).status).toBe(
      502
    );
  });
  it('returns a queued request correlation rather than completed results', async () => {
    const response = await handleCourseCrawlDispatch(request(), dependencies());
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.dispatched).toBe(true);
    expect(data.request_id).toBe('request-1');
    expect(data.run_hint).toMatch(/queued/i);
    expect(data).not.toHaveProperty('status', 'completed');
  });
});
