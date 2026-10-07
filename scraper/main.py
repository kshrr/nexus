"""Web discovery stages leads; monitoring refreshes admin-selected programmes only."""
from __future__ import annotations

from .discovery_models import DiscoverySettings, DiscoveryRunStats
from .discovery import RunBudget, run_discovery
from .monitor import run_monitoring
from .search import BraveSearchClient
import os
import uuid

import argparse
import sys
from datetime import date

from .db import (
    ScraperDbError,
    SupabaseClient,
    client_from_env,
    content_hash,
    prepare,
    redact,
)
from .fetch import Fetcher, FetchError
from .models import ScrapeStats, ScrapedScholarship
from .parsers.base import BaseParser
from .sources import REGISTRY, UNAVAILABLE, get_parsers
from .validate import RejectedRecord, summarise, validate


# GitHub Actions and the Windows console differ in default encoding, and
# scraped Malaysian text is not ASCII. Forcing UTF-8 here keeps a provider's
# own wording intact in the log rather than replacing characters with "?".
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def log(message: str) -> None:
    """Single logging point, so redaction cannot be forgotten at a call site."""
    print(redact(message), flush=True)


# -----------------------------------------------------------------------------
# extraction
# -----------------------------------------------------------------------------
def scrape_source(
    parser: BaseParser, fetcher: Fetcher, stats: ScrapeStats
) -> list[ScrapedScholarship]:
    """Fetch and extract every target page for one source."""
    log(f"\n--- {parser.source_id}: {parser.provider} ---")
    stats.sources.append(parser.source_id)

    try:
        index_html = fetcher.get(parser.index_url)
    except FetchError as exc:
        stats.error(f"{parser.source_id}: index unreachable: {exc}")
        log(f"  index unreachable: {exc}")
        return []

    targets = parser.discover(index_html)
    stats.discovered += len(targets)
    log(f"  discovered {len(targets)} target page(s) from one index")

    records: list[ScrapedScholarship] = []
    for url in targets:
        try:
            html = fetcher.get(url)
            found = parser.parse(html, url)
        except (FetchError, ValueError) as exc:
            stats.error(f"{parser.source_id}: {url}: {exc}")
            log(f"  SKIP {url}: {exc}")
            continue

        # One page can hold several programmes (BNM, YSD). Each is validated
        # and counted on its own; one bad record does not lose the others.
        for record in found:
            try:
                validate(
                    record,
                    today=date.today(),
                    expect_application_link=parser.publishes_application_links,
                )
            except RejectedRecord as exc:
                # Rejected records never reach the database -- that is the point
                # of rejection -- but the rejection itself is recorded.
                stats.error(f"{parser.source_id}: {url}: rejected: {exc}")
                log(f"  REJECT {url}: {exc}")
                continue

            if record.is_flagged:
                stats.flagged += 1
            records.append(prepare(record))
            log(f"  {summarise(record)}")
            for flag in record.flags:
                log(f"      flag: {flag}")

    return records


# -----------------------------------------------------------------------------
# reporting
# -----------------------------------------------------------------------------
def report_dry_run(client: SupabaseClient | None, records: list[ScrapedScholarship]) -> None:
    """Show what a real run WOULD do, without doing it."""
    log("\n=== DRY RUN: what a real run would do ===")
    if not records:
        log("  nothing extracted")
        return

    existing = {}
    if client is not None:
        try:
            existing = client.existing_by_hashes([r.source_hash for r in records])
        except ScraperDbError as exc:
            log(f"  (could not read existing scholarships: {exc})")

    for record in records:
        row = existing.get(record.source_hash)
        if row is None:
            action = "INSERT" if client is not None else "INSERT (no DB read)"
        elif row.is_manual:
            action = "SKIP -- administrator-managed (is_manual = true)"
        else:
            action = "UPDATE or leave unchanged (the database decides field-by-field)"
        log(f"  {action}")
        log(f"      {record.name}")
        log(f"      identity  {record.source_hash[:16]}...")
        log(f"      content   {content_hash(record)[:16]}...")
        log(f"      status    {'flagged' if record.is_flagged else record.status}")


