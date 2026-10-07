import { describe, it, expect } from 'vitest';
import { handleCrawlDispatch } from './crawl-dispatch';
const requestId = '11111111-1111-4111-8111-111111111111';
function fixture({
  authenticated = true,
  admin = true,
  limited = false,
  running = false,
  configured = true,
  status = 204,
} = {}) {
  const sent: { url: string; body: unknown }[] = [];
  const audit: unknown[] = [];
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    gt() {
      return this;
    },
    limit() {
      return this;
    },
    async maybeSingle() {
      return { data: running ? { id: 'run' } : null, error: null };
    },
  };
  const client = {
    async rpc(name: string) {
      return { data: name === 'is_admin' ? admin : { allowed: !limited }, error: null };
    },
    from(table: string) {
      return table === 'crawl_logs'
        ? query
        : {
            async insert(row: unknown) {
              audit.push(row);
              return { error: null };
            },
          };
    },
  };
  const deps = {
    getCaller: async () => (authenticated ? { client, userId: 'admin' } : null),
    config: {
      token: configured ? 'synthetic-github-key' : '',
      repo: 'owner/nexus',
      ref: 'feature',
      workflow: 'crawler.yml',
    },
    now: () => new Date('2026-10-07T00:00:00Z'),
    uuid: () => requestId,
    fetch: async (url: string, options: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(options.body)) });
      return new Response(null, { status });
    },
  };
  return { deps, sent, audit };
}
const req = (body = '{"mode":"discovery"}') =>
  new Request('https://nexus.example/trigger-crawl', { method: 'POST', body });
describe('admin crawl dispatch', () => {
  it('correlates queued request without claiming completion', async () => {
    const f = fixture();
    const response = await handleCrawlDispatch(req(), f.deps);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ dispatched: true, mode: 'discovery', request_id: requestId });
    expect(body.data.completed).toBeUndefined();
    expect(f.sent[0].body).toEqual({
      ref: 'feature',
      inputs: {
        triggered_by: 'manual',
        triggered_by_user: 'admin',
        mode: 'discovery',
        request_id: requestId,
      },
    });
    expect(f.audit).toHaveLength(1);
  });
  it.each([
    [{ authenticated: false }, 401],
    [{ admin: false }, 403],
    [{ limited: true }, 429],
    [{ running: true }, 409],
    [{ configured: false }, 503],
    [{ status: 404 }, 502],
  ])('rejects unavailable/unauthorised dispatch %j', async (options, expected) => {
    const f = fixture(options);
    const response = await handleCrawlDispatch(req(), f.deps);
    expect(response.status).toBe(expected);
    expect(JSON.stringify(await response.json())).not.toContain('synthetic-github-key');
  });
  it.each(['{"mode":"delete"}', '[]', '{broken'])(
    'rejects malformed mode/body before dispatch',
    async (body) => {
      const f = fixture();
      expect((await handleCrawlDispatch(req(body), f.deps)).status).toBe(400);
      expect(f.sent).toHaveLength(0);
    }
  );
  it('defaults existing empty-body callers to combined', async () => {
    const f = fixture();
    const body = await (await handleCrawlDispatch(req(''), f.deps)).json();
    expect(body.data.mode).toBe('combined');
  });
  it('does not echo upstream secrets in thrown exceptions', async () => {
    const f = fixture();
    f.deps.fetch = async () => {
      throw new Error('synthetic-github-key');
    };
    const response = await handleCrawlDispatch(req(), f.deps);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('synthetic-github-key');
  });
});
