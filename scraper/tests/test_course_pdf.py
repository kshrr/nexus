import io
import time
import pytest
from pypdf import PdfWriter
from scraper.public_http import FetchError


def blank_pdf(pages=1, encrypted=False):
    writer = PdfWriter()
    for _ in range(pages): writer.add_blank_page(600, 800)
    if encrypted: writer.encrypt('secret')
    stream = io.BytesIO(); writer.write(stream)
    return stream.getvalue()


@pytest.mark.parametrize('body,reason', [(b'not pdf', 'PDF'), (blank_pdf(201), 'page'), (blank_pdf(encrypted=True), 'encrypted'), (blank_pdf(), 'text')], ids=['signature','pages','encrypted','scanned'])
def test_unsupported_pdf_is_rejected_with_reason(body, reason):
    from scraper.course_pdf import extract_pdf_pages
    with pytest.raises(FetchError, match=reason):
        extract_pdf_pages(body, deadline=time.monotonic()+20)


def test_pdf_expired_deadline_is_rejected_before_worker_start():
    from scraper.course_pdf import extract_pdf_pages
    with pytest.raises(FetchError, match='budget|timeout'):
        extract_pdf_pages(blank_pdf(), deadline=time.monotonic()-1)


def test_pdf_size_limit_is_checked_before_parsing():
    from scraper.course_pdf import extract_pdf_pages
    with pytest.raises(FetchError, match='size'):
        extract_pdf_pages(b'%PDF-'+b'0'*10_000_000, deadline=time.monotonic()+20)


def test_pdf_timeout_terminates_worker(monkeypatch):
    import subprocess
    from scraper import course_pdf
    def timeout(*args, **kwargs):
        raise subprocess.TimeoutExpired(args[0], kwargs['timeout'])
    monkeypatch.setattr(course_pdf.subprocess, 'run', timeout)
    with pytest.raises(FetchError, match='timeout; worker terminated'):
        course_pdf.extract_pdf_pages(blank_pdf(), deadline=time.monotonic()+20)
