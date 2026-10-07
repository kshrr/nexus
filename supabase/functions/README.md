# Edge Functions — Find Your Path

```
_shared/
  riasec.ts      PURE scoring + Holland Code       (unit-tested, 34 cases)
  rules.ts       PURE rule engine + ranking        (unit-tested, 42 cases)
  auth.ts        caller-scoped Supabase client     (FR-SEC-05 / V-02)
  http.ts        response envelope (§15)
score-riasec/
  index.ts               GET questions | GET interpretation | POST score
  question-bank.json     36 items + answer key      ← never served to the client
  interpretations.json   per-letter description blocks
recommend/
  index.ts       POST -> ranked careers + courses
  rules.json     the rule base                     ← never shipped to the browser
match-scholarship/
  index.ts       POST -> eligibility checklists + scores (read-only)
chat/
  index.ts               POST -> text/event-stream from Gemini
  system-prompt.ts       the §12.3 hardened prompt
_shared/scholarship.ts   PURE eligibility evaluation   (unit-tested, 39 cases)
_shared/chat-context.ts  PURE context allowlist + output filter (49 cases)
```

## The Gemini key

It exists in exactly one place: `Deno.env` inside `fn:chat`. Set it once —

```bash
npx supabase secrets set GEMINI_API_KEY=your-key
npx supabase secrets set GEMINI_MODEL=gemini-3.6-flash   # optional
```

— and never anywhere else.

`npm run check:secrets` is the automated form of AC-34 / NFR01c. It works in two
layers because each has a different blind spot:

* **pattern** matching knows credential shapes and needs no access to the real
  secret, but only catches formats it has been taught. Google issues Gemini keys
  in at least two: `AIzaSy…` (legacy AI Studio) and `AQ.A…` (current). Both are
  covered, and `src/lib/secretScan.test.js` proves each rule actually fires.
* **literal** matching compares against the real value, so no format can slip
  past — but it only runs where the value is readable (a local `.env` or a CI
  variable). Here the key lives in the Edge runtime, so this layer is inert
  locally and would engage in CI.

Neither layer is exhaustive on its own. Say so in the thesis rather than
claiming the scan is complete.

The browser never contacts Gemini. React → `fn:chat` → Gemini → stream → React.

## Why the logic is split out

`riasec.ts` and `rules.ts` contain no Deno APIs and no I/O, so they run under
Vitest alongside the frontend suite (`npm run test`). That is what makes the
scoring formula, the Holland Code tie-break, the match score and the ranking
directly testable against the specification.

## Deploying

```bash
npx supabase functions deploy score-riasec
npx supabase functions deploy recommend
```

No extra secrets are needed: both read `SUPABASE_URL` and `SUPABASE_ANON_KEY`,
which the platform injects. **Neither function ever uses the service-role key** —
every query runs under the caller's JWT so RLS still applies to server-side code
(FR-SEC-05, vulnerability V-02).

The database seed the engine resolves against is migration `0009`, so run
`npx supabase db push` before the first `fn:recommend` call.

## What is enforced here, and where it comes from

| Behaviour | Source |
| --- | --- |
| 5-point scale, values 0–4, `dimension_score = Σ(6 items)` → 0–24 | architecture.md §7.2 (D-01) |
| Holland Code = top three, ties broken R-I-A-S-E-C | §7.3 (D-02) |
| 36 responses, ids 1–36 unique, values 0–4, else 400 `INCOMPLETE_ASSESSMENT` | §7.1, §15 |
| One `riasec_results` row per user; retake overwrites | §3.2, AC-15 |
| Answer key never leaves the server | §3.3.2C, AC-16 |
| `match_score = (satisfied / applicable) × 100`, fires at ≥ 50 | §9.2 (D-12, D-13) |
| Rank: score ↓, satisfied count ↓, rule id ↑ | §9.3 (D-14) |
| Top 8 careers, top 8 courses | §9.3 (D-15) |
| Degraded mode: subject conditions NOT EVALUABLE, excluded from both sides | §9.4 (D-16) |
| Subject not sat → unsatisfied, not an error | §8.4 |
| `careers.riasec_profile` as a separate secondary signal | §9.6 (D-17) |
| Every condition must carry a label, or the rule is rejected at load | §9.1 |
| Rule base absent from the client bundle | §3.3.2C, AC-26 |

Nothing here consults a model. §4.1.3 excludes machine learning and adaptive
algorithms, and Gemini is confined to the chatbot.

---

## Specification gaps found while implementing

These are reported rather than quietly decided. Four are mechanical; two change
what a student actually sees and need sign-off.

### 1. Reverse-scoring flags — contradiction *(material)*

§7.1 says the function loads "question-bank.json (dimension map **and
reverse-scoring flags**)". §7.4's schema has no such field, and §7.2's formula is
a plain sum with no reversal.

**Implemented:** plain sum, per §7.2 — that is the authoritative scoring
statement, and reverse scoring is not used in SDS-family *interest* inventories
(unlike personality instruments). No item is reverse-keyed.
**Needs:** either delete the phrase from §7.1, or specify which items reverse and
amend §7.2.

