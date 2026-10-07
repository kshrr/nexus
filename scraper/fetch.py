"""Polite, public-only fetcher shared by supported and discovered providers."""
from __future__ import annotations
import re
import time
import urllib.robotparser
from dataclasses import dataclass, field
from urllib.parse import urlsplit
from .public_http import FetchError, PublicHttpClient, FetchedDocument

USER_AGENT='NexusScholarshipBot/1.0 (Universiti Sains Islam Malaysia final-year project; scholarship indexing; contact via project repository)'
CRAWL_DELAY=2.0
MAX_BYTES=3_000_000
TIMEOUT=25

class RobotsDisallowed(FetchError):
    pass

@dataclass
class Fetcher:
    delay: float=CRAWL_DELAY
    _robots: dict=field(default_factory=dict,repr=False)
    _last_request: dict=field(default_factory=dict,repr=False)
    _session: PublicHttpClient | None=field(default=None,repr=False)
    on_redirect: object=None
    deadline: float | None=None

    def __post_init__(self):
        if self._session is None: self._session=PublicHttpClient(user_agent=USER_AGENT)

    def _robots_for(self,url):
        parts=urlsplit(url); origin=f'{parts.scheme}://{parts.netloc}'
        if origin in self._robots: return self._robots[origin]
        parser=urllib.robotparser.RobotFileParser()
        try:
            self._wait(origin)
            result=self._session.get(origin+'/robots.txt',max_bytes=MAX_BYTES,timeout=self._timeout(),accept='text/plain',before_request=self._robots_redirect_guard)
            if result.status==200: parser.parse(result.body.decode('utf-8',errors='replace').splitlines())
            elif result.status in (404,410): parser.parse([])
            else: parser=None
        except FetchError: parser=None
        self._robots[origin]=parser
        return parser

    def allowed(self,url):
        parser=self._robots_for(url)
        return parser is not None and parser.can_fetch(USER_AGENT,url)

    def _wait(self,url):
        parts=urlsplit(url); host=parts.netloc; parser=self._robots.get(f'{parts.scheme}://{host}')
        crawl_delay=(parser.crawl_delay(USER_AGENT) or parser.crawl_delay('*')) if parser else 0
        delay=max(self.delay,crawl_delay or 0)
        last=self._last_request.get(host)
        if last is not None:
            remaining=delay-(time.monotonic()-last)
            if self.deadline is not None and time.monotonic()+max(remaining,0)>=self.deadline: raise FetchError('Run time budget exhausted')
            while remaining>0:
                time.sleep(remaining)
                remaining=delay-(time.monotonic()-last)
        self._last_request[host]=time.monotonic()

    def _before_request(self,url):
        if not self.allowed(url): raise RobotsDisallowed('robots.txt forbids the page or could not be read')
        self._wait(url)

    def _timeout(self):
        remaining=TIMEOUT if self.deadline is None else min(TIMEOUT,self.deadline-time.monotonic())
        if remaining<=0:raise FetchError('Run time budget exhausted')
        return remaining

    def _robots_redirect_guard(self,url):
        self._timeout()

    def get_document(self,url):
        if not url.startswith('https://'): raise FetchError('refusing a non-https URL')
        self._before_request(url)
        first=[True]
        def redirected_guard(destination):
            if first[0]: first[0]=False
            else:
                if self.on_redirect: self.on_redirect(destination)
                self._before_request(destination)
        timeout=self._timeout()
        result=self._session.get(url,max_bytes=MAX_BYTES,timeout=timeout,accept='text/html,application/xhtml+xml',before_request=redirected_guard)
        if result.status!=200: raise FetchError(f'HTTP {result.status}')
        content_type=result.headers.get('content-type','')
        if 'html' not in content_type.lower(): raise FetchError(f'expected HTML, got {content_type or "unknown format"}')
        if len(result.body)>MAX_BYTES: raise FetchError(f'response exceeds {MAX_BYTES} bytes')
        match=re.search(r'charset=([\w-]+)',content_type,re.I)
        encoding=match.group(1) if match else 'utf-8'
        try: text=result.body.decode(encoding,errors='replace')
        except LookupError: text=result.body.decode('utf-8',errors='replace')
        return FetchedDocument(text,result.final_url or url,content_type)

    def get(self,url):
        return self.get_document(url).html
