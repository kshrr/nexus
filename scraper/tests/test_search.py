import json
from pathlib import Path
import pytest
import requests
from scraper.search import BraveSearchClient,SearchError,canonicalise_url,discover_leads
from scraper.discovery_models import DiscoverySettings

class Response:
    def __init__(self,status=200,payload=None): self.status_code=status; self.payload=payload; self.closed=False
    def iter_content(self,chunk_size): yield json.dumps(self.payload).encode()
    def close(self): self.closed=True
class Session:
    def __init__(self,response): self.response=response; self.calls=[]
    def get(self,url,**kwargs): self.calls.append((url,kwargs)); return self.response

def test_brave_request_and_broad_results():
    payload=json.loads((Path(__file__).parent/'fixtures/brave_search.json').read_text())
    session=Session(Response(payload=payload)); client=BraveSearchClient('synthetic-test-key',session)
    results=client.search('Malaysia scholarship',freshness='pw')
    assert len({r.url.split('/')[2] for r in results})==8
    assert session.calls[0][0]=='https://api.search.brave.com/res/v1/web/search'
    assert session.calls[0][1]['params']=={'q':'Malaysia scholarship','count':20,'freshness':'pw'}
    assert session.calls[0][1]['headers']['X-Subscription-Token']=='synthetic-test-key'
    assert session.calls[0][1]['allow_redirects'] is False
    assert session.response.closed

@pytest.mark.parametrize('status,code',[(401,'NOT_CONFIGURED'),(403,'NOT_CONFIGURED'),(429,'RATE_LIMITED'),(500,'SEARCH_FAILED'),(302,'SEARCH_FAILED')])
def test_safe_errors(status,code):
    key='secret-that-must-not-be-logged'
    with pytest.raises(SearchError) as caught: BraveSearchClient(key,Session(Response(status,payload={'echo':key}))).search('scholarships')
    assert caught.value.code==code and key not in str(caught.value)

def test_missing_key_and_query_limits():
    with pytest.raises(SearchError,match='BRAVE_SEARCH_API_KEY'): BraveSearchClient('').search('scholarships')
    for query in ['x'*601,'word '*76]:
        with pytest.raises(SearchError,match='query'): BraveSearchClient('key',Session(Response())).search(query)

def test_empty_and_malformed_results():
    assert BraveSearchClient('key',Session(Response(payload={}))).search('scholarship')==[]
    with pytest.raises(SearchError): BraveSearchClient('key',Session(Response(payload={'web':{'results':'wrong'}}))).search('scholarship')
    class Broken(Session):
        def get(self,*args,**kwargs): raise requests.Timeout('key-echo')
    with pytest.raises(SearchError) as caught: BraveSearchClient('key-echo',Broken(None)).search('scholarship')
    assert 'key-echo' not in str(caught.value)

def test_budget_fairness_and_year():
    payload={'web':{'results':[{'url':f'https://provider{i}.example/award','title':str(i),'description':'lead'} for i in range(20)]}}
    session=Session(Response(payload=payload)); client=BraveSearchClient('key',session)
    settings=DiscoverySettings(queries=[f'query {i} {{year}}' for i in range(6)])
    leads=discover_leads(client,settings,2026)
    assert len(session.calls)==12 and len(leads)==20
    assert all('2026' in call[1]['params']['q'] for call in session.calls)
    assert sum(call[1]['params'].get('freshness')=='pw' for call in session.calls)==6
    assert not any(hasattr(lead,'new_intake') for lead in leads)
    with pytest.raises(SearchError): discover_leads(client,DiscoverySettings(queries=['bad {month}']),2026)

def test_canonical_identity():
    assert canonicalise_url('https://Provider.example/Scholarship?utm_source=x&intake=2026#top')=='https://provider.example/Scholarship?intake=2026'
    assert canonicalise_url('https://user@provider.example/') is None
    assert canonicalise_url('http://provider.example/') is None
    assert canonicalise_url('https://provider.example/a?intake=2025')!=canonicalise_url('https://provider.example/a?intake=2026')

def test_log_redacts_literal_brave_and_dispatch_keys(monkeypatch):
    from scraper.db import redact
    monkeypatch.setenv('BRAVE_SEARCH_API_KEY','synthetic-brave-secret')
    monkeypatch.setenv('GITHUB_DISPATCH_TOKEN','synthetic-dispatch-secret')
    assert redact('echo synthetic-brave-secret and synthetic-dispatch-secret')=='echo [redacted] and [redacted]'

def test_search_enforces_absolute_deadline_even_before_headers():
    import time,threading
    release=threading.Event()
    class Stalled(Session):
        def get(self,*args,**kwargs):release.wait(1);return Response(payload={})
    client=BraveSearchClient('test-key',Stalled(None));client.timeout=.02;start=time.monotonic()
    try:
        with pytest.raises(SearchError,match='timed out'):client.search('scholarships')
        assert time.monotonic()-start<.2
    finally:release.set()