### 2. `subject_domain_strength` aggregation — undefined *(material)*

§9.1 lists the condition type and says only "aggregate over `subjects.domain`".
It never says *how*: satisfied if **any** subject in the domain is strong, if
**all** are, or if a majority are. The report's own rules are phrased at this
level ("strong mathematics + strong science"), so the choice changes which
recommendations fire.

**Implemented:** `DOMAIN_AGGREGATION = 'any'` in `_shared/rules.ts`, isolated to
one line so it is trivially changed. This is the only new default this phase
introduced, and it is not presented as documented.
**Needs:** a decision, then a sentence in §3.4.2.

### 3. Fourth ranking key — required by AC-23 but absent *(mechanical)*

§9.3's chain is score → satisfied count → rule id. One rule routinely emits
several courses, which tie on all three, so the order of those would depend on
catalog row order and AC-23 ("identical inputs produce identical ranked output")
could not hold.

**Implemented:** `target id ascending` appended as a final tie-break.
**Needs:** one line added to §9.3.

### 4. `riasec_score` condition shape — not shown *(mechanical)*

§9.1's table lists the type and its `gte`/`lte` operators but the worked example
does not include one, so the key naming the dimension is undefined.

**Implemented:** `{ type, operator, dimension: 'A', value: 15, label }`, mirroring
how `subject_strength` pairs `subject` with `value`.

### 5. `interest` matching semantics — not stated *(mechanical)*

§9.1 says the condition is evaluated against `profiles.career_goal` **and**
`target_industry`, without saying whether either or both must match, or whether
matching is case-sensitive.

**Implemented:** case-insensitive substring against the two fields joined. An
unstated interest evaluates **unsatisfied** — which is what the card in
ui-specifications.md §3.9 shows ("Interest in health sciences not stated").

### 6. Secondary-signal count — not capped *(mechanical)*

§9.6 appends riasec_profile matches "below the rule-matched set" but gives no
count, while D-15 caps the rule-matched list at 8.

**Implemented:** returned uncapped in a separate `secondary_careers` array
rather than inventing a limit. Revisit if the careers table grows large.

---

### 7. Eligibility count — the mockup contradicts its own caption *(material)*

ui-specifications.md §3.11 shows a checklist of six criteria (4 ✓, 1 ✗, 1 —) headed
"You meet **4 of 6** requirements", then states immediately below that the count
"counts only checkable criteria" — which would be **4 of 5**, since the `—` item
is not checkable.

**Implemented:** the architecture wins for logic. §10.5 defines
`eligibility_score = satisfied / checkable_count × 100`, so the unverifiable
criterion is excluded from the denominator (4/5 = 80%), and the UI reads
"4 of 5 requirements we can check". Counting an unverifiable requirement as a
miss would contradict §10.6's whole point.
**Needs:** correct the mockup's `4 of 6` to `4 of 5`.

### 8. `citizenship` and `age` criteria have no collection point *(material)*

§3.4 lists both in the criterion taxonomy and §3.11's mockup shows
"✓ Malaysian citizen" as *satisfied*. But ui-specifications.md §9.1 states
plainly that date of birth, IC number and nationality are **not collected** —
so neither can ever be verified from stored data.

**Implemented:** both report as `unknown` ("Nexus can't check this"), never as a
pass or a fail. Guessing "satisfied" would be a fabricated ✓ on the single most
consequential screen in the product.
**Needs:** either drop the two types from the taxonomy, or add the fields and
address the PDPA consequences of collecting nationality and DOB from minors.
Until then, an admin should mark such criteria `is_checkable = false`.

### 9. `min_grade` and `subject_grade` value shapes are undefined *(mechanical)*

§3.4 gives `value jsonb` and the operator set, but never the payload shape.

**Implemented:** `min_grade` takes a letter grade or a point value and compares
it against the average across every recorded subject; `subject_grade` takes
`{ "subject": "MATH", "grade": "B" }`. Both accept letters or §8.2 points. Where
the student has no data the criterion is `unsatisfied` **with an explanatory
hint** — which is what §3.11's mockup does ("✗ Minimum CGPA 3.75 / You haven't
added a CGPA").

### 10. `other` marked checkable has no defined evaluation *(mechanical)*

**Implemented:** reports `unknown`. `other` is the free-text escape hatch and in
practice should always be `is_checkable = false`; the admin form defaults it so.

### 11. `relevance_score` is named but not defined *(mechanical)*

§10.5 says only "field overlap with recommended course fields".

**Implemented:** the count of the scholarship's `field_of_study` entries that
appear among the student's recommended course fields. It is a tie-break behind
eligibility, so the exact scale does not affect the primary ordering.

### 12. Rate limiting cannot use the caller's JWT directly *(resolved in SQL)*

§4.8 puts `rate_limit_events` beyond the browser entirely — RLS on, zero
policies, grants revoked. §12.1 / FR-SEC-05 simultaneously require `fn:chat` to
query as the calling user. Together those make the counter unwritable by the
function.

