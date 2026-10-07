"""Public-only HTTPS transport. DNS is checked once and the socket is pinned."""
from __future__ import annotations
import http.client
import ipaddress
import re
import socket
import ssl
import time
import zlib
import queue
import threading
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit, urljoin

class FetchError(RuntimeError):
    pass

@dataclass(frozen=True)
class ValidatedDestination:
    url: str
    hostname: str
    port: int
    ips: tuple[str, ...]

@dataclass
class HttpResult:
    status: int
    headers: dict
    body: bytes
    final_url: str

@dataclass
class FetchedDocument:
    html: str
    final_url: str
    content_type: str = 'text/html'

def resolve_addresses(host: str, port: int) -> list[str]:
    return list(dict.fromkeys(item[4][0] for item in socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)))

def validate_public_url(url: str, resolver=resolve_addresses) -> ValidatedDestination:
    if not isinstance(url, str) or len(url)>2000 or re.search(r'[\s\\\x00-\x1f\x7f]',url): raise FetchError('invalid public URL')
    try:
        parts=urlsplit(url)
        if parts.scheme!='https': raise FetchError('refusing a non-https URL')
        if parts.username is not None or parts.password is not None or not parts.hostname or parts.port not in (None,443): raise FetchError('URL credentials or unsupported port')
        host=parts.hostname.encode('idna').decode('ascii').lower().rstrip('.')
        if host=='localhost' or host.endswith(('.localhost','.local','.internal')) or '%' in host: raise FetchError('non-public hostname')
        try: addresses=[str(ipaddress.ip_address(host))]
        except ValueError: addresses=resolver(host,443)
        if not addresses: raise FetchError('hostname has no public addresses')
        for value in addresses:
            address=ipaddress.ip_address(value)
            if not address.is_global or address.is_multicast or address.is_reserved or (getattr(address,'ipv4_mapped',None) and not address.ipv4_mapped.is_global): raise FetchError('refusing a non-public destination')
        authority=f'[{host}]' if ':' in host else host
        canonical=urlunsplit(('https',authority,parts.path or '/',parts.query,''))
        return ValidatedDestination(canonical,host,443,tuple(dict.fromkeys(addresses)))
    except (ValueError,UnicodeError,OSError): raise FetchError('invalid or unresolved public destination') from None

class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self,destination: ValidatedDestination,*,timeout: float,context=None):
        super().__init__(destination.hostname,destination.port,timeout=timeout,context=context or ssl.create_default_context())
        self.destination=destination
    def connect(self):
        started=time.monotonic()
        raw=socket.create_connection((self.destination.ips[0],self.destination.port),self.timeout)
        try:
            remaining=self.timeout-(time.monotonic()-started)
            if remaining<=0: raise FetchError('request timeout')
            raw.settimeout(remaining)
            self.sock=self._context.wrap_socket(raw,server_hostname=self.destination.hostname)
        except Exception:
            raw.close()
            raise

def read_bounded(stream,encoding: str,max_bytes: int,check_time) -> bytes:
    if encoding not in ('','identity','gzip','deflate'): raise FetchError('unsupported content encoding')
    decoder=zlib.decompressobj(16+zlib.MAX_WBITS if encoding=='gzip' else zlib.MAX_WBITS) if encoding in ('gzip','deflate') else None
    body=bytearray(); wire_bytes=0
    while True:
        check_time()
        chunk=stream.read1(16384) if hasattr(stream,'read1') else stream.read(1)
        if not chunk: break
        wire_bytes+=len(chunk)
        if wire_bytes>max_bytes: raise FetchError(f'response exceeds {max_bytes} bytes')
        try: output=decoder.decompress(chunk,max_bytes-len(body)+1) if decoder else chunk
        except zlib.error: raise FetchError('invalid compressed response') from None
        body.extend(output)
        if len(body)>max_bytes or (decoder and decoder.unconsumed_tail): raise FetchError(f'response exceeds {max_bytes} bytes')
    if decoder:
        if not decoder.eof: raise FetchError('incomplete compressed response')
        body.extend(decoder.flush(max_bytes-len(body)+1))
    if len(body)>max_bytes: raise FetchError(f'response exceeds {max_bytes} bytes')
    check_time()
    return bytes(body)

class PublicHttpClient:
    def __init__(self,*,resolver=resolve_addresses,transport=None,clock=time.monotonic,user_agent='NexusScholarshipBot/1.0'):
        self.resolver=resolver; self.transport=transport or self._transport; self.clock=clock; self.user_agent=user_agent
    def _transport(self,dest,*,max_bytes,timeout,accept):
        connection=PinnedHTTPSConnection(dest,timeout=timeout)
        deadline=self.clock()+timeout
        def interrupt():
            sock=connection.sock
            if sock is not None:
                try:sock.shutdown(socket.SHUT_RDWR)
                except OSError:pass
            connection.close()
        watchdog=threading.Timer(timeout,interrupt);watchdog.daemon=True;watchdog.start()
        def check_time():
            remaining=deadline-self.clock()
            if remaining<=0: raise FetchError('request timeout')
            if connection.sock is not None: connection.sock.settimeout(remaining)
        try:
            parts=urlsplit(dest.url)
            connection.connect()
            check_time()
            connection.request('GET',urlunsplit(('','',parts.path or '/',parts.query,'')),headers={'User-Agent':self.user_agent,'Accept':accept,'Accept-Encoding':'gzip, deflate','Accept-Language':'ms,en;q=0.8'})
            check_time()
            response=connection.getresponse()
            headers={key.lower():value for key,value in response.getheaders()}
            body=read_bounded(response,headers.get('content-encoding','').lower(),max_bytes,check_time)
            return HttpResult(response.status,headers,body,dest.url)
        except (OSError,http.client.HTTPException): raise FetchError('HTTPS request failed') from None
        finally:watchdog.cancel();connection.close()
    def get(self,url: str,*,max_bytes=3_000_000,timeout=25,accept='text/html',before_request=None) -> HttpResult:
        deadline=self.clock()+timeout
        for redirect in range(4):
            def bounded_resolver(host,port):
                results=queue.Queue(maxsize=1)
                def lookup():
                    try: results.put((True,self.resolver(host,port)))
                    except Exception as error: results.put((False,error))
                threading.Thread(target=lookup,daemon=True).start()
                try: ok,value=results.get(timeout=max(.001,deadline-self.clock()))
                except queue.Empty: raise FetchError('DNS lookup timeout') from None
                if not ok: raise FetchError('DNS lookup failed')
                return value
            dest=validate_public_url(url,bounded_resolver)
            if before_request: before_request(dest.url)
            remaining=deadline-self.clock()
            if remaining<=0: raise FetchError('request timeout')
            result=self.transport(dest,max_bytes=max_bytes,timeout=remaining,accept=accept)
            if self.clock()>=deadline: raise FetchError('request timeout')
            if result.status not in (301,302,303,307,308): return result
            if redirect==3: raise FetchError('too many redirects')
            location=result.headers.get('location')
            if not location: raise FetchError('redirect has no destination')
            url=urljoin(dest.url,location)
        raise FetchError('too many redirects')
