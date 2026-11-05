import { getCaller } from '../_shared/auth.ts';
import { handleCourseCrawlDispatch } from '../_shared/course-crawl-dispatch.ts';
// @ts-expect-error — Deno runtime
const config = {
  token: Deno.env.get('GITHUB_DISPATCH_TOKEN'),
  repo: Deno.env.get('GITHUB_REPO'),
  ref: Deno.env.get('GITHUB_WORKFLOW_REF') ?? 'main',
  workflow: Deno.env.get('COURSE_CRAWLER_WORKFLOW_FILE') ?? 'course-crawler.yml',
};
// @ts-expect-error — Deno runtime
Deno.serve((req: Request) =>
  handleCourseCrawlDispatch(req, {
    getCaller,
    fetch,
    config,
    now: () => new Date(),
    uuid: () => crypto.randomUUID(),
  })
);