def write_records(
    client: SupabaseClient, records: list[ScrapedScholarship], stats: ScrapeStats
) -> None:
    """Write each record, letting the database decide the outcome."""
    log("\n=== WRITING ===")
    for record in records:
        try:
            outcome = client.upsert(record)
        except ScraperDbError as exc:
            stats.error(f"upsert failed for {record.name}: {exc}")
            log(f"  FAILED {record.name}: {exc}")
            continue

        if outcome == "inserted":
            stats.inserted += 1
        elif outcome == "updated":
            stats.updated += 1
        elif outcome == "unchanged":
            stats.skipped_unchanged += 1
        elif outcome == "skipped_manual":
            stats.skipped_manual += 1
        log(f"  {outcome:<15} {record.name}")


# -----------------------------------------------------------------------------
# entry point
# -----------------------------------------------------------------------------
def main(argv: list[str] | None = None) -> int:
    ap=argparse.ArgumentParser(description='Nexus scholarship web discovery and selected monitoring')
    ap.add_argument('--mode',choices=('discovery','monitoring','combined'),default='combined')
    ap.add_argument('--request-id',default=None)
    ap.add_argument('--dry-run',action='store_true',help='fetch and preview; no database writes')
    ap.add_argument('--source',action='append',help='supported-parser diagnostic; requires --dry-run')
    ap.add_argument('--list-sources',action='store_true',help='list extraction helpers, not a discovery restriction')
    ap.add_argument('--triggered-by',choices=('schedule','manual'),default='schedule')
    ap.add_argument('--triggered-by-user',default=None)
    args=ap.parse_args(argv)
    if args.source and not args.dry_run: ap.error('--source is diagnostic only; use --dry-run. Publication requires admin Add to Nexus.')
    if args.list_sources:
        log('Supported extraction helpers (web discovery searches beyond these providers):')
        for name,cls in REGISTRY.items(): log(f'  {name}: {cls.provider}')
        return 0
    if args.request_id:
        try: uuid.UUID(args.request_id)
        except ValueError: ap.error('request-id must be a UUID')
    if args.source:
        try:
            records=[]
            for parser in get_parsers(args.source): records.extend(scrape_source(parser,Fetcher(),ScrapeStats()))
            report_dry_run(None,records)
            return 0
        except (KeyError,FetchError) as error: log(str(error)); return 1
    client=None; run_id=None
    stats=DiscoveryRunStats(mode=args.mode)
    try:
        try: client=client_from_env(require_service_role=True)
        except ScraperDbError:
            if not args.dry_run: raise
            log('Dry run without private database access: preview discovery only.')
        if not args.dry_run:
            run_id=client.begin_discovery_run(args.triggered_by,args.triggered_by_user,args.mode,args.request_id)
            if run_id is None: log('A crawl run is already in progress.'); return 3
        settings=client.discovery_settings() if client else DiscoverySettings()
        budget=RunBudget(settings); fetcher=Fetcher()
        db=PreviewDb(client) if args.dry_run else client
        if args.mode in ('monitoring','combined'):
            run_monitoring(db,fetcher,stats,budget,40 if args.mode=='combined' else settings.max_pages)
        if args.mode in ('discovery','combined'):
            run_discovery(db,BraveSearchClient(os.environ.get('BRAVE_SEARCH_API_KEY','')),fetcher,settings,stats,budget)
    except Exception as error:
        stats.error(redact(str(error))); log(f'Run error: {error}')
    finally:
        if run_id is not None and client is not None:
            try: client.finish_discovery_run(run_id,stats)
            except Exception as error: stats.error(redact(f'Could not finish crawl log: {error}')); log(f'Could not finish crawl log: {error}')
    log(stats.summary())
    for error in stats.errors: log(error)
    if args.dry_run: log('DRY RUN: no discovery, publication or run-log writes.')
    return 1 if stats.status=='failed' else 0

class PreviewDb:
    def __init__(self,client): self.client=client
    def selected_discoveries(self): return self.client.selected_discoveries() if self.client else iter([])
    def stage(self,candidate):
        log(f'Would stage: {candidate.record.get("name") or candidate.canonical_url} ({candidate.review_state})')
        return {'id':candidate.identity_key,'outcome':'created'}
    def monitor(self,id,candidate): log(f'Would monitor: {candidate.record.get("name")}'); return 'unchanged'
    def record_discovery_error(self,id,error): log(f'Monitor preview: {error}')

if __name__ == '__main__':
    sys.exit(main())