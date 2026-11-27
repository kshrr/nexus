"""
Yayasan TM parser tests — against the real captured pages
(scraper/tests/fixtures/ytm_*.html, fetched 22 November 2026).
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from scraper.discovery_extract import extract_candidates
from scraper.parsers.ytm import YtmParser
from scraper.public_http import FetchedDocument
from scraper.sanitise import clean_url
from scraper.sources import parser_for_url
from scraper.validate import validate

FIXTURES = Path(__file__).parent / "fixtures"
YOUNG = "https://ytm.tm.com.my/scholarships-young-leader"


def page(name: str) -> str:
    return (FIXTURES / f"ytm_{name}.html").read_text(encoding="utf-8")


@pytest.fixture()
def record():
    parser = YtmParser()
    [r] = parser.parse(page("future_leaders"), parser.index_url)
    return r


def test_single_pinned_target_on_the_declared_path():
    parser = YtmParser()
    assert parser.discover(page("future_leaders")) == [parser.index_url]
    assert isinstance(parser_for_url(YOUNG), YtmParser)


def test_future_leaders_core_fields(record):
    assert record.name == "Yayasan TM Future Leaders Scholarship"
    assert record.provider == "Yayasan Telekom Malaysia (YTM)"
    assert record.education_levels == ["spm"]
    assert {"Computer Science", "Engineering"} <= set(record.field_of_study)
    assert "Tuition Fees" in record.funding_amount and "allowance" in record.funding_amount


def test_closing_date_and_expiry(record):
    assert record.deadline == date(2026, 9, 30)
    validate(record, today=date(2026, 11, 22))
    assert record.status == "expired" and record.flags == []


def test_application_link_is_the_allowlisted_portal_only(record):
    assert record.application_link == "https://ytmapps.tm.com.my/Account/Login"
    assert clean_url("https://other.tm.com.my/apply", require_allowlist=True) is None


def test_criteria_keep_provider_wording_and_are_not_checkable(record):
    text = " ".join(c.label for c in record.criteria)
    assert "CGPA of 3.00" in text and "5 years" in text and "MMU" in text
    assert all(c.is_checkable is False for c in record.criteria)


def test_no_citizenship_or_income_is_invented(record):
    # The official page states neither; aggregator figures must not appear.
    assert not any(c.criterion_type in ("citizenship", "age") for c in record.criteria)
    assert "income" not in " ".join(c.label.lower() for c in record.criteria)


def test_young_leaders_form4_award_is_excluded_everywhere():
    assert YtmParser().parse(page("young_leaders"), YOUNG) == []
    assert extract_candidates(FetchedDocument(page("young_leaders"), YOUNG), None, None) == []


def test_a_page_without_the_faq_raises():
    with pytest.raises(ValueError):
        YtmParser().parse("<html><body><p>nothing</p></body></html>", YtmParser().index_url)
