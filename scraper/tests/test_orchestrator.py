"""
Orchestration tests — scraper/main.py wiring, with the network stubbed.

Proves that scrape_source() routes each record to the right outcome:
extracted, skipped-with-a-recorded-error, or flagged-but-kept. The individual
stages have their own tests in test_pipeline.py.
"""

from __future__ import annotations

import pytest

from scraper.main import scrape_source
from scraper.models import ScrapedScholarship, ScrapeStats
from scraper.parsers.base import BaseParser
from scraper.sources import REGISTRY, UNAVAILABLE, get_parsers


class FakeFetcher:
    def __init__(self, pages: dict[str, str], errors: dict[str, Exception] | None = None):
        self.pages = pages
        self.errors = errors or {}
        self.requested: list[str] = []

    def get(self, url: str) -> str:
        self.requested.append(url)
        if url in self.errors:
            raise self.errors[url]
        return self.pages[url]


class FakeParser(BaseParser):
    source_id = "fake"
    provider = "Fake Provider"
    index_url = "https://fake.example.my/index"
    path_prefix = "https://fake.example.my/"
    publishes_application_links = False

    def discover(self, html: str) -> list[str]:
        return self.guard(html.split())

    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        if "notaprogramme" in html:
            raise ValueError("not a programme page")
        return [
            ScrapedScholarship(
                name=html.strip() or "Untitled",
                provider=self.provider,
                source_url=url,
                description="A sponsorship for SPM leavers pursuing a first degree in any field.",
                education_levels=["spm"] if "nolevel" not in html else [],
            )
        ]


def test_extracts_every_valid_target():
    parser = FakeParser()
    fetcher = FakeFetcher(
        {
            parser.index_url: "https://fake.example.my/a https://fake.example.my/b",
            "https://fake.example.my/a": "Programme A",
            "https://fake.example.my/b": "Programme B",
        }
    )
    stats = ScrapeStats()
    records = scrape_source(parser, fetcher, stats)
    assert [r.name for r in records] == ["Programme A", "Programme B"]
    assert stats.discovered == 2
    assert stats.failed == 0


def test_a_fetch_error_on_one_target_is_recorded_and_the_run_continues():
    from scraper.fetch import FetchError

    parser = FakeParser()
    fetcher = FakeFetcher(
        {
            parser.index_url: "https://fake.example.my/a https://fake.example.my/b",
            "https://fake.example.my/b": "Programme B",
        },
        errors={"https://fake.example.my/a": FetchError("HTTP 500")},
    )
    stats = ScrapeStats()
    records = scrape_source(parser, fetcher, stats)
    assert [r.name for r in records] == ["Programme B"]
    assert stats.failed == 1
    assert any("500" in e for e in stats.errors)


def test_a_page_that_is_not_a_programme_is_skipped():
    parser = FakeParser()
    fetcher = FakeFetcher(
        {
            parser.index_url: "https://fake.example.my/a",
            "https://fake.example.my/a": "notaprogramme",
        }
    )
    stats = ScrapeStats()
    records = scrape_source(parser, fetcher, stats)
    assert records == []
    assert stats.failed == 1


def test_an_index_that_cannot_be_fetched_ends_the_source_cleanly():
    from scraper.fetch import FetchError

    parser = FakeParser()
    fetcher = FakeFetcher({}, errors={parser.index_url: FetchError("HTTP 000")})
    stats = ScrapeStats()
    records = scrape_source(parser, fetcher, stats)
    assert records == []
    assert stats.failed == 1
    assert any("index unreachable" in e for e in stats.errors)


def test_a_flagged_record_is_kept_and_counted():
    parser = FakeParser()
    fetcher = FakeFetcher(
        {
            parser.index_url: "https://fake.example.my/a",
            "https://fake.example.my/a": "Programme A nolevel",
        }
    )
    stats = ScrapeStats()
    records = scrape_source(parser, fetcher, stats)
    # "nolevel" → no education level → validate flags it, but it is still stored
    assert len(records) == 1
    assert records[0].is_flagged
    assert stats.flagged == 1


def test_records_get_an_identity_hash_and_scrape_time():
    parser = FakeParser()
    fetcher = FakeFetcher(
        {
            parser.index_url: "https://fake.example.my/a",
            "https://fake.example.my/a": "Programme A",
        }
    )
    records = scrape_source(parser, fetcher, ScrapeStats())
    assert records[0].source_hash is not None
    assert records[0].scraped_at is not None


class TestRegistry:
    def test_get_parsers_returns_all_registered_by_default(self):
        ids = {p.source_id for p in get_parsers()}
        assert {"jpa", "petronas", "ysd", "khazanah"} <= ids

    def test_an_unknown_source_raises_with_a_helpful_hint(self):
        with pytest.raises(KeyError, match="mara"):
            get_parsers(["mara"])

    def test_mara_is_listed_as_unavailable_with_a_reason(self):
        assert "does not resolve" in UNAVAILABLE["mara"]

    def test_bnm_is_unavailable_because_of_anti_bot_protection(self):
        # A source we could reach with a browser but whose WAF blocks the
        # scraper's HTTP client. The brief says report it, do not bypass it.
        assert "bnm" in UNAVAILABLE
        assert "403" in UNAVAILABLE["bnm"] or "WAF" in UNAVAILABLE["bnm"]

    def test_an_unavailable_source_is_not_also_registered(self):
        assert not (set(UNAVAILABLE) & set(REGISTRY))

def test_combined_missing_search_key_still_monitors_and_finishes(monkeypatch):
    from scraper import main as runner
    from scraper.discovery_models import DiscoverySettings
    class DB:
        def discovery_settings(self): return DiscoverySettings()
        def begin_discovery_run(self,*args): return 'run'
        def selected_discoveries(self): return iter([])
        def finish_discovery_run(self,id,stats): self.stats=stats
    db=DB(); monitored=[]
    monkeypatch.setattr(runner,'client_from_env',lambda **kwargs:db)
    monkeypatch.delenv('BRAVE_SEARCH_API_KEY',raising=False)
    def monitor(db,fetcher,stats,budget,max_pages): monitored.append(True); stats.monitored+=1
    monkeypatch.setattr(runner,'run_monitoring',monitor)
    assert runner.main(['--mode','combined'])==0
    assert monitored==[True] and db.stats.status=='partial'
    assert any('BRAVE_SEARCH_API_KEY' in error for error in db.stats.errors)

def test_runner_lock_and_finish_on_exception(monkeypatch):
    from scraper import main as runner
    from scraper.discovery_models import DiscoverySettings
    class DB:
        lock=None; stats=None
        def begin_discovery_run(self,*args): return self.lock
        def discovery_settings(self): return DiscoverySettings()
        def finish_discovery_run(self,id,stats): self.stats=stats
    db=DB(); monkeypatch.setattr(runner,'client_from_env',lambda **kwargs:db)
    assert runner.main(['--mode','monitoring'])==3 and db.stats is None
    db.lock='run'
    def broken(*args,**kwargs): raise ValueError('bad extraction')
    monkeypatch.setattr(runner,'run_monitoring',broken)
    assert runner.main(['--mode','monitoring'])==1 and db.stats.status=='failed'

def test_source_diagnostic_cannot_publish():
    from scraper import main as runner
    with pytest.raises(SystemExit) as caught: runner.main(['--source','jpa'])
    assert caught.value.code==2
