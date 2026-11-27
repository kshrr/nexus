"""
Yayasan Sabah parser tests — against the real PTPS sponsor page and the 2026
advertisement PDF (fetched 22 November 2026).

The PDF itself is not stored: yayasan_sabah_2026_pages.json holds its decoded
pages exactly as scraper.course_pdf._decode produced them with the pinned
pypdf 6.20.1, so these tests do not depend on the locally installed pypdf.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from scraper.course_pdf import FetchedPdfDocument, PdfPage
from scraper.discovery_extract import extract_candidates
from scraper.parsers.yayasan_sabah import SPONSOR_URL, YayasanSabahParser
from scraper.public_http import FetchedDocument
from scraper.sources import parser_for_url
from scraper.validate import validate

FIXTURES = Path(__file__).parent / "fixtures"
SPONSOR_HTML = (FIXTURES / "yayasan_sabah_ptps_sponsor.html").read_text(encoding="utf-8")
PDF_URL = "https://ptps.sabah.gov.my/landing/public/pdf/Yayasan%20Sabah%202026.pdf"


def pages():
    data = json.loads((FIXTURES / "yayasan_sabah_2026_pages.json").read_text(encoding="utf-8"))
    return [PdfPage(p["number"], p["text"], tuple(tuple(c) for c in p["chunks"])) for p in data["pages"]]


@pytest.fixture(scope="module")
def records():
    return {r.name: r for r in YayasanSabahParser().parse_attachment(pages(), SPONSOR_HTML, SPONSOR_URL)}


def test_sponsor_page_names_the_advertisement_pdf():
    assert YayasanSabahParser().attachment(SPONSOR_HTML, SPONSOR_URL) == PDF_URL


def test_only_the_yayasan_sabah_sponsor_routes_here():
    assert isinstance(parser_for_url(SPONSOR_URL), YayasanSabahParser)
    other = "https://ptps.sabah.gov.my/landing/sponsor.php?id=ME9YcEhKZFZYN2pFOEVQWmtDeC91QT09"
    assert parser_for_url(other) is None


def test_twenty_four_post_spm_programmes(records):
    assert len(records) == 24
    for skipped in ("Kepakaran", "Sarjana Komputer", "Amalan Kehakiman"):
        assert not any(skipped in name for name in records)


def test_both_columns_are_read(records):
    assert "Yayasan Sabah Biasiswa Cemerlang Negeri Sabah (BCNS)" in records  # left column
    assert "Yayasan Sabah Pinjaman Luar Negara" in records  # right column
    last_left = records["Yayasan Sabah Biasiswa Kejuruteraan Jerman"]
    # The last left-column item must not swallow the right column's text.
    assert "BAPA/PENJAGA" not in last_left.description and "Kursk" not in last_left.description


def test_levels(records):
    assert records["Yayasan Sabah Biasiswa Cemerlang Negeri Sabah (BCNS)"].education_levels == ["spm"]
    assert records["Yayasan Sabah Biasiswa Kejuruteraan Jerman"].education_levels == ["foundation"]
    assert records["Yayasan Sabah Biasiswa Perubatan Russia"].education_levels == ["matriculation"]
    assert set(records["Yayasan Sabah Biasiswa Ulum Islamiah Mesir"].education_levels) == {"stam", "spm"}
    assert records["Yayasan Sabah Pinjaman KTYS"].education_levels == ["spm"]
    assert set(records["Yayasan Sabah Pinjaman Luar Negara"].education_levels) == {
        "stpm", "matriculation", "foundation", "diploma"
    }


def test_shared_conditions_deadline_and_portal(records):
    for r in records.values():
        assert r.deadline == date(2026, 5, 6)
        assert r.application_link == "https://ptps.sabah.gov.my/"
        assert ("citizenship", "MY") in {(c.criterion_type, c.value) for c in r.criteria}
        assert any(c.criterion_type == "age" and c.value == 35 for c in r.criteria)
        assert all(c.is_checkable is False for c in r.criteria)
        validate(r, today=date(2026, 11, 22))
        assert r.flags == [] and r.status == "expired"
    origin = [c.label for c in records["Yayasan Sabah Pinjaman IPTA"].criteria if c.value == "sabahan"]
    assert len(origin) == 3 and origin[2].endswith("Penduduk Tetap di Negeri Sabah")


def test_every_record_links_the_advertisement_pdf(records):
    for r in records.values():
        assert r.source_documents == [{"label": "Iklan tawaran tajaan Yayasan Sabah 2026 (PDF)", "url": PDF_URL}]
    candidate_row = next(iter(records.values())).to_row()
    assert candidate_row["source_documents"][0]["url"] == PDF_URL


def test_funding_kind_and_income(records):
    assert records["Yayasan Sabah Pinjaman IPTA"].funding_amount.startswith("Pinjaman")
    assert records["Yayasan Sabah Dermasiswa KTYS/Politeknik/UiTM"].funding_amount.startswith("Dermasiswa")
    bcplb = records["Yayasan Sabah Biasiswa Cemerlang Pelajar Luar Bandar (BCPLB)"]
    assert any(c.value == "household-income" for c in bcplb.criteria)


def test_veterinary_is_not_tagged_as_medicine(records):
    assert "Medicine" not in records["Yayasan Sabah Biasiswa Perubatan Veterinar - YS/UMK"].field_of_study
    assert "Medicine" in records["Yayasan Sabah Biasiswa Perubatan Mesir"].field_of_study


def test_discovery_follows_the_pdf_and_keeps_the_html_source():
    requested = []

    def fetch_pdf(url):
        requested.append(url)
        return FetchedPdfDocument(url, pages())

    candidates = extract_candidates(FetchedDocument(SPONSOR_HTML, SPONSOR_URL), None, datetime.now(timezone.utc), fetch_pdf)
    assert requested == [PDF_URL] and len(candidates) == 24
    assert all(c.canonical_url == SPONSOR_URL for c in candidates)


def test_without_a_pdf_fetcher_the_attachment_is_an_error_not_a_generic_guess():
    with pytest.raises(ValueError):
        extract_candidates(FetchedDocument(SPONSOR_HTML, SPONSOR_URL), None, datetime.now(timezone.utc))


def test_a_sponsor_page_without_the_pdf_link_raises():
    html = SPONSOR_HTML.replace(".pdf", ".txt")
    parser = YayasanSabahParser()
    assert parser.attachment(html, SPONSOR_URL) is None
    with pytest.raises(ValueError):
        parser.parse(html, SPONSOR_URL)
