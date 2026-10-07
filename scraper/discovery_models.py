"""Shared data contracts for web discovery, review staging and run counters."""
from dataclasses import dataclass,field,asdict
from typing import Literal

RunMode=Literal['discovery','monitoring','combined']
DEFAULT_QUERIES=['Malaysia scholarship applications {year}','biasiswa permohonan {year}','undergraduate scholarships Malaysian students {year}','SPM scholarship sponsorship {year}','Malaysian foundation scholarship {year}','university scholarships Malaysia {year}']

@dataclass
class SearchLead:
    url: str
    title: str=''
    snippet: str=''
    query: str=''
    freshness: str | None=None

@dataclass
class DiscoveryCandidate:
    identity_key: str
    canonical_url: str
    programme_key: str
    record: dict
    criteria: list[dict]=field(default_factory=list)
    evidence: dict=field(default_factory=dict)
    review_reasons: list[str]=field(default_factory=list)
    review_state: str='needs_review'
    def to_payload(self): return asdict(self)

@dataclass
class DiscoverySettings:
    queries: list[str]=field(default_factory=lambda:list(DEFAULT_QUERIES))
    region: str='Malaysia'
    target_count: int=20
    max_search_requests: int=12
    max_pages: int=100
    max_pages_per_host: int=5
    work_seconds: int=1080
    def __post_init__(self):
        if not 1<=len(self.queries)<=6 or any(not isinstance(q,str) or not q.strip() for q in self.queries): raise ValueError('invalid discovery queries')
        for name,ceiling in [('max_search_requests',12),('max_pages',100),('max_pages_per_host',5),('work_seconds',1080),('target_count',1000)]:
            value=getattr(self,name)
            if not isinstance(value,int) or isinstance(value,bool) or not 1<=value<=ceiling: raise ValueError('invalid discovery limits')

@dataclass
class DiscoveryRunStats:
    mode: RunMode='combined'
    leads_found: int=0
    candidates_created: int=0
    candidates_updated: int=0
    monitored: int=0
    publications_updated: int=0
    unchanged: int=0
    skipped_manual: int=0
    failed: int=0
    errors: list[str]=field(default_factory=list)
    def error(self,message):
        self.failed+=1
        if len(self.errors)<25: self.errors.append(str(message)[:300])
    @property
    def status(self):
        progress=self.candidates_created+self.candidates_updated+self.monitored
        return ('partial' if progress else 'failed') if self.failed else 'success'
    def summary(self):
        return f'mode={self.mode} leads={self.leads_found} staged={self.candidates_created+self.candidates_updated} monitored={self.monitored} updated={self.publications_updated} failed={self.failed}'
