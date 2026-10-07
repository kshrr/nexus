# Scholarship discovery security

The Python Actions job holds the Supabase service-role credential. The browser holds only its existing public Supabase client/session, and the Edge Function holds only its GitHub dispatch configuration. BRAVE_SEARCH_API_KEY lives in Actions secrets, never a VITE_ variable or discovery settings row.

## Data and publication

- Broad search results are leads. Extracted candidates/evidence/settings are admin-only staging, protected by RLS and explicit privileges. Anonymous/student users cannot review, publish or change them.
- Browser mutations require admin-checked database RPCs with pinned search paths. Scraper staging, selected monitoring and lifecycle RPCs are service-only. RLS bypass is not an EXECUTE grant.
- Add to Nexus is an idempotent transaction: lock candidate, validate readiness, create/link publication, insert criteria, record approval/audit and enable monitoring. No unselected discovery is published by a refresh.
- An internal transaction/actor/row publication guard exempts only a new publication INSERT or a validated explicit changes-approval transaction from the manual trigger. Guarded updates preserve the existing manual flag; protected/manual publications cannot be promoted automatically. Browsers cannot access the guard, and browser-settable configuration cannot spoof it. Actual admin content edits and criteria edits mark publications manual; row locks retain corrections during monitoring.
- Pending review corrections and approved monitoring overrides are stored separately. Save review cannot change publication; Approve updates is an explicit validated/audited transaction. Initial review corrections are explicit overrides. Rediscovery changes source snapshots while preserving those corrections, ignored decisions, approval metadata and publication links.
- Monitoring uses selected identities/aliases, not the first programme on a multi-programme page. Failed/empty/changed-identity extraction retains trustworthy publication data. Only evidenced closure/past confirmed dates can expire a programme.

## Untrusted content and destinations

Existing clean_text/date/category helpers strip HTML/control characters and flag suspicious phrases before extracted text enters staging. Missing names, providers, levels, status or meaningful descriptions require review. Search snippets are labelled leads and never become authoritative programme descriptions or automatic student/chatbot context. Generic extraction never invents deadlines, funding amounts or eligibility rules.

Application destinations on unfamiliar domains require candidate-specific admin confirmation. Changed source/application destinations stay in staging and do not overwrite approved public links. Actual publication fields remain the existing student/matching/chatbot inputs; existing eligibility rules are unchanged. Human-edited eligibility wording is non-checkable guidance so an old numeric rule cannot contradict its new label.

## Public HTTPS transport

All robots/content requests use PublicHttpClient. Only HTTPS on port 443 is accepted; credentials, private/reserved/loopback/link-local and mixed DNS answers are refused. The socket is pinned to a validated IP while TLS SNI/certificate verification uses the original hostname. Every destination across at most three redirects is checked independently. No environment proxy, provider authentication/cookies, scripts, browser rendering, OCR or access-control bypass is used.

DNS/transport work uses a request deadline and response bytes are bounded during decompression. Robots 404/410 mean no published rules; denial, rate limits and failed/unreadable robots requests fail closed. Host delays and published crawl-delay are honoured. Discovery/monitoring share an 18-minute work budget, 100 content attempts and five attempts per host. Search requests are capped at 12, results 20 per request, and listing links follow one hop. Shared-page cache avoids duplicate content requests for multiple programmes.

## Logs and verification

Python logs redact known credential patterns and configured literal Brave/GitHub/Supabase/Gemini secrets. Search/dispatch errors do not echo upstream bodies or raw key-bearing exceptions. Crawl errors/counters are bounded and keyed to the request/run. The UI labels queued/running/finished states distinctly and cannot infer completion from accepted dispatch.

Tests cover transport/DNS/redirects/robots/decompression, source and parser evidence, broad staging, selected identity matching, idempotent publication, manual criteria protection, RLS/RPC privileges, aliases/revisions and actual catalogue paging. PGlite fixtures do not prove concurrent PostgreSQL sessions or 20 live scholarships; those checks are in docs/scholarship-discovery-deployment.md. The bundle scan checks known credential patterns and configured secret literals; unknown credentials unavailable locally cannot be exhaustively scanned by format alone.
