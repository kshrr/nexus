# Nexus scholarship web discovery

Brave Search discovers scholarship leads across many public provider websites. Search/extraction writes only the admin-only discovery catalogue; an admin chooses **Add to Nexus** to publish a programme and enable monitoring. Student lists and matching continue using the existing published scholarship tables.

## Operation

```powershell
python -m pytest scraper/tests -q
python -m scraper.main --mode discovery
python -m scraper.main --mode monitoring
python -m scraper.main --mode combined
python -m scraper.main --mode discovery --dry-run
python -m scraper.main --source jpa --dry-run
python -m scraper.main --list-sources
```

Real runs require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Discovery additionally requires BRAVE_SEARCH_API_KEY, configured in GitHub Actions secrets. Dry-run previews extraction without database or run-log writes; private monitored-source reads require credentials. Without private access, dry-run previews discovery only. Supported-parser diagnostics cannot publish records.

The JPA, PETRONAS, YSD, Khazanah, MARA, Yayasan TM, Yayasan Tenaga Nasional, Yayasan Sarawak, Yayasan Sabah, Bank Negara Malaysia, PTPTN, Yayasan Selangor and Maybank Foundation parsers are extraction helpers, not a discovery restriction. Every discovery run (when the Brave key is configured) first visits each registered parser's own index and stages only that parser's output, so known providers do not depend on search ranking; these pages count against the run's page and time budget but not the per-host cap (each parser's `max_targets` bounds its host). A parser that recognises a page and returns nothing (MARA post-graduate and advance-loan pages, the YTM Form 4 award, YTN non-programme pages, Yayasan Sarawak Malay mirrors and news, index pages) is final: generic extraction does not stage it. A parser may name an official PDF attachment on its page (Yayasan Sabah's advertisement on PTPS); it is fetched with the same https, robots, page and time limits and decoded in the bounded PDF worker, while the record's source stays the HTML page. Official PDFs a requirement refers to (approved-institution lists, the advertisement) are kept as `source_documents` and shown on the scholarship page as links that open in a new tab. Supported-provider candidates that the database judges ready are published automatically at the end of that pass (`scraper_auto_publish_discovery`, service role only; migration `0031`); anything with review reasons stays in the admin queue, and web-search candidates are never auto-published. Admins can filter the queue by source and ignore all web-search results in one action. Unknown provider domains use evidence-based HTML extraction. Incomplete, suspicious, closed, blocked, PDF and JavaScript-only pages have honest review/fetch reasons. No deadlines, amounts, levels or scholarship examples are invented.

Weekly combined operation remains Monday 19:00 UTC / Tuesday 03:00 Malaysia-Singapore time. Admin Refresh from web dispatches discovery; existing refresh defaults to combined. Modes and request IDs are recorded in crawl_logs. A dispatch is queued, not completed.

## Modules

- search.py: bounded fixed-endpoint Brave requests, baseline/recent query passes, fair merging and canonical lead URLs.
- discovery_extract.py: supported parsers plus generic semantic extraction, stable programme identity, field evidence and review reasons.
- discovery.py: shared work/page/host/search budgets and staging writes; programme links follow one hop.
- monitor.py: refresh selected programme identities only, caching shared pages and retaining last trustworthy publications on failures.
- public_http.py and fetch.py: public-only pinned HTTPS with verified TLS hostnames, per-redirect destination checks, robots rules, host delays and bounded decompressed bodies.
- db.py: PostgREST RPC client, stable identities, service-only lifecycle/staging/monitoring and credential-redacted errors.

The catalogue targets at least 20 genuine programmes when search/extraction evidence supports them, not 20 new programmes every week. Counts always describe actual rows. A valid search subscription and provider/index coverage bound live yield.

See [deployment checklist](../docs/scholarship-discovery-deployment.md) for migrations, Edge/Actions setup, concurrency verification and the first live smoke run. See [security notes](SECURITY.md) for fetch and credential boundaries.

## Automatic university course catalogue

Course indexing is a separate job with registered UM, UniSZA, UTeM, MMU, UTM, Taylor's University, Taylor's College, INTI, UMPSA and Sunway College adapters. The catalogue holds only courses from these official sources: the hand-entered demonstration courses of migration `0009` are hidden (migration `0027`). Courses mean foundation/asasi, diploma and bachelor's programmes, not individual modules.

```powershell
python -m scraper.courses --source um --dry-run --output um-preview.json
python -m scraper.courses --source unisza --dry-run --output unisza-preview.json
python -m scraper.courses --source utem --dry-run --output utem-preview.json
python -m scraper.courses --source mmu --dry-run --output mmu-preview.json
python -m scraper.courses --source utm --dry-run --output utm-preview.json
python -m scraper.courses --source taylors --dry-run --output taylors-preview.json
python -m scraper.courses --source taylors_college --dry-run --output taylors-college-preview.json
python -m scraper.courses --source inti --dry-run --output inti-preview.json
python -m scraper.courses --source umpsa --dry-run --output umpsa-preview.json
python -m scraper.courses --source sunway_college --dry-run --output sunway-college-preview.json
```

These commands fetch public pages and produce a preview without database or run-log writes. To publish after deployment, run `python -m scraper.courses --source um` with server-side `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never put the service-role key in a `VITE_` variable.

Each `parsers/<source>.py` owns that university's traversal and extraction. `courses.py` applies shared page/time limits, robots rules and host delays. `course_fetch.py` adds guarded PDF and XML retrieval without changing scholarship HTML fetching. `course_db.py` calls service-only atomic RPCs from migrations `0016` and `0020`; valid records publish after activation, repeated identities keep the same course, and incomplete/failing sources preserve existing publications. Editing a course manually pauses automatic updates until an admin resumes them. Explicit historical/conflicting sessions require attention; missing sessions are not invented.

The independent private-repository workflow `course-crawler.yml` runs monthly (19:30 UTC on the 1st, 03:30 Malaysia/Singapore time on the 2nd) and accepts admin dispatches. Adding another university requires a reviewed source adapter, explicit taxonomy mappings and a registry migration. This job does not generate recommendation rules or career-course mappings.

See the [course sync deployment guide](../docs/course-catalogue-sync-deployment.md) for activation. Dry-run traversal, valid extraction and production publication are separate outcomes.

### Retired sources (November 2026)

UniMAP and USIM were removed (migration `0022`): UniMAP's requirement documents refuse automated access and GitHub-hosted runs could not read its robots.txt, and USIM's programme page now shows unrendered template shortcodes instead of a programme list. Courses previously published from them are hidden (`is_active = false`), not deleted. Re-adding either needs a new adapter and registry migration.

UUM was removed (migration `0023`): www.uum.edu.my refuses connections from the United States, where GitHub-hosted runners run (checked from eight countries on 21 November 2026; only the US node failed). Its adapter worked from Malaysia and remains in git history. A new source must be reachable from a US network before it is added.

## UniSZA and UTeM (added November 2026)

The CLI also accepts `--source unisza` and `--source utem`
(migration `0021` registered them with UUM). Live dry-runs on 21 November 2026:

| Source | Method | Valid / found | Held for review |
|---|---|---|---|
| UniSZA | WordPress sitemap + "Entry Requirement" tabs (HTML) | 63 / 64 (degree, diploma, foundation) | Aquatic Science (unlabelled international criteria) |
| UTeM | Five session-dated requirement PDFs (positioned text) | 47 / 48 (all 6 diplomas, 41 degrees) | B.Tech Cloud Computing (its row has no requirement text) |

Known limits, recorded rather than guessed:

- UniSZA intermittently drops connections from GitHub's US runners, so its adapter asks for 5 s between requests (`crawl_delay`), and course fetches retry dropped connections up to three times. A page that still cannot be read for an already-published course keeps that course unchanged (migration `0025`) and is noted in the run details instead of marking the run partial; only programmes never published, or a failed listing, count as coverage gaps.
- UniSZA requirement routes are taken only from bold headings that name a qualification; "AND"/"OR" connectors stay in the text. International criteria under no international heading hold the programme for review.
- UTeM publishes official Malay programme names; English names on its site carry no codes and are not paired. When a requirement cell is merged across faculty rows (its text runs on past the next faculty heading), those rows share it; a row with no requirement text or an unclear boundary is flagged `ambiguous_requirement_table` instead of borrowing criteria. Any programme code listed in a document but not read from its table is flagged too. (UTeM figures re-checked 22 November 2026.)
- UTeM parsing needs `pypdf==6.20.1` (pinned in `requirements.txt`); older versions lack layout extraction.

## MMU (added November 2026)

`--source mmu` (migration `0024`) reads Multimedia University's Yoast
`courses-sitemap.xml` and keeps foundation, diploma and bachelor pages under the
registered programme paths. Live dry-run on 22 November 2026: **57 / 57 valid**
(8 foundation, 14 diploma, 35 degree); reachable from US-hosted runners.

- Each page's `ul.course-dropdown` sections are read verbatim. "Entry Requirements"
  (Malaysian qualifications) is stored as Local with the route "All qualifications";
  a separate "Entry Requirements (International)" section is stored as International.
- Duration comes only from one explicit "N-year programme" phrase in the overview;
  pages without one, or with several values, leave it unknown.
- Career prospects that are comma-separated job titles become a list; descriptive
  sentences stay whole.
- The sitemap's broken `%academic%/bachelor-of-engineering-hons-electronics-majoring-in-optical-engineering`
  entry (HTTP 400) is outside the registered paths and is skipped.
- Same-named programmes on the Cyberjaya and Melaka campuses (e.g. Diploma in
  Information Technology) keep separate identities by URL; the faculty is kept as evidence.

## UTM (added November 2026)

`--source utm` (migration `0026`) reads Universiti Teknologi Malaysia's 2026/2027
requirement book (`BUKU-SYARAT-KEMASUKAN-UG-LOCAL`, a 151-page PDF linked from the
"Entry Requirements UG Malaysian" page) and its programme pages. Live dry-run on
22 November 2026: **56 / 56 programmes found and read, every table page read**;
reachable from US-hosted runners.

- The book's programme list (UPU code + Malay name) decides which programmes exist.
  Programme pages are matched by the UPU code they print and add the English name,
  faculty, overview, careers and the general Malaysian/international requirements.
  The one book programme with no matching page (UT6345003, Sarjana Muda Pengurusan;
  the website prints UT6345002) keeps its Malay name.
- Each faculty table is one merged requirement cell per route shared by all its
  programmes; up to seven routes (STPM, Matrikulasi/Asasi, STAM, Diploma, A Level/IB/
  AUSMAT, DVM, APEL.A). "TIDAK DITAWARKAN" (not offered) is kept verbatim.
- A row's printed code must agree with its name in the programme list; the book
  prints UT6214001 under the AI degree, which is therefore matched to UT6481007.
- PDF limits are 200 pages and 90 s for download and parsing (the book takes ~21 s).
- If a programme page cannot be fetched while matching, that programme is kept as
  published for the run instead of switching to its Malay name.

## Taylor's University (added November 2026)

`--source taylors` (migration `0028`) reads the site's XML sitemap and keeps
bachelor and diploma pages under `/en/study/explore-all-programmes/<field>/undergraduate/`.
Live dry-run on 22 November 2026: **48 / 48 valid** (46 degrees, 2 diplomas);
reachable from US-hosted runners.

- Foundation and pre-university programmes belong to Taylor's College (a separate
  site) and are not part of this source; the 1-year Advanced Diploma, the American
  Degree Transfer Program and information pages under the same path are excluded.
- Requirement accordions ("Prerequisites", "Entry Pathway"/"Entry Requirement(s)",
  "English Requirements", "Health Requirements") are read verbatim; each fully bold
  label ("A Level", "STPM", "UEC", "Foundation" ...) starts its own route.
- Entry pathways apply to every applicant and are stored as Local; the English
  requirements are split by the page into Local and International.
- Name comes from the page title, overview from the meta description, duration from
  the "Duration" fact ("3-year", "3.5-year"), faculty from "Offered by".

### Taylor's College

`--source taylors_college` (migration `0029`) uses the same adapter on
college.taylors.edu.my for the foundation and diploma programmes. Live dry-run on
22 November 2026: **14 / 14 valid** (7 foundation, 7 diploma). Requirements sit in a
"Qualifications" accordion (one route per bold qualification: SPM, O Level, UEC, STPM
...); a bold line starting with AND/OR stays in the route above. English requirements
are not split by audience on these pages and are stored as Local. Cambridge A Level,
AUSMAT and professional (ACCA) programmes are not foundation or diploma and are excluded.

## INTI International University & Colleges (added November 2026)

`--source inti` (migration `0032`) reads the WooCommerce "product" sitemap of
newinti.edu.my and keeps programme slugs starting with foundation, diploma or
bachelor. Live dry-run on 24 November 2026: **77 / 77 valid** (5 foundation,
26 diploma, 46 degree); reachable from US-hosted runners.

- Each page's "entry_requirements" tab is a set of two-column tables (entry level ->
  requirement) under optional bold pathway headings (e.g. Foundation in Science's
  Engineering / Bioscience / Computing pathways). Every row is one route, verbatim;
  header rows (also when repeated mid-tab) are skipped, and an "English" table becomes
  one "English requirements" section.
- Entry levels are stated for all applicants and stored as Local (the page notes that
  international applicants are assessed on equivalent qualifications).
- Duration is read only from "Programme can be completed in ..." on the structure tab;
  the campuses offering the programme are kept as evidence.
- Partner-only and transfer programmes (Hertfordshire/Coventry/SNHU "BA (Hons)",
  American and Australian transfer, Cambridge A Level, English and short courses) do
  not start with foundation/diploma/bachelor and are excluded.

## UMPSA (added November 2026)

`--source umpsa` (migration `0033`) reads Universiti Malaysia Pahang Al-Sultan
Abdullah's admission site: the "ug-programme" index links every undergraduate
programme page. Live dry-run on 24 November 2026: **50 / 50 valid** (8 diploma,
42 degree); reachable from US-hosted runners.

- Each "Entry Requirements" route is a button ("SPM Holder", "STPM Holder",
  "DKM / DLKM Holder" ...) paired by id with a pop-up holding its text, kept verbatim.
- The facts table (College, Durations, Campus, UPU Code, UMPSA code) sits inside a
  `<nav>` element, so it is read from the raw page; duration comes from the years in
  brackets ("8 Semester ( 4 Year )", "( 2 Year 9 Month )").
- Identity is the page path, not the printed UPU code: the site reuses UJ6523002
  (two Mechatronics pages) and UJ6521002 (Machining and Welding).
- Diplomas are recognised by their category folder (including the site's own
  "dipoma-computer-2"). Requirements are the Malaysian-student routes (Local).

## Sunway College (added November 2026)

`--source sunway_college` (migration `0034`) reads the college's XML sitemap and
keeps its diplomas plus the Sunway foundations and Monash University Foundation Year.
Live dry-run on 25 November 2026: **15 programmes (12 diploma, 3 foundation),
14 valid**; reachable from US-hosted runners.

- Each page's "Entry Requirements" table gives one route per cell (bold name, then
  requirement lines, verbatim). Only an "English Language Requirement" cell marked
  "For International Students only" is International; mixed cells stay Local.
- Eight sitemap entries (e.g. Diploma in Music, Nursing, Culinary Arts, Interior
  Design) are empty placeholders for programmes now run by Sunway University (no
  title, no requirements; one's canonical link points to university.sunway.edu.my,
  which did not resolve). Discovery fetches each page and skips those.
- Monash University Foundation Year covers several streams, so it is held with
  `unmapped_field` for an admin to choose its field rather than guessing one.

### IIUM (not added)

IIUM's requirement documents are image-only: the Asasi flipbook, the foundation guide
PDF (6 scanned pages, 13.7 MB) and the undergraduate requirements PDF (56 scanned
pages) contain no extractable text, and the web pages carry no per-programme
requirements. OCR could misread grades, so IIUM is not scraped.
