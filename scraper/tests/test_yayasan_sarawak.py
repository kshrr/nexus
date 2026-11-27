"""
Yayasan Sarawak parser tests — against the real captured English pages
(scraper/tests/fixtures/yayasan_sarawak_*.html, fetched 22 November 2026).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scraper.discovery_extract import extract_candidates
from scraper.parsers.yayasan_sarawak import TARGETS, YayasanSarawakParser
from scraper.public_http import FetchedDocument
from scraper.sources import parser_for_url
from scraper.validate import validate

FIXTURES = Path(__file__).parent / "fixtures"


def page(name: str) -> str:
    return (FIXTURES / f"yayasan_sarawak_{name}.html").read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def records():
    parser = YayasanSarawakParser()
    out = parser.parse(page("biasiswa"), TARGETS[0]) + parser.parse(page("pinjaman"), TARGETS[1])
    return {r.name: r for r in out}


def labels(r) -> str:
    return " ".join(c.label for c in r.criteria)


def test_targets_are_the_english_scholarship_and_loan_pages():
    assert YayasanSarawakParser().discover(page("biasiswa")) == list(TARGETS)
    assert isinstance(parser_for_url("https://yayasansarawak.org.my/my/biasiswa/"), YayasanSarawakParser)


def test_eight_post_spm_programmes(records):
    assert set(records) == {
        "Sarawak Foundation Tun Taib Scholarship (BYSTT)",
        "Sarawak Tunku Abdul Rahman Scholarship Foundation (YBSTAR)",
        "UNIMAS Special Medical Program Scholarship",
        "Admission Assistance to Tertiary / Technical Education",
        "BP40 Bursary",
        "Local Education Scholarship Loan",
        "Overseas Education Loan",
        "Technical Training Scholarship Loan",
    }


def test_school_aid_and_flight_subsidy_are_skipped(records):
    assert not any("BTYS" in n or "i-GPS" in n for n in records)


def test_levels_follow_the_study_funded_not_the_spm_bm_credit(records):
    feeders = {"stpm", "matriculation", "foundation", "diploma"}
    assert set(records["Sarawak Foundation Tun Taib Scholarship (BYSTT)"].education_levels) == feeders
    assert set(records["BP40 Bursary"].education_levels) == {"spm"} | feeders
    assert set(records["Local Education Scholarship Loan"].education_levels) == {"spm"} | feeders


def test_unstated_levels_are_left_for_review_not_guessed(records):
    for name in ("UNIMAS Special Medical Program Scholarship", "Overseas Education Loan", "Technical Training Scholarship Loan"):
        r = records[name]
        assert r.education_levels == []
        validate(r, expect_application_link=False)
        assert any("education level" in f for f in r.flags)


def test_funding_is_stated_amounts_only(records):
    assert "RM1,500.00" in records["Admission Assistance to Tertiary / Technical Education"].funding_amount
    assert records["Admission Assistance to Tertiary / Technical Education"].funding_amount.count("RM1,500.00") == 1
    assert records["BP40 Bursary"].funding_amount.startswith("Subsidized Tuition Fees Covering 80%")
    assert records["Local Education Scholarship Loan"].funding_amount is None  # payment schedule only
    assert "RM100,000.00" in records["Overseas Education Loan"].funding_amount


def test_criteria(records):
    for r in records.values():
        assert all(c.is_checkable is False for c in r.criteria)
    bystt = records["Sarawak Foundation Tun Taib Scholarship (BYSTT)"]
    kinds = {(c.criterion_type, c.value) for c in bystt.criteria}
    assert ("citizenship", "MY") in kinds and ("other", "sarawakian") in kinds
    assert any(c.value == "household-income" for c in records["Admission Assistance to Tertiary / Technical Education"].criteria)
    assert "16 years to 30 years" in labels(records["Technical Training Scholarship Loan"])


def test_fields_from_priority_courses(records):
    assert {"Engineering", "Computer Science", "Medicine"} <= set(
        records["Sarawak Foundation Tun Taib Scholarship (BYSTT)"].field_of_study
    )


def test_malay_mirror_and_news_pages_stage_nothing():
    mirror = "https://yayasansarawak.org.my/my/biasiswa/"
    assert YayasanSarawakParser().parse(page("biasiswa"), mirror) == []
    assert extract_candidates(FetchedDocument(page("biasiswa"), mirror), None, None) == []
    news = "<html><body><article><h1>Majlis</h1><p>Berita</p></article></body></html>"
    assert YayasanSarawakParser().parse(news, "https://yayasansarawak.org.my/en/some-news/") == []
