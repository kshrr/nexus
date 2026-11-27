"""
Bank Negara Malaysia parser tests — against the real captured page
(scraper/tests/fixtures/bnm_scholarships.html, fetched 22 November 2026 with
the project's ordinary Fetcher).
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from scraper.parsers.bnm import PAGE, BnmParser
from scraper.sources import parser_for_url
from scraper.validate import validate

FIXTURE = (Path(__file__).parent / "fixtures" / "bnm_scholarships.html").read_text(encoding="utf-8")
PREU = "Biasiswa Prauniversiti Kijang"
DEGREE = "Biasiswa Sarjana Muda Kijang"


@pytest.fixture(scope="module")
def records():
    return {r.name: r for r in BnmParser().parse(FIXTURE, PAGE)}


def labels(r) -> str:
    return " ".join(c.label for c in r.criteria)


def test_single_target_and_routing():
    assert BnmParser().discover(FIXTURE) == [PAGE]
    assert isinstance(parser_for_url(PAGE), BnmParser)


def test_both_kijang_programmes_with_clean_names(records):
    assert set(records) == {PREU, DEGREE}


def test_levels(records):
    assert records[PREU].education_levels == ["spm"]
    # Entry routes come from the PNGK line, not the SPM credit support requirement.
    assert set(records[DEGREE].education_levels) == {"stpm", "diploma", "matriculation", "foundation"}


def test_application_window_from_the_tab(records):
    assert records[DEGREE].deadline == date(2026, 4, 26)
    assert records[PREU].deadline is None
    validate(records[DEGREE], today=date(2026, 11, 22), expect_application_link=False)
    assert records[DEGREE].status == "expired" and records[DEGREE].flags == []


def test_criteria(records):
    for r in records.values():
        kinds = {(c.criterion_type, c.value) for c in r.criteria}
        assert ("citizenship", "MY") in kinds
        assert any(c.value == "service-bond" for c in r.criteria)
        assert all(c.is_checkable is False for c in r.criteria)
    assert [c.value for c in records[PREU].criteria if c.criterion_type == "age"] == [19]
    assert [c.value for c in records[DEGREE].criteria if c.criterion_type == "age"] == [22]
    # The nested academic routes are one qualification per line.
    assert "STPM / Diploma / Matrikulasi / Program Asasi: Purata Nilai Gred Kumulatif (PNGK) sekurang-kurangnya 3.50" in [
        c.label for c in records[DEGREE].criteria
    ]
    assert "8A" in labels(records[PREU])


def test_funding_fields_and_description(records):
    for r in records.values():
        assert "yuran pengajian" in r.funding_amount
        assert {"Data Science", "Computer Science"} <= set(r.field_of_study)
        assert "BNM menawarkan" not in r.description


def test_no_application_link_on_a_shared_saas_domain(records):
    assert all(r.application_link is None for r in records.values())
    assert BnmParser.publishes_application_links is False


def test_approved_institution_pdfs_are_linked_not_copied(records):
    assert records[PREU].source_documents == [
        {
            "label": "Kolej prauniversiti yang diluluskan BNM (PDF)",
            "url": "https://www.bnm.gov.my/documents/20124/1514833/List+of+Approved+Colleges.pdf",
        }
    ]
    [doc] = records[DEGREE].source_documents
    assert doc["url"].endswith("Approved_Universities_for_Academic_Year_2026.pdf")
    # The PDPA notice outside the programme panes is not a requirement document.
    assert not any("Appendix" in d["url"] for r in records.values() for d in r.source_documents)


def test_a_page_without_tab_panes_raises():
    with pytest.raises(ValueError):
        BnmParser().parse("<html><body><p>nothing</p></body></html>", PAGE)
