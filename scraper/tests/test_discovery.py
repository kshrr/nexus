from datetime import datetime,timezone
from pathlib import Path
import pytest
from scraper.discovery import RunBudget,run_discovery
from scraper.discovery_models import DiscoverySettings,DiscoveryRunStats,SearchLead
from scraper.search import SearchError,BraveSearchClient
from scraper.public_http import FetchedDocument,FetchError

HTML=(Path(__file__).parent/'fixtures/generic_scholarship.html').read_text()
class DB:
    def __init__(self): self.staged={}; self.publication_writes=[]
    def stage(self,item):
        old=item.identity_key in self.staged; self.staged[item.identity_key]=item
        return {'id':item.identity_key,'outcome':'updated' if old else 'created'}
class Search:
    api_key='test'; errors=[]
    def __init__(self,leads): self.leads=leads; self.errors=[]
    def search(self,*args,**kwargs): return self.leads
class Fetch:
    def __init__(self,html=HTML): self.html=html; self.requested=[]
    def get_document(self,url): self.requested.append(url); return FetchedDocument(self.html,url)

def test_25_broad_candidates_staged_never_published():
    db=DB(); fetch=Fetch(); settings=DiscoverySettings()
    search=Search([SearchLead(f'https://provider{i}.example/award') for i in range(25)])
    stats=DiscoveryRunStats(); budget=RunBudget(settings)
    run_discovery(db,search,fetch,settings,stats,budget)
    assert len(db.staged)==25 and db.publication_writes==[]
    assert stats.candidates_created==25 and stats.failed==0
    run_discovery(db,search,fetch,settings,stats,RunBudget(settings))
    assert len(db.staged)==25 and stats.candidates_updated==25

def test_page_host_and_time_bounds():
    settings=DiscoverySettings(max_pages=3,max_pages_per_host=2)
    db=DB(); fetch=Fetch(); stats=DiscoveryRunStats()
    leads=[SearchLead(f'https://provider.example/{i}') for i in range(10)]+[SearchLead('https://other.example/award')]
    budget=RunBudget(settings)
    run_discovery(db,Search(leads),fetch,settings,stats,budget)
    assert len(fetch.requested)==3 and sum('provider.example' in u for u in fetch.requested)==2
    clock=[0]; budget=RunBudget(DiscoverySettings(),monotonic=lambda:clock[0]); clock[0]=1080
    assert not budget.consume_page('https://new.example/') and not budget.consume_search()

def test_one_hop_only_and_failed_page_retained():
    html='<main><h1>Scholarship directory</h1><a href="/child">Child scholarship</a></main>'
    class NextFetch(Fetch):
        def get_document(self,url):
            self.requested.append(url)
            if url.endswith('/blocked'): raise FetchError('HTTP 403')
            return FetchedDocument(html.replace('/child','/grandchild') if url.endswith('/child') else html,url)
    db=DB(); fetch=NextFetch(); settings=DiscoverySettings(); stats=DiscoveryRunStats()
    run_discovery(db,Search([SearchLead('https://provider.example/index'),SearchLead('https://provider.example/blocked')]),fetch,settings,stats,RunBudget(settings))
    assert 'https://provider.example/child' in fetch.requested and not any('grandchild' in u for u in fetch.requested)
    assert stats.failed==1 and stats.status=='partial'
    assert any('HTTP 403' in reason for item in db.staged.values() for reason in item.review_reasons)

def test_missing_key_no_provider_fallback():
    db=DB(); fetch=Fetch(); settings=DiscoverySettings(); stats=DiscoveryRunStats()
    run_discovery(db,BraveSearchClient(''),fetch,settings,stats,RunBudget(settings))
    assert stats.failed>0 and stats.status=='failed'
    assert 'BRAVE_SEARCH_API_KEY' in stats.errors[0] and fetch.requested==[]

def test_staging_stops_when_work_budget_exhausted_between_programmes():
    clock=[0];settings=DiscoverySettings();stats=DiscoveryRunStats()
    html=(Path(__file__).parent/'fixtures/multi_scholarships.html').read_text()
    class SlowDB(DB):
        def stage(self,item):result=super().stage(item);clock[0]=1080;return result
    db=SlowDB();run_discovery(db,Search([SearchLead('https://bright.example/awards')]),Fetch(html),settings,stats,RunBudget(settings,monotonic=lambda:clock[0]))
    assert stats.candidates_created==1

# -- known providers: visited every run, independent of what search returns --
from scraper.discovery import run_known_sources
from scraper.parsers.mara import MaraParser,FINANCING,TARGETS
from scraper.parsers.ysd import YsdParser

FIXTURES=Path(__file__).parent/'fixtures'
MARA_PAGES={FINANCING:'mara_financing_index.html',TARGETS[0]:'mara_preparatory.html',TARGETS[1]:'mara_diploma_degree.html'}
class MapFetch:
    def __init__(self,pages): self.pages=pages; self.requested=[]
    def get_document(self,url):
        self.requested.append(url)
        if url not in self.pages: raise FetchError('HTTP 404')
        return FetchedDocument((FIXTURES/self.pages[url]).read_text(encoding='utf-8'),url)

def test_known_sources_stage_only_parser_output_not_the_index():
    db=DB(); fetch=MapFetch(MARA_PAGES); stats=DiscoveryRunStats(); settings=DiscoverySettings()
    run_known_sources(db,fetch,stats,RunBudget(settings),parsers=[MaraParser()])
    names=sorted(item.record['name'] for item in db.staged.values())
    assert names==['Excellent Student Program (IPMa)','Tertiary Education Loan Program (TESP)','Young Talent Development Program (YTP)']
    assert all(item.evidence.get('parser')=='mara' for item in db.staged.values())
    assert fetch.requested==[FINANCING,*TARGETS] and stats.failed==0 and db.publication_writes==[]

