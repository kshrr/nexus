"""Bounded search -> official-page extraction -> admin-only staging."""
import time
from collections import defaultdict,deque
from datetime import datetime,timezone
from urllib.parse import urlsplit
from .discovery_models import DiscoverySettings,DiscoveryRunStats,SearchLead
from .discovery_extract import extract_candidates,programme_links
from .search import discover_leads,canonicalise_url,SearchError
from .public_http import FetchedDocument,FetchError
from .db import redact

class RunBudget:
    def __init__(self,settings: DiscoverySettings,monotonic=time.monotonic):
        self.settings=settings; self.clock=monotonic; self.started=self.clock()
        self.pages_used=0; self.searches_used=0; self.hosts=defaultdict(int); self.visited=set(); self.documents={}
    @property
    def remaining(self): return max(0,self.settings.work_seconds-(self.clock()-self.started))
    def consume_search(self):
        if not self.remaining or self.searches_used>=self.settings.max_search_requests: return False
        self.searches_used+=1; return True
    def consume_page(self,url):
        host=urlsplit(url).hostname
        if not self.remaining or self.pages_used>=self.settings.max_pages or self.hosts[host]>=self.settings.max_pages_per_host or url in self.visited: return False
        self.visited.add(url); self.pages_used+=1; self.hosts[host]+=1; return True

def fetch_document(fetcher,url,budget):
    if url in budget.documents:
        doc=budget.documents[url]
        if isinstance(doc,Exception): raise doc
        return doc
    if not budget.consume_page(url): return None
    if hasattr(fetcher,'on_redirect'):
        def redirected(destination):
            if not budget.consume_page(destination): raise FetchError('Redirect exceeded the run page/host/time budget')
        fetcher.on_redirect=redirected
        fetcher.deadline=budget.started+budget.settings.work_seconds
    try:
        document=fetcher.get_document(url); budget.documents[url]=document
        return document
    except FetchError as error:
        budget.documents[url]=error; raise

def run_discovery(db,search,fetcher,settings,stats,budget):
    try: leads=discover_leads(search,settings,datetime.now(timezone.utc).year,budget=budget)
    except SearchError as error:
        stats.error(redact(str(error))); return
    for error in search.errors: stats.error(redact(error))
    stats.leads_found+=len(leads)
    pending=deque((lead,0) for lead in leads); processed=set()
    while pending and budget.remaining:
        lead,depth=pending.popleft(); url=canonicalise_url(lead.url)
        if not url or url in processed: continue
        processed.add(url)
        try:
            document=fetch_document(fetcher,url,budget)
            if document is None: continue
            candidates=extract_candidates(document,lead,datetime.now(timezone.utc))
        except (FetchError,ValueError) as error:
            stats.error(redact(str(error)))
            candidates=extract_candidates(FetchedDocument('',url),lead,datetime.now(timezone.utc))
            for candidate in candidates: candidate.review_reasons.append(redact(str(error))); candidate.review_state='needs_review'
            document=None
        for candidate in candidates:
            if not budget.remaining:break
            try:
                outcome=db.stage(candidate)
                if outcome['outcome']=='created': stats.candidates_created+=1
                else: stats.candidates_updated+=1
            except Exception as error: stats.error(redact(f'Staging failed: {error}'))
        if depth==0 and document:
            # Children follow the initial broad leads, maintaining provider diversity.
            for child in programme_links(document): pending.append((SearchLead(child,query=lead.query),1))
