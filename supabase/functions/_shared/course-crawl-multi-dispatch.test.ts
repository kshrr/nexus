import { it, expect } from 'vitest';
import { handleCourseCrawlDispatch } from './course-crawl-dispatch';

function deps(failed = '') {
  const sent: any[] = [];
  let id = 0;
  const client = {
    rpc: async (name: string) => ({
      data: name === 'is_admin' ? true : { allowed: true },
      error: null,
    }),
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        gt: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        insert: async () => ({ error: null }),
        then: (resolve: any) =>
          resolve({
            data:
              table === 'course_source_registry'
                ? [{ source: 'um' }, { source: 'usim' }, { source: 'unisza' }, { source: 'utem' }]
                : [],
            error: null,
          }),
      };
      return chain;
    },
  };
  return {
    sent,
    getCaller: async () => ({ client, userId: 'admin' }),
    config: { token: 'test', repo: 'owner/private', ref: 'main', workflow: 'course-crawler.yml' },
    uuid: () => `request-${++id}`,
    now: () => new Date('2026-10-15T00:00:00Z'),
    fetch: async (_url: string, init: any) => {
      const input = JSON.parse(init.body).inputs;
      sent.push(input);
      return new Response(null, { status: input.source === failed ? 503 : 204 });
    },
  } as any;
}
const request = (source: string) =>
  new Request('https://nexus.test/refresh', { method: 'POST', body: JSON.stringify({ source }) });
it('dispatches all supported universities with independent UUIDs, skipping retired ones', async () => {
  const d = deps();
  const response = await handleCourseCrawlDispatch(request('all'), d);
  expect(response.status).toBe(200);
  const { data } = await response.json();
  expect(data.requests.filter((r: any) => r.dispatched)).toHaveLength(3);
  expect(d.sent.map((r: any) => r.source)).toEqual(['um', 'unisza', 'utem']);
  expect(new Set(d.sent.map((r: any) => r.request_id)).size).toBe(3);
});
it('retains accepted requests when one university dispatch fails', async () => {
  const response = await handleCourseCrawlDispatch(request('all'), deps('unisza'));
  expect(response.status).toBe(200);
  const { data } = await response.json();
  expect(data.requests.find((r: any) => r.source === 'unisza').dispatched).toBe(false);
  expect(data.requests.filter((r: any) => r.dispatched)).toHaveLength(2);
});
it('selects UTeM without dispatching UM', async () => {
  const d = deps();
  const response = await handleCourseCrawlDispatch(request('utem'), d);
  expect(response.status).toBe(200);
  expect(d.sent.map((r: any) => r.source)).toEqual(['utem']);
});
it('rejects retired UniMAP and USIM sources', async () => {
  for (const retired of ['unimap', 'usim']) {
    const d = deps();
    const response = await handleCourseCrawlDispatch(request(retired), d);
    expect(response.status).toBe(400);
    expect(d.sent).toEqual([]);
  }
});
