"""
Yayasan Sime Darby parser tests — against the real captured page
(scraper/tests/fixtures/ysd_scholarship.html, fetched 9 September 2026).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scraper.parsers.ysd import YsdParser
from scraper.validate import validate

FIXTURE = (Path(__file__).parent / "fixtures" / "ysd_scholarship.html").read_text(
    encoding="utf-8"
)


@pytest.fixture(scope="module")
def records():
    parser = YsdParser()
    return {r.name: r for r in parser.parse(FIXTURE, parser.index_url)}


class TestDiscovery:
    def test_single_page_target_on_the_declared_path(self):
        parser = YsdParser()
        urls = parser.discover(FIXTURE)
        assert urls == [parser.index_url]
        assert all(u.startswith(parser.path_prefix) for u in urls)


class TestExtraction:
    def test_extracts_the_public_programmes(self, records):
        assert "YSD Undergraduate Excellence Scholarship" in records
        assert "YSD Special Needs Bursary" in records
        # the three TVET bursaries, however they are named
        assert len(records) >= 5

    def test_employee_programmes_are_not_scraped(self, records):
        # EEP / ECEP are staff benefits, not public scholarships.
        for name in records:
            assert "employee" not in name.lower()

    def test_provider_is_set(self, records):
        assert all(r.provider == "Yayasan Sime Darby" for r in records.values())

    def test_undergraduate_entry_levels(self, records):
        r = records["YSD Undergraduate Excellence Scholarship"]
        # entered with STPM / matriculation / foundation / diploma, not raw SPM
        assert "spm" not in r.education_levels
        assert {"stpm", "foundation", "diploma"} & set(r.education_levels)

    def test_a_negated_field_is_never_stored_as_accepted(self, records):
        # The Special Needs Bursary says "any fields of study except for
        # medicine" — Medicine must NOT appear as an accepted field.
        r = records["YSD Special Needs Bursary"]
        assert "Medicine" not in r.field_of_study

    def test_every_criterion_is_non_checkable(self, records):
        for r in records.values():
            assert all(c.is_checkable is False for c in r.criteria)
            assert all(c.label.strip() for c in r.criteria)

    def test_criteria_keep_the_providers_wording(self, records):
        labels = " ".join(
            c.label for c in records["YSD Undergraduate Excellence Scholarship"].criteria
        )
        assert "Malaysian" in labels

    def test_funding_is_captured(self, records):
        r = records["YSD Undergraduate Excellence Scholarship"]
        assert r.funding_amount and "Tuition" in r.funding_amount

    def test_a_page_without_accordions_raises(self):
        with pytest.raises(ValueError):
            YsdParser().parse("<html><body><p>nothing</p></body></html>", "https://x.my")


class TestValidation:
    def test_all_records_pass_validation(self, records):
        for r in records.values():
            validate(r, expect_application_link=False)
            # nothing rejected; flags (if any) are advisory, not blocking
            assert r.name

    def test_rows_are_shaped_for_the_database(self, records):
        for r in records.values():
            row = r.to_row()
            assert "is_manual" not in row
            assert row["provider"] == "Yayasan Sime Darby"
