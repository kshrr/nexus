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
