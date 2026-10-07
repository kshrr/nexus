from pathlib import Path
from datetime import datetime,timezone
from scraper.discovery import RunBudget
from scraper.discovery_models import DiscoverySettings,DiscoveryRunStats
from scraper.discovery_extract import extract_candidates
from scraper.public_http import FetchedDocument,FetchError
from scraper.monitor import run_monitoring

HTML=(Path(__file__).parent/'fixtures/multi_scholarships.html').read_text()
DOC=FetchedDocument(HTML,'https://bright.example/awards')
ITEMS=extract_candidates(DOC,None,datetime.now(timezone.utc))

class DB:
    def __init__(self,key=None):
        self.rows=[{'id':'selected','identity_key':key or ITEMS[1].identity_key,'canonical_url':DOC.final_url,'approved_source_url':DOC.final_url,'programme_key':'arts','extracted_record':ITEMS[1].record,'aliases':[]}]
        self.writes=[]; self.errors=[];self.publications=[]
    def selected_discoveries(self): return iter(self.rows)
    def monitor(self,id,item):
        self.writes.append((id,item))
        if item.review_state!='ready':return 'needs_review'
        self.publications.append((id,item));return 'updated'
    def record_discovery_error(self,id,error): self.errors.append((id,error))
class Fetch:
    def __init__(self,error=None): self.calls=[]; self.error=error
    def get_document(self,url):
        self.calls.append(url)
        if self.error: raise self.error
        return DOC

def test_selected_programme_matches_not_first():
    db=DB(); fetch=Fetch(); stats=DiscoveryRunStats(mode='monitoring')
    run_monitoring(db,fetch,stats,RunBudget(DiscoverySettings()),100)
    assert fetch.calls==[DOC.final_url]
    assert db.writes[0][1].record['name']=='Arts Scholarship'
    assert stats.monitored==1 and stats.publications_updated==1

def test_failed_source_retained_changed_identity_staged_for_review():
    db=DB();stats=DiscoveryRunStats();run_monitoring(db,Fetch(FetchError('HTTP 403')),stats,RunBudget(DiscoverySettings()),100)
    assert db.writes==[] and len(db.errors)==1 and stats.failed==1
    db=DB('unknown-identity');stats=DiscoveryRunStats();run_monitoring(db,Fetch(),stats,RunBudget(DiscoverySettings()),100)
    assert db.publications==[] and db.writes[0][1].review_state=='needs_review'

def test_monitor_budget_is_bounded():
    db=DB(); db.rows*=100; fetch=Fetch(); stats=DiscoveryRunStats()
    run_monitoring(db,fetch,stats,RunBudget(DiscoverySettings(max_pages_per_host=2)),40)
    assert len(fetch.calls)<=2

def test_redirect_is_staged_for_review_without_publishing_new_identity():
    db=DB()
    class RedirectFetch(Fetch):
        def get_document(self,url): return FetchedDocument(HTML,'https://new-provider.example/moved-awards')
    stats=DiscoveryRunStats();run_monitoring(db,RedirectFetch(),stats,RunBudget(DiscoverySettings()),100)
    assert len(db.writes)==1
    snapshot=db.writes[0][1]
    assert snapshot.identity_key==db.rows[0]['identity_key']
    assert snapshot.record['source_url']=='https://new-provider.example/moved-awards'
    assert snapshot.review_state=='needs_review'
    assert snapshot.evidence['observed_identity_key']!=snapshot.identity_key
