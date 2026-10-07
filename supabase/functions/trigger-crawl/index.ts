import { getCaller } from '../_shared/auth.ts';
import { handleCrawlDispatch } from '../_shared/crawl-dispatch.ts';
// @ts-expect-error — Deno runtime
const config = {
  token: Deno.env.get('GITHUB_DISPATCH_TOKEN'),
  repo: Deno.env.get('GITHUB_REPO'),
  ref: Deno.env.get('GITHUB_WORKFLOW_REF') ?? 'main',
  workflow: Deno.env.get('CRAWLER_WORKFLOW_FILE') ?? 'crawler.yml',
};
// @ts-expect-error — Deno runtime
Deno.serve((req: Request) =>
  handleCrawlDispatch(req, {
    getCaller,
    fetch,
    config,
    now: () => new Date(),
    uuid: () => crypto.randomUUID(),
  })
);
