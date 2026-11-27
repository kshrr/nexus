import pytest
from scraper.courses import run_course_source
from scraper.course_models import CourseCandidate
from scraper.public_http import FetchedDocument


def test_registry_rejects_unknown_source_and_spoofed_host():
    from scraper.course_sources import get_source
    assert get_source('utem').canonical_url('https://www.utem.edu.my/en/undergraduate.html') == 'https://www.utem.edu.my/en/undergraduate.html'
    for url in ['https://www.utem.edu.my.evil.org/en/undergraduate.html', 'https://www.utem.edu.my/en/undergraduate.html?pid=1', 'http://www.utem.edu.my/en/undergraduate.html', 'https://user@www.utem.edu.my/en/undergraduate.html', 'https://www.utem.edu.my/en/other.html']:
        with pytest.raises(ValueError):
            get_source('utem').canonical_url(url)
    for retired in ('unimap', 'usim'):
        with pytest.raises(ValueError):
            get_source(retired)
    with pytest.raises(ValueError):
        get_source('other')


def test_non_faculty_adapter_shared_fetch_cache_and_failure_identity():
    from scraper.course_adapter import ProgrammeReference, SourceFailure
    from scraper.course_sources import get_source
    url = 'https://www.unisza.edu.my/our-faculties/foundation-in-science-and-medicine'
    other = 'https://www.unisza.edu.my/our-faculties/foundation-in-science-and-technology'
    class Adapter:
        source = 'unisza'
        canonical_url = get_source('unisza').canonical_url
        def discover(self, fetch):
            yield ProgrammeReference('foundation:73', url, 'foundation', {})
            yield SourceFailure('https://www.unisza.edu.my/wp-sitemap-posts-our-faculties-1.xml', 'listing unavailable')
            yield ProgrammeReference('foundation:74', other, 'foundation', {})
        def parse(self, ref, fetch):
            fetch(ref.source_url)
            fetch(ref.source_url)
            if ref.programme_key.endswith('74'):
                raise ValueError('broken programme')
            return CourseCandidate('unisza', ref.programme_key, ref.source_url, {'pathway_type': 'foundation'})
    class Fetcher:
        def __init__(self): self.requested = []
        def get_document(self, address):
            self.requested.append(address)
            return FetchedDocument('<h1>Programme</h1>', address)
    class Db:
        def __init__(self): self.calls = []
        def ingest(self, candidate):
            self.calls.append(candidate)
            return {'outcome': 'fetch_failed' if candidate.error else 'inserted'}
    fetcher, db = Fetcher(), Db()
    summary = run_course_source(Adapter(), fetcher, db, dry_run=False)
    assert summary.found == 2
    assert summary.inserted == 1
    assert summary.coverage_complete is False
    assert fetcher.requested.count(url) == 1
    assert db.calls[-1].programme_key == 'foundation:74'
    assert db.calls[-1].error == 'broken programme'


def test_discovery_budget_keeps_already_discovered_references():
    from scraper.course_adapter import ProgrammeReference
    from scraper.course_sources import get_source
    class Adapter:
        source = 'unisza'
        canonical_url = get_source('unisza').canonical_url
        def discover(self, fetch):
            yield ProgrammeReference('foundation:73', 'https://www.unisza.edu.my/our-faculties/foundation-in-science-and-medicine', 'foundation', {})
            fetch('https://www.unisza.edu.my/wp-sitemap-posts-our-faculties-1.xml')
    summary = run_course_source(Adapter(), object(), None, dry_run=True, max_pages=0)
    assert summary.found == 1
    assert summary.coverage_complete is False


def test_unreachable_page_of_a_published_course_is_kept_not_failed():
    from scraper.course_adapter import ProgrammeReference
    from scraper.course_sources import get_source
    published = 'https://www.unisza.edu.my/our-faculties/foundation-in-science-and-medicine'
    new = 'https://www.unisza.edu.my/our-faculties/foundation-in-science-and-technology'
    class Adapter:
        source = 'unisza'
        canonical_url = get_source('unisza').canonical_url
        def discover(self, fetch):
            yield ProgrammeReference('foundation:published', published, 'foundation', {})
            yield ProgrammeReference('foundation:new', new, 'foundation', {})
        def parse(self, ref, fetch):
            raise ValueError('HTTPS request failed')
    class Db:
        def ingest(self, candidate):
            # The database returns the existing course for a previously published programme.
            return {'outcome': 'fetch_failed', 'course_id': 'c1' if candidate.programme_key.endswith('published') else None}
    summary = run_course_source(Adapter(), object(), Db(), dry_run=False)
    assert (summary.kept_unchecked, summary.unchanged, summary.fetch_failed) == (1, 1, 1)
    assert summary.coverage_complete is False  # the never-published programme is a real gap
    assert any('kept as they are' in e for e in summary.errors)
    assert not any('foundation-in-science-and-medicine' in e for e in summary.coverage_issues)

    class OnlyPublished(Adapter):
        def discover(self, fetch):
            yield ProgrammeReference('foundation:published', published, 'foundation', {})
    summary = run_course_source(OnlyPublished(), object(), Db(), dry_run=False)
    assert summary.status == 'completed' and summary.coverage_complete and summary.fetch_failed == 0


def test_sources_can_ask_for_a_longer_crawl_delay(monkeypatch):
    from scraper import courses
    delays = {}
    def operation(adapter, fetcher, db, **kwargs):
        delays[adapter.source] = fetcher.delay
    monkeypatch.setattr(courses, 'run_course_source', operation)
    for source in ('unisza', 'um'):
        courses.main(['--source', source, '--dry-run'])
    assert delays == {'unisza': 5, 'um': 2.0}
