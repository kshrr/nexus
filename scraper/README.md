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

The existing JPA, PETRONAS, YSD and Khazanah parsers remain extraction helpers, not a discovery restriction. Unknown provider domains use evidence-based HTML extraction. Incomplete, suspicious, closed, blocked, PDF and JavaScript-only pages have honest review/fetch reasons. No deadlines, amounts, levels or scholarship examples are invented.

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