def test_known_source_whose_index_is_its_target_is_fetched_once():
    db=DB(); parser=YsdParser(); fetch=MapFetch({parser.index_url:'ysd_scholarship.html'}); stats=DiscoveryRunStats()
    run_known_sources(db,fetch,stats,RunBudget(DiscoverySettings()),parsers=[parser])
    assert fetch.requested==[parser.index_url] and stats.candidates_created>=5

def test_known_sources_bypass_host_cap_but_not_page_budget():
    settings=DiscoverySettings(max_pages_per_host=1)
    db=DB(); fetch=MapFetch(MARA_PAGES); stats=DiscoveryRunStats()
    run_known_sources(db,fetch,stats,RunBudget(settings),parsers=[MaraParser()])
    assert len(fetch.requested)==3
    settings=DiscoverySettings(max_pages=2); fetch=MapFetch(MARA_PAGES)
    run_known_sources(DB(),fetch,DiscoveryRunStats(),RunBudget(settings),parsers=[MaraParser()])
    assert len(fetch.requested)==2

def test_a_failed_known_source_is_logged_and_the_next_one_still_runs():
    db=DB(); ysd=YsdParser(); fetch=MapFetch({ysd.index_url:'ysd_scholarship.html'}); stats=DiscoveryRunStats()
    run_known_sources(db,fetch,stats,RunBudget(DiscoverySettings()),parsers=[MaraParser(),ysd])
    assert stats.failed==1 and 'mara index' in stats.errors[0] and stats.candidates_created>=5
    assert not any('mara.gov.my' in item.canonical_url for item in db.staged.values())

def test_failed_fetch_of_a_known_parser_page_is_staged_for_review_not_fatal():
    # Before: the empty placeholder document went to the MARA parser, which
    # raised inside run_discovery's error handler and ended discovery early.
    db=DB(); settings=DiscoverySettings(); stats=DiscoveryRunStats()
    class Failing(Fetch):
        def get_document(self,url):
            self.requested.append(url)
            if 'mara.gov.my' in url: raise FetchError('HTTP 403')
            return FetchedDocument(self.html,url)
    leads=[SearchLead(TARGETS[0]),SearchLead('https://provider.example/award')]
    run_discovery(db,Search(leads),Failing(),settings,stats,RunBudget(settings))
    assert any('HTTP 403' in r for item in db.staged.values() for r in item.review_reasons)
    assert any(item.canonical_url=='https://provider.example/award' for item in db.staged.values())

def test_pdf_fetcher_spends_the_budget_once_per_pdf():
    from scraper.discovery import pdf_fetcher
    calls=[]
    class P:
        def get_pdf_document(self,url): calls.append(url); return 'doc'
    budget=RunBudget(DiscoverySettings(max_pages_per_host=1)); fetch=pdf_fetcher(P(),budget)
    assert fetch('https://x.example/a.pdf')=='doc' and fetch('https://x.example/a.pdf')=='doc'
    assert calls==['https://x.example/a.pdf'] and budget.pages_used==1

# -- auto-publication of supported-provider candidates -----------------------
class PublishingDB(DB):
    def __init__(self): super().__init__(); self.offered=[]
    def auto_publish(self,id):
        self.offered.append(id)
        return {'outcome':'published'}

def test_known_sources_offer_ready_parser_candidates_for_publication():
    db=PublishingDB(); stats=DiscoveryRunStats()
    run_known_sources(db,MapFetch(MARA_PAGES),stats,RunBudget(DiscoverySettings()),parsers=[MaraParser()])
    assert len(db.offered)==3 and set(db.offered)==set(db.staged)
    assert stats.auto_published==3 and 'auto_published=3' in stats.summary()

def test_needs_review_parser_candidates_are_not_offered():
    from scraper.parsers.yayasan_sarawak import YayasanSarawakParser,TARGETS as YS
    db=PublishingDB(); stats=DiscoveryRunStats()
    pages={YS[0]:'yayasan_sarawak_biasiswa.html',YS[1]:'yayasan_sarawak_pinjaman.html'}
    run_known_sources(db,MapFetch(pages),stats,RunBudget(DiscoverySettings()),parsers=[YayasanSarawakParser()])
    review={k for k,item in db.staged.items() if item.review_state!='ready'}
    assert review and not (review & set(db.offered))  # e.g. Overseas Education Loan: no stated level
    assert stats.auto_published==len(db.offered)==len(db.staged)-len(review)

def test_web_search_candidates_are_never_auto_published():
    db=PublishingDB(); settings=DiscoverySettings(); stats=DiscoveryRunStats()
    run_discovery(db,Search([SearchLead('https://provider.example/award')]),Fetch(),settings,stats,RunBudget(settings))
    assert db.staged and db.offered==[] and stats.auto_published==0

def test_an_auto_publish_failure_is_logged_and_staging_continues():
    class Failing(PublishingDB):
        def auto_publish(self,id): raise RuntimeError('HTTP 500')
    db=Failing(); stats=DiscoveryRunStats()
    run_known_sources(db,MapFetch(MARA_PAGES),stats,RunBudget(DiscoverySettings()),parsers=[MaraParser()])
    assert len(db.staged)==3 and stats.failed==3 and 'Auto-publish failed' in stats.errors[0]
