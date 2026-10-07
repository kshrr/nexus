"""
Fetcher tests — the "targeted scraper, not a crawler" and "no access-control
bypass" rules, enforced in behaviour.

No test here makes a real network request: robots parsers are injected and the
HTTP session is stubbed. The point is to prove the guards fire, not to reach
the live sites (the parser tests already do that against fixtures).
"""

from __future__ import annotations

import urllib.robotparser

import pytest

from scraper.fetch import USER_AGENT, FetchError, Fetcher, RobotsDisallowed


def robots(*lines: str) -> urllib.robotparser.RobotFileParser:
    parser = urllib.robotparser.RobotFileParser()
    parser.parse(list(lines))
    return parser


class FakeResponse:
    def __init__(self, status=200, text="", content_type="text/html", body=None):
        self.status = status
        self.headers = {"content-type": content_type}
        self.body = body if body is not None else (text or '<html></html>').encode()
        self.final_url = ''


class TestRobots:
    def test_a_disallowed_path_is_refused(self, monkeypatch):
        f = Fetcher(delay=0)
        f._robots["https://example.gov.my"] = robots(
            "User-agent: *", "Disallow: /private/"
        )
        assert f.allowed("https://example.gov.my/private/x.html") is False
        assert f.allowed("https://example.gov.my/public/x.html") is True

    def test_get_raises_on_a_disallowed_path(self):
        f = Fetcher(delay=0)
        f._robots["https://example.gov.my"] = robots("User-agent: *", "Disallow: /")
        with pytest.raises(RobotsDisallowed):
            f.get("https://example.gov.my/anything.html")

    def test_unreadable_robots_fails_closed(self):
        """If robots.txt cannot be read, the path is treated as forbidden —
        not assumed open."""
        f = Fetcher(delay=0)
        f._robots["https://example.gov.my"] = None
        assert f.allowed("https://example.gov.my/x.html") is False

    def test_robots_is_fetched_once_per_host(self, monkeypatch):
        f = Fetcher(delay=0)
        calls = []

        def fake_get(url, **kw):
            calls.append(url)
            return FakeResponse(text="User-agent: *\nAllow: /")

        monkeypatch.setattr(f._session, "get", fake_get)
        f.allowed("https://example.gov.my/a.html")
        f.allowed("https://example.gov.my/b.html")
        assert calls == ["https://example.gov.my/robots.txt"]


class TestFetching:
    def test_non_https_is_refused_before_any_request(self):
        f = Fetcher(delay=0)
        with pytest.raises(FetchError, match="non-https"):
            f.get("http://example.gov.my/x.html")

    def test_an_access_control_is_reported_not_evaded(self, monkeypatch):
        """A 403 raises — there is no retry, no header spoofing, no fallback."""
        f = Fetcher(delay=0)
        f._robots["https://example.gov.my"] = robots("User-agent: *", "Allow: /")
        monkeypatch.setattr(f._session, "get", lambda url, **kw: FakeResponse(status=403))
        with pytest.raises(FetchError, match="403"):
            f.get("https://example.gov.my/x.html")

    def test_non_html_is_refused(self, monkeypatch):
        f = Fetcher(delay=0)
        f._robots["https://example.gov.my"] = robots("User-agent: *", "Allow: /")
        monkeypatch.setattr(
            f._session,
            "get",
            lambda url, **kw: FakeResponse(content_type="application/pdf"),
        )
        with pytest.raises(FetchError, match="expected HTML"):
            f.get("https://example.gov.my/x.pdf")

    def test_an_oversized_response_is_refused(self, monkeypatch):
        f = Fetcher(delay=0)
        f._robots["https://example.gov.my"] = robots("User-agent: *", "Allow: /")
        monkeypatch.setattr(
            f._session,
            "get",
            lambda url, **kw: FakeResponse(body=b"x" * 4_000_000),
        )
        with pytest.raises(FetchError, match="exceeds"):
            f.get("https://example.gov.my/huge.html")

    def test_a_normal_page_is_returned(self, monkeypatch):
        f = Fetcher(delay=0)
        f._robots["https://example.gov.my"] = robots("User-agent: *", "Allow: /")
        monkeypatch.setattr(
            f._session,
            "get",
            lambda url, **kw: FakeResponse(body=b"<html><body>hi</body></html>"),
        )
        assert "hi" in f.get("https://example.gov.my/x.html")

    def test_requests_to_a_host_are_spaced_out(self, monkeypatch):
        """The delay is what keeps a run cheap for the provider."""
        f = Fetcher(delay=0.2)
        f._robots["https://example.gov.my"] = robots("User-agent: *", "Allow: /")
        monkeypatch.setattr(
            f._session, "get", lambda url, **kw: FakeResponse(body=b"<html></html>")
        )
        import time

        start = time.monotonic()
        f.get("https://example.gov.my/a.html")
        f.get("https://example.gov.my/b.html")
        assert time.monotonic() - start >= 0.2


class TestIdentification:
    def test_the_user_agent_is_honest(self):
        # Identifies the project and does not impersonate a browser — spoofing
        # a UA is the first step of evading a control, which the brief rules out.
        assert "NexusScholarshipBot" in USER_AGENT
        assert "Mozilla" not in USER_AGENT

@pytest.mark.parametrize('status,allowed',[(404,True),(410,True),(401,False),(403,False),(429,False),(500,False)])
def test_robots_status_policy(monkeypatch,status,allowed):
    f=Fetcher(delay=0)
    monkeypatch.setattr(f._session,'get',lambda *a,**kw:FakeResponse(status=status))
    assert f.allowed('https://provider.example/award') is allowed

def test_robots_delay_observed(monkeypatch):
    f=Fetcher(delay=0)
    f._robots['https://provider.example']=robots('User-agent: *','Crawl-delay: 5','Allow: /')
    now=[100.0]; sleeps=[]
    monkeypatch.setattr('scraper.fetch.time.monotonic',lambda:now[0])
    def sleep(seconds):sleeps.append(seconds);now[0]+=seconds
    monkeypatch.setattr('scraper.fetch.time.sleep',sleep)
    f._last_request['provider.example']=100.0
    f._wait('https://provider.example/award')
    assert sleeps==[5.0]

def test_robots_uses_remaining_run_budget(monkeypatch):
    import time
    f=Fetcher(delay=0,deadline=time.monotonic()+.1);calls=[]
    def fake(url,**kwargs):calls.append(kwargs['timeout']);return FakeResponse(status=404)
    monkeypatch.setattr(f._session,'get',fake)
    assert f.allowed('https://provider.example/award')
    assert 0<calls[0]<=.100001
