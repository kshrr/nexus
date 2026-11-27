"""
Yayasan Tenaga Nasional parser tests — against the real captured pages
(scraper/tests/fixtures/ytn_*.html, fetched 22 November 2026).
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from scraper.discovery_extract import extract_candidates
from scraper.parsers.ytn import PAGES, YtnParser
from scraper.public_http import FetchedDocument
from scraper.sources import parser_for_url
from scraper.validate import validate

FIXTURES = Path(__file__).parent / "fixtures"


def page(name: str) -> str:
    return (FIXTURES / f"ytn_{name}.html").read_text(encoding="utf-8")


def parse(name="prime", today=date(2026, 11, 22)):
    parser = YtnParser()
    parser.today = lambda: today
    return {r.name: r for r in parser.parse(page(name), PAGES["prime"])}


@pytest.fixture(scope="module")
def records():
    return parse()


def labels(r) -> str:
    return " ".join(c.label for c in r.criteria)


def test_one_target_and_every_ytn_page_routes_here():
    parser = YtnParser()
    assert parser.discover(page("prime")) == [PAGES["prime"]]
    assert isinstance(parser_for_url(PAGES["shine"]), YtnParser)


def test_five_records_by_programme_and_stage(records):
    assert set(records) == {
        "TNB PRIME Scholarship (Foundation)",
        "TNB PRIME Scholarship (Degree)",
        "TNB SHINE Sponsorship (Foundation)",
        "TNB SHINE Sponsorship (Diploma)",
        "TNB SHINE Sponsorship (Degree)",
    }


def test_both_pages_yield_identical_records_with_per_programme_sources(records):
    shine = parse("shine")
    assert {n: r.source_url for n, r in shine.items()} == {n: r.source_url for n, r in records.items()}
    assert records["TNB PRIME Scholarship (Degree)"].source_url == PAGES["prime"]
    assert records["TNB SHINE Sponsorship (Diploma)"].source_url == PAGES["shine"]


def test_entry_levels(records):
    assert records["TNB PRIME Scholarship (Foundation)"].education_levels == ["spm"]
    assert records["TNB SHINE Sponsorship (Diploma)"].education_levels == ["spm"]
    degree = set(records["TNB SHINE Sponsorship (Degree)"].education_levels)
    assert degree == {"stpm", "diploma", "foundation", "matriculation"}
    assert "spm" not in records["TNB PRIME Scholarship (Degree)"].education_levels


def test_stale_preintake_and_enrolled_student_routes_are_skipped(records):
    text = " ".join(labels(r) + (r.description or "") for r in records.values())
    assert "2019" not in text and "2020" not in text and "Sabah" not in text
    assert "latest semester" not in text and "semester 2 25/26" not in text


def test_every_route_goes_stale_a_year_after_its_newest_date():
    # newest date on the page is "semester 1 2026/2027"
    assert "TNB SHINE Sponsorship (Degree)" in parse(today=date(2028, 1, 5))
    assert parse(today=date(2029, 1, 5)) == {}


def test_route_specific_conditions_name_their_destination(records):
    shine_degree = labels(records["TNB SHINE Sponsorship (Degree)"])
    assert "public universities: Children of TNB employees" in shine_degree
    assert "UNITEN, STPM entry: Pass your STPM" in shine_degree
    # shared conditions are stated once, unprefixed
    assert records["TNB PRIME Scholarship (Foundation)"].criteria[0].label.startswith("Age not exceeding 19")


def test_typed_age_and_income(records):
    shine = records["TNB SHINE Sponsorship (Degree)"]
    assert [(c.operator, c.value) for c in shine.criteria if c.criterion_type == "age"] == [("lte", 23)]
    assert any(c.value == "household-income" for c in shine.criteria)
    assert all(c.is_checkable is False for r in records.values() for c in r.criteria)


def test_funding_application_and_validation(records):
    assert records["TNB SHINE Sponsorship (Diploma)"].funding_amount.startswith("Convertible loan")
    assert records["TNB PRIME Scholarship (Foundation)"].funding_amount is None  # not stated
    for r in records.values():
        assert r.application_link == "https://info.uniten.edu.my/sam"
        validate(r, today=date(2026, 11, 22))
        assert r.flags == [] and r.status == "active"


def test_fields_exclude_group_headings(records):
    desc = records["TNB SHINE Sponsorship (Degree)"].description
    assert "Non Engineering" not in desc and "Engineering Courses" not in desc
    assert {"Computer Science", "Engineering"} <= set(records["TNB SHINE Sponsorship (Degree)"].field_of_study)


def test_other_ytn_pages_stage_nothing():
    html = '<html><body><div class="et_pb_section"><p>Gallery</p></div></body></html>'
    url = "https://ytn.tnb.com.my/gallery/field-trip/"
    assert YtnParser().parse(html, url) == []
    assert extract_candidates(FetchedDocument(html, url), None, None) == []


def test_a_non_divi_page_raises():
    with pytest.raises(ValueError):
        YtnParser().parse("<html><body><p>nothing</p></body></html>", PAGES["prime"])
