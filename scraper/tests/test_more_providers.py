"""
PTPTN, Yayasan Selangor and Maybank Foundation parser tests — against the real
captured pages (fetched 23 November 2026 with the project's Fetcher).
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from scraper.parsers.maybank import PAGE as MAYBANK, MaybankParser
from scraper.parsers.ptptn import PAGE as PTPTN, PtptnParser
from scraper.parsers.yayasan_selangor import PAGE as SELANGOR, YayasanSelangorParser
from scraper.sources import parser_for_url
from scraper.validate import validate

FIXTURES = Path(__file__).parent / "fixtures"


def page(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def kinds(record):
    return {(c.criterion_type, c.value) for c in record.criteria}


def labels(record) -> str:
    return " ".join(c.label for c in record.criteria)


# -- PTPTN ---------------------------------------------------------------------
@pytest.fixture(scope="module")
def ptptn():
    [record] = PtptnParser().parse(page("ptptn_pinjaman.html"), PTPTN)
    return record


def test_ptptn_routing_and_record(ptptn):
    assert isinstance(parser_for_url(PTPTN), PtptnParser)
    assert ptptn.name == "Pinjaman Pendidikan PTPTN"
    assert set(ptptn.education_levels) == {"spm", "stpm", "matriculation", "foundation", "diploma"}
    assert "IPTA" in ptptn.description


def test_ptptn_amounts_come_from_the_table_without_postgraduate_rows(ptptn):
    # Diploma at public institutions (RM4,750) up to MBBS at IPTS (RM50,000);
    # the PhD row (RM24,700) is not the maximum, so it was not the source.
    assert "RM4,750–RM50,000" in ptptn.funding_amount
    assert "75% atau 50%" in ptptn.funding_amount


def test_ptptn_conditions(ptptn):
    assert ("citizenship", "MY") in kinds(ptptn)
    assert [c.value for c in ptptn.criteria if c.criterion_type == "age"] == [45]
    assert any(c.value == "household-income" and "RM50,000" in c.label for c in ptptn.criteria)
    assert "SSPN" in labels(ptptn)
    # list joiners are removed without clipping words
    assert not any(c.label.endswith((";", " dan", "memoho")) for c in ptptn.criteria)


def test_ptptn_apply_link_is_its_own_portal(ptptn):
    assert ptptn.application_link == "https://www.ptptn.gov.my/ionline/"
    validate(ptptn, today=date(2026, 11, 23))
    assert ptptn.flags == [] and ptptn.status == "active"


def test_ptptn_page_without_toggles_raises():
    with pytest.raises(ValueError):
        PtptnParser().parse("<html><body><p>nothing</p></body></html>", PTPTN)


# -- Yayasan Selangor ------------------------------------------------------------
@pytest.fixture(scope="module")
def selangor():
    [record] = YayasanSelangorParser().parse(page("yayasan_selangor_pinjaman.html"), SELANGOR)
    return record


def test_selangor_record(selangor):
    assert isinstance(parser_for_url(SELANGOR), YayasanSelangorParser)
    assert selangor.name == "Pinjaman Pelajaran Yayasan Selangor"
    assert "SEPENUH MASA" in selangor.description
    assert selangor.funding_amount is None  # no amount is published
    validate(selangor, today=date(2026, 11, 23), expect_application_link=False)
    assert selangor.flags == []


def test_selangor_numbered_conditions_are_split(selangor):
    assert ("citizenship", "MY") in kinds(selangor)
    assert [c.value for c in selangor.criteria if c.criterion_type == "age"] == [30]
    assert sum(c.value == "selangorian" for c in selangor.criteria) == 2
    assert any(c.value == "household-income" and "RM 3,000.00" in c.label for c in selangor.criteria)
    assert "UNISEL" in labels(selangor) and "RKPYS" in labels(selangor)
    # administrative lines are not eligibility conditions
    assert "muktamad" not in labels(selangor)
    assert not any(c.label[:1].isdigit() for c in selangor.criteria)


# -- Maybank ----------------------------------------------------------------------
@pytest.fixture(scope="module")
def maybank():
    [record] = MaybankParser().parse(page("maybank_mgsp.html"), MAYBANK)
    return record


def test_maybank_record(maybank):
    assert isinstance(parser_for_url(MAYBANK), MaybankParser)
    assert maybank.deadline == date(2026, 3, 12)
    assert set(maybank.education_levels) == {"stpm", "foundation", "matriculation", "diploma"}
    assert {"Engineering", "Computer Science"} <= set(maybank.field_of_study)
    assert "full tuition fees" in maybank.funding_amount and "Laptop" in maybank.funding_amount
    validate(maybank, today=date(2026, 11, 23), expect_application_link=False)
    assert maybank.status == "expired" and maybank.flags == []


def test_maybank_routes_are_labelled_and_the_age_stated_once(maybank):
    assert [c.value for c in maybank.criteria if c.criterion_type == "age"] == [22]
    assert sum("years of age" in c.label for c in maybank.criteria) == 1
    text = labels(maybank)
    assert "Malaysia: Total gross household income of not more than RM120,000" in text
    assert "United Kingdom: Total gross household income of not more than RM180,000" in text
    assert "UM, UPM, UKM" in text and "–" not in text
    assert any(c.value == "service-bond" for c in maybank.criteria)


def test_maybank_google_form_is_not_stored(maybank):
    assert maybank.application_link is None
    assert MaybankParser.publishes_application_links is False


def test_maybank_page_without_tabs_raises():
    with pytest.raises(ValueError):
        MaybankParser().parse("<html><body><p>nothing</p></body></html>", MAYBANK)
