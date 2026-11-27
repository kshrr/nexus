"""
MARA parser tests — against the real captured English financing pages
(scraper/tests/fixtures/mara_*.html, fetched 22 November 2026).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scraper.discovery_extract import extract_candidates
from scraper.parsers.mara import FINANCING, TARGETS, MaraParser
from scraper.public_http import FetchedDocument
from scraper.sources import parser_for_url
from scraper.validate import validate

FIXTURES = Path(__file__).parent / "fixtures"
PREPARATORY = f"{FINANCING}peringkat-persediaan-2/"
DIPLOMA = f"{FINANCING}peringkat-diploma-ijazah-2/"
POSTGRAD = f"{FINANCING}peringkat-pasca-siswazah-2/"
ADVANCE = f"{FINANCING}pinjaman-pendahuluan-pelajaran-2/"


def page(name: str) -> str:
    return (FIXTURES / f"mara_{name}.html").read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def records():
    parser = MaraParser()
    out = parser.parse(page("preparatory"), PREPARATORY) + parser.parse(
        page("diploma_degree"), DIPLOMA
    )
    return {r.name: r for r in out}


def labels(record) -> str:
    return " ".join(c.label for c in record.criteria)


class TestDiscovery:
    def test_targets_are_the_post_spm_level_pages_on_the_declared_path(self):
        parser = MaraParser()
        urls = parser.discover(page("financing_index"))
        assert urls == list(TARGETS) == [PREPARATORY, DIPLOMA]
        assert all(u.startswith(parser.path_prefix) for u in urls)

    def test_postgraduate_and_advance_loan_pages_are_not_targets(self):
        urls = MaraParser().discover(page("financing_index"))
        assert POSTGRAD not in urls and ADVANCE not in urls

    def test_discovery_routes_financing_urls_to_this_parser(self):
        assert isinstance(parser_for_url(DIPLOMA), MaraParser)
        assert parser_for_url("https://www.mara.gov.my/bm/pendidikan/") is None


class TestExtraction:
    def test_extracts_the_three_post_spm_programmes(self, records):
        assert set(records) == {
            "Young Talent Development Program (YTP)",
            "Tertiary Education Loan Program (TESP)",
            "Excellent Student Program (IPMa)",
        }

    def test_heading_layout_strips_the_introduction_prefix(self, records):
        assert not any(name.lower().startswith("introduction") for name in records)

    def test_provider_and_source(self, records):
        for r in records.values():
            assert r.provider == "Majlis Amanah Rakyat (MARA)"
            assert r.source_url.startswith(FINANCING)

    def test_entry_levels_come_from_who_the_programme_is_for(self, records):
        # YTP funds foundation/A-Levels, but it is FOR SPM leavers.
        assert records["Young Talent Development Program (YTP)"].education_levels == ["spm"]
        assert records["Tertiary Education Loan Program (TESP)"].education_levels == [
            "spm",
            "diploma",
        ]
        assert records["Excellent Student Program (IPMa)"].education_levels == ["diploma"]

    def test_priority_fields_are_mapped_to_nexus_values(self, records):
        fields = records["Young Talent Development Program (YTP)"].field_of_study
        assert {"Computer Science", "Medicine", "Engineering"} <= set(fields)

    def test_descriptions_come_from_the_introduction(self, records):
        assert "SPM" in records["Young Talent Development Program (YTP)"].description
        assert "IPMa" in records["Excellent Student Program (IPMa)"].description

    def test_validates_without_flags(self, records):
        for r in records.values():
            validate(r, expect_application_link=MaraParser.publishes_application_links)
            assert r.flags == [], (r.name, r.flags)


class TestCriteria:
    def test_every_criterion_is_non_checkable_and_labelled(self, records):
        for r in records.values():
            assert r.criteria
            assert all(c.is_checkable is False and c.label.strip() for c in r.criteria)

    def test_citizenship_and_bumiputera_are_both_recorded(self, records):
        for r in records.values():
            kinds = {(c.criterion_type, c.value) for c in r.criteria}
            assert ("citizenship", "MY") in kinds
            assert ("other", "bumiputera") in kinds

    def test_ytp_age_is_typed(self, records):
        ages = [c for c in records["Young Talent Development Program (YTP)"].criteria if c.criterion_type == "age"]
        assert [(c.operator, c.value) for c in ages] == [("eq", 18)]

    def test_tesp_age_table_is_summarised_once(self, records):
        r = records["Tertiary Education Loan Program (TESP)"]
        assert "Diploma < 30 years" in labels(r) and "40 years" in labels(r)
        assert not any("|" in c.label for c in r.criteria)

    def test_inline_emphasis_stays_on_its_line(self, records):
        # "(<em>double sponsor</em>)" must not split into separate criteria.
        assert "(double sponsor)" in labels(records["Tertiary Education Loan Program (TESP)"])
        assert not any(c.label == "double sponsor" for r in records.values() for c in r.criteria)

    def test_programme_specific_conditions(self, records):
        assert "MSAP" in labels(records["Young Talent Development Program (YTP)"])
        assert "3.90" in labels(records["Excellent Student Program (IPMa)"])


class TestExclusions:
    @pytest.mark.parametrize("name,url", [("postgraduate", POSTGRAD), ("advance_loan", ADVANCE), ("financing_index", FINANCING)])
    def test_recognised_pages_with_nothing_for_students_return_empty(self, name, url):
        assert MaraParser().parse(page(name), url) == []

    @pytest.mark.parametrize("name,url", [("postgraduate", POSTGRAD), ("financing_index", FINANCING)])
    def test_discovery_does_not_fall_back_to_generic_extraction(self, name, url):
        document = FetchedDocument(page(name), url)
        assert extract_candidates(document, None, None) == []

    def test_a_non_mara_page_raises(self):
        with pytest.raises(ValueError):
            MaraParser().parse("<html><body><p>nothing</p></body></html>", DIPLOMA)
