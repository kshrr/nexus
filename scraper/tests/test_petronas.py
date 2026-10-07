"""
PETRONAS parser tests — against the real captured page.

scraper/tests/fixtures/petronas_students.html was fetched from
petronas.com/careers/students-graduates on 9 September 2026.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scraper.parsers.petronas import PetronasParser
from scraper.validate import validate

FIXTURE = (Path(__file__).parent / "fixtures" / "petronas_students.html").read_text(
    encoding="utf-8"
)


@pytest.fixture(scope="module")
def record():
    parser = PetronasParser()
    return parser.parse(FIXTURE, parser.index_url)[0]


class TestDiscovery:
    def test_discovery_returns_the_single_index_page(self):
        parser = PetronasParser()
        assert parser.discover(FIXTURE) == [parser.index_url]

    def test_discovery_stays_on_the_declared_path(self):
        parser = PetronasParser()
        for url in parser.discover(FIXTURE):
            assert url.startswith(parser.path_prefix)


class TestExtraction:
    def test_extracts_only_the_spm_leavers_programme(self, record):
        # Not "Internship", not "GEES" — those are not scholarships for
        # post-SPM students and must not be scraped.
        assert record.name == "Education Sponsorship (SPM Leavers)"

    def test_provider_is_petronas(self, record):
        assert record.provider == "PETRONAS"

    def test_entry_level_is_spm(self, record):
        assert record.education_levels == ["spm"]

    def test_disciplines_map_to_nexus_course_fields(self, record):
        # The page lists ~22 disciplines; only those with a Nexus course field
        # survive. Law, Marketing, Actuarial Science etc. are dropped, not
        # stored as fields that could never match a recommendation.
        assert "Engineering" in record.field_of_study
        assert "Computer Science" in record.field_of_study
        assert "Law" not in record.field_of_study
        assert "Marketing" not in record.field_of_study

    def test_a_closed_application_window_sets_expired(self, record):
        # The page says "The application for the sponsorship is now closed."
        # D-47: same state a past deadline produces — the student cannot apply
        # now. A future re-scrape flips it back when PETRONAS reopens.
        assert record.status == "expired"

    def test_no_deadline_is_invented(self, record):
        # The window is stated in prose with no date. Nothing is put in
        # `deadline` rather than guessing one.
        assert record.deadline is None

    def test_criteria_are_extracted_and_all_non_checkable(self, record):
        assert len(record.criteria) >= 3
        assert all(c.is_checkable is False for c in record.criteria)
        assert all(c.label.strip() for c in record.criteria)

    def test_criteria_keep_the_providers_wording(self, record):
        labels = " ".join(c.label for c in record.criteria)
        assert "SPM" in labels

    def test_explanatory_prose_is_not_stored_as_a_criterion(self, record):
        # Sentences like "We look beyond academics..." are context, not
        # requirements, and must not appear as eligibility checklist lines.
        for c in record.criteria:
            assert not c.label.startswith("We ")
            assert not c.label.startswith("This assessment")

    def test_a_page_without_the_tab_raises(self):
        with pytest.raises(ValueError):
            PetronasParser().parse("<html><body><p>nothing here</p></body></html>", "https://x.my")


class TestValidation:
    def test_the_record_passes_validation(self, record):
        # publishes_application_links is False for this source, so a missing
        # apply link is not a flag.
        validated = validate(record, expect_application_link=False)
        assert not any("application link" in f for f in validated.flags)

    def test_the_row_is_shaped_for_the_database(self, record):
        row = record.to_row()
        assert row["status"] == "expired"
        assert "is_manual" not in row
        assert row["education_levels"] == ["spm"]
