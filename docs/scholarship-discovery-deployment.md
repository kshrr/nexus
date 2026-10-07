# Scholarship discovery deployment

The local implementation adds `/admin/scholarship-discovery`. Discoveries are admin-only; **Add to Nexus** publishes a programme and enables monitoring. The live catalogue is not populated by fixtures. Search coverage, accessible pages and evidence determine its actual size.

## Before deployment

- This portfolio snapshot stores its manual-only workflow in `scraper/crawler.workflow.example.yml`. Copy it to `.github/workflows/crawler.yml` in your own repository before configuring Actions and crawler dispatch.

- Back up the hosted database and inspect its migration history. The discovery schema expects migrations 0002–0012. Preserve the existing unrelated 0013 career migration; do not deploy unrelated pending migrations automatically.
- Review and apply `supabase/migrations/0014_scholarship_discovery.sql`, then `0015_scholarship_discovery_operations.sql`, using the project's migration process. Inspect the backfill: only existing crawler-managed active/expired rows with source URLs are enrolled, and no new scholarship examples are seeded. Applying a migration is a distinct hosted action.
- Deploy `supabase/functions/trigger-crawl` with the existing caller-auth configuration. Confirm server secrets `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO` (owner/repository), `GITHUB_WORKFLOW_REF`, and optionally `CRAWLER_WORKFLOW_FILE`. The actual workflow branch must contain the updated workflow; do not assume `main` when this checkout is on a feature branch from `master`.
- Publish the updated workflow and admin app together after the database/Edge changes. Neither a local commit nor an accepted workflow dispatch deploys a feature by itself.

## Credentials and schedule

GitHub repository Actions secrets must contain `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `BRAVE_SEARCH_API_KEY`. Configure your own Brave key in the repository Actions secrets. Check presence only. Never paste values into logs/chat, frontend settings or any `VITE_` variable.

This portfolio copy supports manual runs only. To enable weekly runs against your own backend, add a Monday 19:00 UTC cron trigger (Tuesday 03:00 Malaysia/Singapore time), using combined mode. The Actions job has a 20-minute timeout; application work has an 18-minute budget. Discovery makes at most 12 search requests, 20 results each, with baseline queries and seven-day page freshness. Freshness is not proof of a new intake. Content attempts are capped at 100, five per host, and one additional programme-link hop. Combined mode reserves at most 40 content attempts for oldest selected sources before discovery. Same-page programme monitoring shares a fetched page.

An admin can edit up to six queries and the catalogue target in Search settings. The target defaults to 20 genuine programmes and is not a weekly new-record quota.

## First live smoke check

1. Trigger **Refresh from web** in admin discovery. Confirm queued -> running -> finished/partial by the matching request ID. A successful dispatch alone is not a completed run.
2. Inspect actual catalogue totals, provider variety and source evidence. Providers beyond the four supported parsers are accepted. If fewer than 20 reliable programmes are available, report the yield and review reasons; never fill the gap with fabricated entries.
3. Confirm unselected discoveries are absent from the public/student scholarship list and chatbot context. Ready entries can be added directly; incomplete entries require Review details.
4. Review one real source, application destination, status and deadline. Add it twice or from two admin sessions; confirm one published scholarship/criteria set and the same publication ID.
5. Run monitoring; confirm selected-source checks, preserved publication identity, crawler management after approval, and changed trustworthy fields. Manual edits, including criteria-only edits, must stay protected. Initial review corrections are stored as explicit overrides. Saving later reviews keeps a pending draft; **Approve updates** applies validated changes and registers an observed moved-source alias. Manually protected publications still require the existing Scholarships editor.
6. Ignore a lead, rediscover it, and confirm it remains ignored. Stop monitoring one selected programme; confirm publication remains intact.
7. Test anon/student access through their own API credentials: staging/settings and admin RPC actions must be inaccessible, and browser roles cannot execute scraper writes.

Search requires a valid subscription. JavaScript shells, PDFs, access-denied pages and uncertain official sources remain reviewable with honest reasons. They are not automatically rendered, OCR-processed or bypassed.

## Real PostgreSQL concurrency checks

Fixture DB tests run in PGlite; they do not prove concurrent sessions. Use a staging PostgreSQL/Supabase project and two independent authenticated admin sessions:

- Add the same ready candidate concurrently. Both actions must return the same published ID; criteria must not duplicate. The publication guard table must be empty afterward.
- Start a selected monitoring transaction while the other admin edits the same publication or its criteria. Depending on lock order, monitoring either finishes before the edit or sees manual protection and skips publication changes. The final admin correction must survive.
- Archive a publication during monitoring and verify no later monitor write reopens it.
- Rediscover while saving a review: stale revisions must return STALE_REVIEW, retaining the latest saved corrections and approvals.
- Cancel/fail a run and verify the authoritative stale-running window releases it after 30 minutes. This is separate from a delayed Actions queue.

## Troubleshooting

- **Key missing/rejected:** set/check the repository Actions secret and Brave subscription. Broad discovery fails clearly; it does not silently revert to four providers. Monitoring-only remains available in Actions.
- **403, robots failure, unsupported PDF/JS:** inspect the official source in the review panel and complete details manually where appropriate. Failed fetches retain published records and never infer closure.
- **Changed application/source destination:** review and approve the new destination. Until then, publication keeps its last approved link.
- **Delayed queued refresh:** use Check status/Check logs and inspect Actions queue/configuration/branch. Do not label a delayed job completed.
- **RPC absent or permission denied:** verify migration order and explicit function grants; a service role bypasses RLS but still needs EXECUTE privileges.
- **API rate limit/partial failure:** successful candidates stay saved; crawl logs carry actual counters and bounded, credential-redacted errors.

## Local verification

```powershell
python -m pytest scraper/tests -q
npm.cmd run verify
git diff --check
```

Local tests are separate from live discovery, hosted deployment and browser verification.

API reference: https://api-dashboard.search.brave.com/api-reference/web/search/get
