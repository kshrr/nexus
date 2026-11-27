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
    def consume_page(self,url,*,host_cap=True):
        host=urlsplit(url).hostname
        if not self.remaining or self.pages_used>=self.settings.max_pages or (host_cap and self.hosts[host]>=self.settings.max_pages_per_host) or url in self.visited: return False
        self.visited.add(url); self.pages_used+=1; self.hosts[host]+=1; return True

def fetch_document(fetcher,url,budget,*,host_cap=True):
    if url in budget.documents:
        doc=budget.documents[url]
        if isinstance(doc,Exception): raise doc
        return doc
    if not budget.consume_page(url,host_cap=host_cap): return None
    if hasattr(fetcher,'on_redirect'):
        def redirected(destination):
            if not budget.consume_page(destination,host_cap=host_cap): raise FetchError('Redirect exceeded the run page/host/time budget')
        fetcher.on_redirect=redirected
        fetcher.deadline=budget.started+budget.settings.work_seconds
    try:
        document=fetcher.get_document(url); budget.documents[url]=document
        return document
    except FetchError as error:
        budget.documents[url]=error; raise

def pdf_fetcher(fetcher,budget):
    """A fetch_pdf callable for extract_candidates that spends the run's page
    and time budget (not the per-host cap: an attachment belongs to a page the
    budget already admitted) and reuses a PDF already fetched this run."""
    def fetch(url):
        if url in budget.documents:
            doc=budget.documents[url]
            if isinstance(doc,Exception): raise doc
            return doc
        if not hasattr(fetcher,'get_pdf_document'): raise FetchError('PDF attachments are not supported by this fetcher')
        if not budget.consume_page(url,host_cap=False): raise FetchError('PDF attachment exceeded the run page/time budget')
        if hasattr(fetcher,'deadline'): fetcher.deadline=budget.started+budget.settings.work_seconds
        try:
            document=fetcher.get_pdf_document(url); budget.documents[url]=document
            return document
        except FetchError as error:
            budget.documents[url]=error; raise
    return fetch

def _stage_all(db,candidates,stats,budget,*,auto_publish=False):
    """Stage candidates for admin review. With auto_publish (the supported-
    provider pass only), each candidate a registered parser marked ready is
    offered for publication; the database re-checks readiness and keeps
    anything with review reasons in the queue. Web-search candidates are
    never auto-published."""
    for candidate in candidates:
        if not budget.remaining:break
        try:
            outcome=db.stage(candidate)
            if outcome['outcome']=='created': stats.candidates_created+=1
            else: stats.candidates_updated+=1
        except Exception as error:
            stats.error(redact(f'Staging failed: {error}')); continue
        if auto_publish and candidate.review_state=='ready' and candidate.evidence.get('parser') and hasattr(db,'auto_publish'):
            try:
                result=db.auto_publish(outcome['id'])
                if (result or {}).get('outcome')=='published': stats.auto_published+=1
            except Exception as error: stats.error(redact(f'Auto-publish failed: {error}'))

def run_known_sources(db,fetcher,stats,budget,parsers=None):
    """Visit every registered provider parser's own index each run.

    Broad search decides which unknown providers are found; it should not also
    decide whether MARA or JPA are looked at this week. Each parser's index and
    discovered targets are fetched and ONLY the parser's output is staged: an
    index page that is not itself a programme is never run through generic
    extraction. Pages count against the run's page and time budget, but not the
    per-host cap — a parser's own max_targets bounds its host instead. Results
    are admin-only staging like any discovery, never direct publication.
    """
    if parsers is None:
        from .sources import get_parsers
        parsers=get_parsers()
    for parser in parsers:
        if not budget.remaining: break
        try:
            index=fetch_document(fetcher,parser.index_url,budget,host_cap=False)
            if index is None: continue
            targets=parser.discover(index.html)
        except (FetchError,ValueError) as error:
            stats.error(redact(f'{parser.source_id} index: {error}')); continue
        for url in targets:
            if not budget.remaining: break
            try:
                document=index if url==parser.index_url else fetch_document(fetcher,url,budget,host_cap=False)
                if document is None: continue
                candidates=extract_candidates(document,None,datetime.now(timezone.utc),pdf_fetcher(fetcher,budget))
            except (FetchError,ValueError) as error:
                stats.error(redact(f'{parser.source_id} {url}: {error}')); continue
            _stage_all(db,candidates,stats,budget,auto_publish=True)

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
            candidates=extract_candidates(document,lead,datetime.now(timezone.utc),pdf_fetcher(fetcher,budget))
        except (FetchError,ValueError) as error:
            stats.error(redact(str(error)))
            candidates=extract_candidates(FetchedDocument('',url),lead,datetime.now(timezone.utc))
            for candidate in candidates: candidate.review_reasons.append(redact(str(error))); candidate.review_state='needs_review'
            document=None
        _stage_all(db,candidates,stats,budget)
        if depth==0 and document:
            # Children follow the initial broad leads, maintaining provider diversity.
            for child in programme_links(document): pending.append((SearchLead(child,query=lead.query),1))
