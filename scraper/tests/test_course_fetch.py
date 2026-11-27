import pytest
from scraper.public_http import FetchError, HttpResult


def test_pdf_fetch_validates_redirects_and_keeps_html_boundary(monkeypatch):
    from scraper.course_fetch import CourseFetcher
    calls = []
    class Session:
        def get(self, url, **kwargs):
            calls.append(kwargs)
            kwargs['before_request'](url)
            kwargs['before_request']('https://example.org/unregistered.pdf')
            return HttpResult(200, {'content-type':'application/pdf'}, b'%PDF-test', url)
    fetcher = CourseFetcher(_session=Session())
    monkeypatch.setattr(fetcher, '_before_request', lambda url: None)
    def guard(url):
        if 'example.org' in url: raise ValueError('outside registered source')
    fetcher.on_redirect = guard
    with pytest.raises(ValueError, match='outside registered'):
        fetcher.get_pdf_document('https://www.utem.edu.my/en/downloads/guide.pdf')
    assert calls[0]['max_bytes'] == 10_000_000
    assert calls[0]['accept'] == 'application/pdf'


def test_html_fetch_still_rejects_pdf(monkeypatch):
    from scraper.course_fetch import CourseFetcher
    class Session:
        def get(self, url, **kwargs):
            return HttpResult(200, {'content-type':'application/pdf'}, b'%PDF-test', url)
    fetcher = CourseFetcher(_session=Session())
    monkeypatch.setattr(fetcher, '_before_request', lambda url: None)
    with pytest.raises(FetchError, match='expected HTML'):
        fetcher.get_document('https://www.utem.edu.my/en/downloads/guide.pdf')


def test_xml_fetch_accepts_sitemaps_and_rejects_html(monkeypatch):
    from scraper.course_fetch import CourseFetcher
    responses = iter([
        HttpResult(200, {'content-type': 'application/xml; charset=UTF-8'}, b'<urlset><url><loc>https://x/</loc></url></urlset>', 'https://www.unisza.edu.my/wp-sitemap-posts-our-faculties-1.xml'),
        HttpResult(200, {'content-type': 'text/html'}, b'<html></html>', 'https://www.unisza.edu.my/wp-sitemap-posts-our-faculties-1.xml'),
    ])
    calls = []
    class Session:
        def get(self, url, **kwargs):
            calls.append(kwargs)
            return next(responses)
    fetcher = CourseFetcher(_session=Session())
    monkeypatch.setattr(fetcher, '_before_request', lambda url: None)
    document = fetcher.get_xml_document('https://www.unisza.edu.my/wp-sitemap-posts-our-faculties-1.xml')
    assert '<loc>https://x/</loc>' in document.html
    assert calls[0]['accept'] == 'application/xml,text/xml'
    with pytest.raises(FetchError, match='expected XML'):
        fetcher.get_xml_document('https://www.unisza.edu.my/wp-sitemap-posts-our-faculties-1.xml')
    with pytest.raises(FetchError, match='non-https'):
        fetcher.get_xml_document('http://www.unisza.edu.my/wp-sitemap-posts-our-faculties-1.xml')


def flaky_fetcher(monkeypatch, failures):
    from scraper import course_fetch
    attempts, pauses = [], []
    class Session:
        def get(self, url, **kwargs):
            attempts.append(url)
            if len(attempts) <= failures: raise FetchError('HTTPS request failed')
            return HttpResult(200, {'content-type': 'text/html'}, b'<h1>MBBS</h1>', url)
    monkeypatch.setattr(course_fetch.time, 'sleep', pauses.append)
    fetcher = course_fetch.CourseFetcher(_session=Session())
    monkeypatch.setattr(fetcher, '_before_request', lambda url: None)
    return fetcher, attempts, pauses


def test_course_fetch_retries_dropped_connections_with_pauses(monkeypatch):
    fetcher, attempts, pauses = flaky_fetcher(monkeypatch, failures=2)
    document = fetcher.get_document('https://www.unisza.edu.my/our-faculties/bachelor-of-medicine')
    assert 'MBBS' in document.html and len(attempts) == 3 and pauses == [5, 15]


def test_course_fetch_gives_up_after_three_attempts(monkeypatch):
    fetcher, attempts, pauses = flaky_fetcher(monkeypatch, failures=5)
    with pytest.raises(FetchError, match='HTTPS request failed'):
        fetcher.get_document('https://www.unisza.edu.my/our-faculties/bachelor-of-medicine')
    assert len(attempts) == 3 and pauses == [5, 15]


def test_course_fetch_does_not_pause_past_the_run_deadline(monkeypatch):
    import time
    fetcher, attempts, pauses = flaky_fetcher(monkeypatch, failures=5)
    fetcher.deadline = time.monotonic() + 3
    with pytest.raises(FetchError):
        fetcher.get_document('https://www.unisza.edu.my/our-faculties/bachelor-of-medicine')
    assert len(attempts) == 1 and pauses == []


def test_course_fetch_does_not_retry_final_errors(monkeypatch):
    from scraper.course_fetch import CourseFetcher
    attempts = []
    class Session:
        def get(self, url, **kwargs):
            attempts.append(url)
            return HttpResult(404, {'content-type': 'text/html'}, b'', url)
    fetcher = CourseFetcher(_session=Session())
    monkeypatch.setattr(fetcher, '_before_request', lambda url: None)
    with pytest.raises(FetchError, match='HTTP 404'):
        fetcher.get_document('https://www.unisza.edu.my/our-faculties/bachelor-of-medicine')
    assert len(attempts) == 1


def test_unreadable_robots_names_its_cause():
    from scraper.course_fetch import CourseFetcher
    from scraper.fetch import RobotsDisallowed
    class Session:
        def get(self, url, **kwargs):
            if url.endswith('/robots.txt'):
                return HttpResult(403, {'content-type': 'text/html'}, b'denied', url)
            raise AssertionError('the page must not be fetched')
    fetcher = CourseFetcher(_session=Session(), delay=0)
    with pytest.raises(RobotsDisallowed, match=r'robots.txt could not be read \(HTTP 403\)'):
        fetcher.get_document('https://www.utem.edu.my/en/undergraduate.html')
