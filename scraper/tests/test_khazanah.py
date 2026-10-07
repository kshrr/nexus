"""
Yayasan Khazanah parser tests — against the real captured detail page
(scraper/tests/fixtures/khazanah_global.html, fetched 9 September 2026).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scraper.parsers.khazanah import KhazanahParser
from scraper.validate import validate

FIXTURE = (Path(__file__).parent / "fixtures" / "khazanah_global.html").read_text(
    encoding="utf-8"
)


@pytest.fixture(scope="module")
def record():
    parser = KhazanahParser()
    return parser.parse(FIXTURE, parser.index_url)[0]


class TestDiscovery:
    def test_targets_only_the_server_rendered_detail_page(self):
        # The programme INDEX is JavaScript-rendered and cannot be scraped;
        # discovery points straight at the one static detail page.
        parser = KhazanahParser()
        assert parser.discover(FIXTURE) == [parser.index_url]
        assert parser.index_url.startswith(parser.path_prefix)


class TestExtraction:
    def test_name_and_provider(self, record):
        assert record.name == "Khazanah Global Scholarship Programme"
        assert record.provider == "Yayasan Khazanah"

    def test_entry_levels_cover_both_pathways(self, record):
        # Foundation Studies (SPM entry) and Undergraduate (STPM / A-Level /
        # diploma / foundation / matriculation entry).
        assert "spm" in record.education_levels
        assert {"stpm", "diploma"} & set(record.education_levels)

    def test_fields_exclude_what_khazanah_says_it_does_not_sponsor(self, record):
        # "We do not sponsor degree programmes in Medicine, Dentistry,
        # Veterinary Science or Architecture." — neither may be stored.
        assert "Medicine" not in record.field_of_study
        assert "Architecture" not in record.field_of_study

    def test_a_sponsored_field_is_still_picked_up(self, record):
        assert "Computer Science" in record.field_of_study or "Engineering" in record.field_of_study

    def test_coverage_is_recorded(self, record):
        assert record.funding_amount == "Full"

    def test_recurring_window_goes_in_the_description_not_the_deadline(self, record):
        # There is no application DATE, only a recurring month.
        assert record.deadline is None
        assert "Application window" in (record.description or "")

    def test_criteria_are_all_non_checkable_with_pathway_context(self, record):
        assert len(record.criteria) >= 5
        assert all(c.is_checkable is False for c in record.criteria)
        joined = " ".join(c.label for c in record.criteria)
        assert "Foundation Studies" in joined or "Undergraduate" in joined

    def test_a_wrong_page_raises(self):
        with pytest.raises(ValueError):
            KhazanahParser().parse("<html><body><h1>Something else</h1></body></html>", "https://x.my")


class TestValidation:
    def test_the_record_passes_validation(self, record):
        validate(record, expect_application_link=False)
        assert record.name

    def test_row_shape(self, record):
        row = record.to_row()
        assert "is_manual" not in row
        assert row["funding_amount"] == "Full"
