import gzip
import ssl
import time
import threading
from io import BytesIO

import pytest

from scraper.public_http import FetchError, HttpResult, PublicHttpClient, PinnedHTTPSConnection, validate_public_url, read_bounded

def resolver(host, port):
    return ['93.184.216.34'] if host != 'private.example' else ['127.0.0.1']

@pytest.mark.parametrize('url', ['http://site.example/a','https://user:pass@site.example/','https://site.example:8443/','https://localhost/','https://127.0.0.1/','https://[::1]/','https://[::ffff:127.0.0.1]/','https://169.254.169.254/','https://10.0.0.1/','https://site.example/\nInjected'])
def test_unsafe_urls_rejected(url):
    with pytest.raises(FetchError): validate_public_url(url,resolver)

def test_mixed_dns_rejected():
    with pytest.raises(FetchError): validate_public_url('https://site.example/',lambda *_:['93.184.216.34','10.0.0.1'])

def test_redirect_private_never_connected():
    calls=[]
    def transport(dest, **kwargs):
        calls.append(dest.hostname)
        return HttpResult(302,{'location':'https://private.example/'},b'',dest.url)
    with pytest.raises(FetchError): PublicHttpClient(resolver=resolver,transport=transport).get('https://site.example/',max_bytes=100,timeout=25,accept='text/html')
    assert calls==['site.example']

def test_redirect_limit_and_authorisation():
    calls=[]
    def transport(dest,**kwargs):
        calls.append(dest.url)
        return HttpResult(302,{'location':'/next'+str(len(calls))},b'',dest.url)
    checked=[]
    with pytest.raises(FetchError,match='redirect'):
        PublicHttpClient(resolver=resolver,transport=transport).get('https://site.example/',max_bytes=100,timeout=25,accept='text/html',before_request=checked.append)
    assert len(calls)==4
    assert checked==calls

def test_pinned_connection_preserves_tls_hostname(monkeypatch):
    connected=[]; wrapped=[]
    class Sock:
        def settimeout(self,*_): pass
        def close(self): pass
    class Context:
        def wrap_socket(self,sock,server_hostname): wrapped.append(server_hostname); return sock
    monkeypatch.setattr('socket.create_connection',lambda address,*args,**kw: connected.append(address) or Sock())
    dest=validate_public_url('https://site.example/',resolver)
    conn=PinnedHTTPSConnection(dest,timeout=25,context=Context())
    conn.connect()
    assert connected==[('93.184.216.34',443)]
    assert wrapped==['site.example']
    assert ssl.create_default_context().check_hostname

def test_rebinding_uses_only_validated_ip():
    resolutions=[]; connections=[]
    def changing(host,port):
        resolutions.append(host)
        return ['93.184.216.34'] if len(resolutions)==1 else ['127.0.0.1']
    def transport(dest,**kwargs): connections.extend(dest.ips); return HttpResult(200,{},b'ok',dest.url)
    assert PublicHttpClient(resolver=changing,transport=transport).get('https://site.example/',max_bytes=100,timeout=25,accept='text/html').body==b'ok'
    assert connections==['93.184.216.34'] and len(resolutions)==1

def test_decompressed_size_bounded():
    with pytest.raises(FetchError,match='exceeds'): read_bounded(BytesIO(gzip.compress(b'x'*10000)),'gzip',100,lambda:None)
    assert read_bounded(BytesIO(gzip.compress(b'hello')),'gzip',100,lambda:None)==b'hello'

def test_timeout_is_total_not_per_redirect():
    now=[0.0]
    def transport(dest,**kwargs): now[0]+=26; return HttpResult(302,{'location':'/next'},b'',dest.url)
    with pytest.raises(FetchError,match='timeout'): PublicHttpClient(resolver=resolver,transport=transport,clock=lambda:now[0]).get('https://site.example/',max_bytes=100,timeout=25,accept='text/html')

def test_dns_lookup_is_time_bounded():
    release=threading.Event()
    def stalled(*_): release.wait(1); return ['93.184.216.34']
    start=time.monotonic()
    try:
        with pytest.raises(FetchError,match='timeout'): PublicHttpClient(resolver=stalled).get('https://site.example/',max_bytes=100,timeout=.02,accept='text/html')
        assert time.monotonic()-start<.2
    finally: release.set()

def test_buffered_body_reads_return_control_for_absolute_deadline():
    from io import RawIOBase,BufferedReader
    clock=[0]
    class Trickled(RawIOBase):
        def readable(self):return True
        def readinto(self,target):clock[0]+=1;target[0]=120;return 1
    def deadline():
        if clock[0]>=25:raise FetchError('request timeout')
    with pytest.raises(FetchError,match='timeout'):read_bounded(BufferedReader(Trickled()),'',3000000,deadline)
    assert clock[0]<=25
