"""
Checkable criteria derived from scraped requirement wording
(scraper/parsers/requirements.py).
"""

from __future__ import annotations

from scraper.models import ScrapedCriterion, ScrapedScholarship
from scraper.parsers.requirements import spm_grade_rules, structure_criteria


def rules(line):
    return {(r.criterion_type, tuple(sorted(r.value.items()))) for r in spm_grade_rules(line)}


def other(label):
    return ScrapedCriterion("other", "contains", "provider-condition", label, is_checkable=False)


def record(levels, criteria):
    return ScrapedScholarship(
        name="Award", provider="P", source_url="https://p.example/a",
        education_levels=levels, criteria=criteria,
    )


# -- SPM grade phrasings -------------------------------------------------------
def test_count_of_a_grades_in_malay():
    assert rules("Memperoleh sekurang-kurangnya 8A (A+ dan A sahaja) dalam peperiksaan SPM terkini.") == {
        ("min_grade", (("count", 8), ("grade", "A"))),
    }


def test_a_plus_count_including_a_subject():
    assert rules("keputusan minima 5A+ termasuk Bahasa Melayu dalam peperiksaan SPM 2025.") == {
        ("min_grade", (("count", 5), ("grade", "A+"))),
        ("subject_grade", (("grade", "A+"), ("subject", "BM"))),
    }


def test_credits_in_words_with_named_subjects():
    line = "Sekurang-kurangnya lima kredit, termasuk Bahasa Melayu, Bahasa Inggeris dan Matematik dalam SPM."
    assert rules(line) == {
        ("min_grade", (("count", 5), ("grade", "C"))),
        ("subject_grade", (("grade", "C"), ("subject", "BM"))),
        ("subject_grade", (("grade", "C"), ("subject", "BI"))),
        ("subject_grade", (("grade", "C"), ("subject", "MATH"))),
    }


def test_english_grade_in_subjects_and_count():
    line = (
        "Pass your SPM by obtaining a minimum A in English and Mathematics and a minimum A- "
        "in at least 4 subjects according to the requirements of your preferred field of study."
    )
    assert rules(line) == {
        ("subject_grade", (("grade", "A"), ("subject", "BI"))),
        ("subject_grade", (("grade", "A"), ("subject", "MATH"))),
        ("min_grade", (("count", 4), ("grade", "A-"))),
    }


def test_named_subjects_after_mata_pelajaran_including_the_adverts_spelling():
    line = ("Sekurang-kurangnya mendapat 5B dalam mata pelajaram Biologi, Kimia, Fizik, "
            "Matematik Tambahan dan satu subjek lain pada peringkat SPM.")
    found = rules(line)
    assert ("min_grade", (("count", 5), ("grade", "B"))) in found
    codes = {dict(v)["subject"] for t, v in found if t == "subject_grade"}
    assert codes == {"BIOLOGY", "CHEMISTRY", "PHYSICS", "ADD_MATH"}  # not plain MATH


def test_credit_in_a_subject():
    assert rules("Must obtain a credit in Bahasa Melayu in the SPM examination") == {
        ("subject_grade", (("grade", "C"), ("subject", "BM"))),
    }


def test_alternative_exams_are_flagged():
    line = "credit in Bahasa Melayu in the SPM examination or its equivalent (UEC B6)"
    [rule] = spm_grade_rules(line)
    assert rule.value["alt"] is True


def test_lines_without_spm_or_with_only_unchecked_measures_give_nothing():
    assert spm_grade_rules("A-Level: Sekurang-kurangnya 3A") == []
    assert spm_grade_rules("STPM / Diploma: PNGK sekurang-kurangnya 3.50") == []
    assert spm_grade_rules("Pass your SPM with an aggregate of not more than 25 units") == []
    assert spm_grade_rules("minimum Level B1 in English (CEFR) in SPM") == []


# -- structuring a record ------------------------------------------------------
def test_education_level_row_is_added_first_and_checkable():
    r = structure_criteria(record(["spm", "diploma"], [other("Leadership qualities")]))
    first = r.criteria[0]
    assert (first.criterion_type, first.operator, first.value) == ("education_level", "in", ["spm", "diploma"])
    assert first.is_checkable and first.label == "Education level: SPM or Diploma"


def test_citizenship_becomes_checkable_unless_it_covers_parents():
    own = ScrapedCriterion("citizenship", "eq", "MY", "Malaysian citizen")
    parents = ScrapedCriterion("citizenship", "eq", "MY", "Applicant and both parents are citizens")
    r = structure_criteria(record(["spm"], [own, parents]))
    assert [c.is_checkable for c in r.criteria if c.criterion_type == "citizenship"] == [True, False]


def test_a_pure_grade_sentence_is_replaced_by_its_rules():
    line = "Kelayakan minima 5 kredit termasuk Bahasa Melayu dalam peperiksaan SPM."
    r = structure_criteria(record(["spm"], [other(line)]))
    assert line not in [c.label for c in r.criteria]
    assert {c.label for c in r.criteria if c.is_checkable} >= {
        "SPM: at least 5 credits (grade C or better)",
        "SPM: credit (grade C or better) in Bahasa Melayu",
    }


def test_a_sentence_with_other_conditions_is_kept_beside_its_rules():
    line = "Bagi pemohon Ijazah perlu CGPA 3.00 dan 5 kredit dalam SPM."
    r = structure_criteria(record(["stpm"], [other(line)]))
    assert line in [c.label for c in r.criteria]
    assert any(c.criterion_type == "min_grade" for c in r.criteria)


def test_route_specific_grade_rules_are_not_converted():
    overseas = other("overseas universities, SPM entry: Pass your SPM by obtaining minimum A in at least 8 subjects")
    uniten = other("UNITEN, SPM entry: Pass your SPM by obtaining a minimum A- in at least 4 subjects")
    r = structure_criteria(record(["spm"], [overseas, uniten]))
    assert not any(c.criterion_type in ("min_grade", "subject_grade") for c in r.criteria)
    assert overseas in r.criteria and uniten in r.criteria


def test_structuring_is_idempotent():
    r = structure_criteria(record(["spm"], [other("8A dalam SPM.")]))
    again = structure_criteria(r)
    assert [c.label for c in again.criteria] == [c.label for c in r.criteria]