**Implemented:** `public.consume_rate_limit()` (migration 0011), a SECURITY
DEFINER function granted to `authenticated`. It writes the counter as its owner
while taking the identifier from `auth.uid()` **inside** the function, so a
caller cannot spend or inspect another student's quota — there is no identifier
argument to forge. The table itself stays unreachable.
**Needs:** a sentence in §3.3.2C describing the mechanism.

### 13. The chatbot has no authoritative data to answer from *(by design)*

§12.2 forbids raw scholarship descriptions in the payload — they are
attacker-controllable crawler text, the V-01 vector — and the allowlist contains
no scholarship, course or university records at all. So the assistant genuinely
cannot answer "what are the requirements for X".

**Implemented:** the system prompt states this explicitly and routes such
questions to the stored records in the app, and the panel says so up front
before the student's first message. Anti-fabrication here comes from *withholding
the data and instructing refusal*, not from hoping the model behaves. Concepts
it can safely explain from general knowledge — what a Holland Code means, how
STPM differs from matriculation — remain open.

---

## fn:trigger-crawl

Lets an administrator start a scraper run out of schedule (ui-spec §10.4).

```
POST /functions/v1/trigger-crawl   Authorization: Bearer <admin JWT>
  -> 200 { dispatched: true }
  -> 401 / 403 / 409 ALREADY_RUNNING / 429 RATE_LIMITED / 503 NOT_CONFIGURED
```

The browser cannot start the Python scraper directly — that would need a GitHub
token in frontend code. This function holds the token and runs the
authorisation check server-side:

1. `getCaller(req)` — caller-scoped client (FR-SEC-05); no service-role key.
2. `is_admin()` on the caller's own row — a student's JWT returns 403.
3. `consume_rate_limit('trigger-crawl', 5)` — 5 manual runs per admin per hour.
4. Refuses (409) if `crawl_logs` already shows a `running` row. The real lock is
   `begin_crawl_run()`'s advisory lock in migration 0012 — this is the fast path.
5. `POST` to the GitHub `workflow_dispatch` API for `crawler.yml`.
6. Appends a `crawler.trigger` row to `audit_log` (actor = the admin).

**Edge Function secrets** (`supabase secrets set`):

| name | value |
| --- | --- |
| `GITHUB_DISPATCH_TOKEN` | fine-grained PAT, `actions: write` on the repo |
| `GITHUB_REPO` | `owner/repo` |
| `GITHUB_WORKFLOW_REF` | branch the workflow is on (default `main`) |
| `CRAWLER_WORKFLOW_FILE` | default `crawler.yml` |

Without the first two the function returns a clear 503 rather than failing — the
rest of the admin area still works.

---

## The scraper upsert — partial-index `ON CONFLICT`

`uq_scholarships_source_hash` is a **partial** unique index
(`WHERE source_hash IS NOT NULL`). PostgreSQL cannot infer a partial index as an
`ON CONFLICT` arbiter unless the predicate is repeated, so the upsert lives in
`scraper_upsert_scholarship()` (migration 0012) and is written as:

```sql
insert into public.scholarships (...) values (...)
on conflict (source_hash) where source_hash is not null
do update set ...
```

A plain `on conflict (source_hash)` fails with *"there is no unique or exclusion
constraint matching the ON CONFLICT specification"*. The same function also
enforces `is_manual` protection and change detection atomically — the scraper
never check-then-writes. Covered by `supabase/tests/scraper.test.mjs` (28 checks)
and `supabase/tests/scholarship.test.mjs`.

---

## Content that is drafted, not specified

`question-bank.json`, `interpretations.json` and `rules.json` each carry a
`_provenance` block. In short:

- **35 of the 36 items** are drafted in the idiom of the public-domain O*NET
  Interest Profiler, which §7.4 names as the appropriate basis. Only item 1 comes
  from the report. They are **not a validated instrument** (D-04 / M-10).
- **Interpretation prose** is drafted to the structure §7.5 adopts (D-05).
- **The rule base holds only the four rules the documents actually state.**
  Nothing was invented to pad it. Expanding it is a supervisor-authoring task
  (D-18 / M-15).
- **Migration 0009's careers and courses** are a demonstration set, not a
  verified MQA dataset (D-19 / M-16).
- **No scholarship records are seeded anywhere.** Scholarship data is factual,
  time-sensitive and consequential: a fabricated deadline or eligibility rule
  could cause a student to miss a real application. Records come from an
  administrator (`/admin/scholarships`, FR14) or, from Stage 9, the crawler.
  The only scholarship rows in this repository are fixtures inside
  `supabase/tests/scholarship.test.mjs`.

## Scholarship discovery trigger

trigger-crawl accepts a POST body with mode discovery, monitoring or combined (default). It checks the caller's admin role, rate limit and active-run state, then dispatches crawler.yml with a generated request_id. The response reports queued dispatch, not completed extraction. The admin page polls the corresponding crawl_logs request_id.
BRAVE_SEARCH_API_KEY belongs only in GitHub Actions secrets; the Edge Function keeps its existing GitHub dispatch settings. Verify GITHUB_WORKFLOW_REF names the deployed workflow branch. Apply migrations 0014 and 0015 before deploying the updated app/function. See docs/scholarship-discovery-deployment.md for the reviewable deployment sequence.
