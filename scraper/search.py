"""Bounded Brave web search. Results are leads, not scholarship records."""
import json
import re
import time
import queue
import threading
from itertools import zip_longest
from urllib.parse import urlsplit,urlunsplit,parse_qsl,urlencode
import requests
from .discovery_models import SearchLead,DiscoverySettings
from .sanitise import clean_text

class SearchError(RuntimeError):
    def __init__(self,code,safe_message): self.code=code; super().__init__(safe_message)

def canonicalise_url(url):
    try:
        if not isinstance(url,str) or len(url)>2000 or re.search(r'[\s\\\x00-\x1f]',url): return None
        parts=urlsplit(url)
        if parts.scheme!='https' or not parts.hostname or parts.username is not None or parts.password is not None or parts.port not in (None,443): return None
        host=parts.hostname.lower().encode('idna').decode('ascii').rstrip('.')
        authority=f'[{host}]' if ':' in host else host
        pairs=[(key,value) for key,value in parse_qsl(parts.query,keep_blank_values=True) if not key.lower().startswith('utm_') and key.lower() not in ('fbclid','gclid','msclkid','mc_cid','mc_eid')]
        return urlunsplit(('https',authority,parts.path or '/',urlencode(sorted(pairs)),''))
    except (ValueError,UnicodeError): return None

class BraveSearchClient:
    def __init__(self,api_key,session=None):
        self.api_key=api_key; self.session=session or requests.Session(); self.errors=[]; self.timeout=25
    def search(self,query,*,freshness=None,count=20):
        if not self.api_key: raise SearchError('NOT_CONFIGURED','Configure BRAVE_SEARCH_API_KEY in GitHub Actions secrets for web discovery.')
        if not query.strip() or len(query)>600 or len(query.split())>75 or not 1<=count<=20: raise SearchError('INVALID_QUERY','Search query exceeds supported limits.')
        deadline=time.monotonic()+self.timeout;results=queue.Queue(maxsize=1);cancelled=threading.Event()
        def work():
            try:results.put((True,self._search(query,freshness,count,deadline,cancelled)))
            except SearchError as error:results.put((False,error))
            except Exception:results.put((False,SearchError('SEARCH_FAILED','Brave Search request failed.')))
        threading.Thread(target=work,daemon=True).start()
        try:ok,value=results.get(timeout=max(.001,deadline-time.monotonic()))
        except queue.Empty:
            cancelled.set();raise SearchError('SEARCH_FAILED','Brave Search request timed out.') from None
        if not ok:raise value
        return value
    def _search(self,query,freshness,count,deadline,cancelled):
        def check_time():
            if cancelled.is_set() or time.monotonic()>=deadline:raise SearchError('SEARCH_FAILED','Brave Search request timed out.')
        params={'q':query,'count':count}
        if freshness: params['freshness']=freshness
        response=None
        try:
            check_time()
            response=self.session.get('https://api.search.brave.com/res/v1/web/search',params=params,headers={'X-Subscription-Token':self.api_key,'Accept':'application/json'},timeout=max(.001,deadline-time.monotonic()),allow_redirects=False,stream=True)
            check_time()
            if response.status_code in (401,403): raise SearchError('NOT_CONFIGURED','Brave Search rejected the API key. Check the Actions secret and subscription.')
            if response.status_code==429: raise SearchError('RATE_LIMITED','Brave Search rate limit reached. Existing data has been retained.')
            if response.status_code!=200: raise SearchError('SEARCH_FAILED',f'Brave Search returned HTTP {response.status_code}.')
            body=bytearray()
            raw=getattr(response,'raw',None)
            def chunks():
                if raw is not None and hasattr(raw,'read1'):
                    while True:
                        check_time();chunk=raw.read1(16384,decode_content=True)
                        if not chunk:return
                        yield chunk
                else:yield from response.iter_content(chunk_size=16384)
            for chunk in chunks():
                check_time()
                body.extend(chunk)
                if len(body)>3_000_000: raise SearchError('SEARCH_FAILED','Brave Search response exceeded the size limit.')
            payload=json.loads(body)
            check_time()
            if not isinstance(payload,dict): raise ValueError()
            web=payload.get('web') or {}
            if not isinstance(web,dict): raise ValueError()
            results=web.get('results',[])
            if not isinstance(results,list): raise ValueError()
            leads=[]
            for result in results[:count]:
                if not isinstance(result,dict): continue
                url=canonicalise_url(result.get('url'))
                if url:
                    title,_=clean_text(result.get('title'),'name'); snippet,_=clean_text(result.get('description'),'description')
                    leads.append(SearchLead(url,title or '',snippet or '',query,freshness))
            return leads
        except requests.RequestException: raise SearchError('SEARCH_FAILED','Brave Search request failed or timed out.') from None
        except (ValueError,TypeError): raise SearchError('SEARCH_FAILED','Brave Search returned an invalid response.') from None
        finally:
            if response is not None: response.close()

def discover_leads(search: BraveSearchClient,settings: DiscoverySettings,year: int,*,budget=None):
    batches=[]; requests_used=0
    for freshness in (None,'pw'):
        for template in settings.queries:
            if requests_used>=settings.max_search_requests: break
            if re.search(r'\{(?!year\})|\}',template.replace('{year}','')): raise SearchError('INVALID_QUERY','Unsupported query template placeholder.')
            query=template.replace('{year}',str(year))
            if settings.region.lower() not in query.lower(): query+=' '+settings.region
            if budget and not budget.consume_search(): break
            if budget: search.timeout=min(25,max(.001,budget.remaining))
            requests_used+=1
            try: batches.append(search.search(query,freshness=freshness))
            except SearchError as error:
                search.errors.append(str(error))
                if error.code in ('NOT_CONFIGURED','RATE_LIMITED','INVALID_QUERY'): break
        if search.errors and (not search.api_key or 'rate limit' in search.errors[-1].lower() or 'API key' in search.errors[-1]): break
    seen=set(); output=[]
    for group in zip_longest(*batches):
        for lead in group:
            if lead is not None and lead.url not in seen: seen.add(lead.url); output.append(lead)
    return output
