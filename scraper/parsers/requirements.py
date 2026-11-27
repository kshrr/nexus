"""
Turn scraped requirement wording into criteria Nexus can check against a
student's profile, without guessing.

Applied to every registered parser's output (BaseParser.extract). It adds or
upgrades only what is mechanical and unambiguous:

  * education level  — the record's entry levels become one checkable
    `education_level in [...]` row (the profile always stores a level)
  * citizenship      — "Malaysian citizen" rows become checkable; the profile's
    nationality is optional and self-declared, and an unanswered question is
    reported as "can't check", never as a failure
  * SPM grades       — common Malay/English phrasings become `min_grade`
    ({count, grade}: "at least N subjects at grade X or better") and
    `subject_grade` ({subject, grade}) rows checked against stored SPM results:
        "8A (A+ dan A sahaja) dalam peperiksaan SPM"   -> 8 subjects at A
        "minima 5A+ termasuk Bahasa Melayu … SPM"      -> 5 at A+, BM at A+
        "lima kredit, termasuk BM, BI dan Matematik"   -> 5 at C, each at C
        "kepujian dalam Bahasa Melayu … SPM"           -> BM at C
        "minimum A in English and Mathematics and a minimum A- in at least
         4 subjects"                                   -> BI, MATH at A; 4 at A-

What it deliberately leaves as "can't check":
  * age, income, state of origin, leadership, interviews, bonds, CGPA, CEFR,
    SPM aggregates — Nexus does not hold that data
  * a programme whose SPM grade rules differ by route (e.g. overseas vs UNITEN
    in one record): converting both would fail a student who qualifies through
    the other route, so those lines stay as the provider's wording
The provider's original sentence is kept unless it contains nothing beyond the
grade rules that were converted from it.
"""

from __future__ import annotations

import re

from ..models import ScrapedCriterion, ScrapedScholarship

LEVEL_LABELS = {
    "spm": "SPM",
    "stpm": "STPM",
    "stam": "STAM",
    "matriculation": "Matriculation",
    "foundation": "Foundation",
    "diploma": "Diploma",
}

#: Subject phrasing -> subjects.code (migration 0007). Longer/more specific
#: names first so "Matematik Tambahan" is not read as "Matematik".
SUBJECTS: list[tuple[re.Pattern, str, str]] = [
    (re.compile(r"Matematik\s+Tambahan|Additional\s+Mathematics?", re.I), "ADD_MATH", "Additional Mathematics"),
    (re.compile(r"Bahasa\s+Melayu|Bahasa\s+Malaysia|\bBM\b", re.I), "BM", "Bahasa Melayu"),
    (re.compile(r"Bahasa\s+Inggeris|\bEnglish\b", re.I), "BI", "English"),
    (re.compile(r"\bMatematik\b|\bMathematics\b|\bMaths?\b", re.I), "MATH", "Mathematics"),
    (re.compile(r"\bSejarah\b|\bHistory\b", re.I), "SEJARAH", "Sejarah"),
    (re.compile(r"\bFizik\b|\bPhysics\b", re.I), "PHYSICS", "Physics"),
    (re.compile(r"\bKimia\b|\bChemistry\b", re.I), "CHEMISTRY", "Chemistry"),
    (re.compile(r"\bBiologi\b|\bBiology\b", re.I), "BIOLOGY", "Biology"),
]

GRADE = r"(A\+|A-|A|B\+|B|C\+|C)"
NUMBER_WORDS = {
    "satu": 1, "dua": 2, "tiga": 3, "empat": 4, "lima": 5, "enam": 6, "tujuh": 7, "lapan": 8, "sembilan": 9,
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
}
COUNT = r"(\d{1,2}|" + "|".join(NUMBER_WORDS) + r")"

_SPM = re.compile(r"\bSPM\b|Sijil\s+Pelajaran\s+Malaysia", re.I)
# "8A", "5A+", "5B" — a number glued to a grade.
_COUNT_GRADE = re.compile(r"(?<![\w.])(\d{1,2})\s?" + GRADE + r"(?=[\s,()]|$)")
# "minimum A in at least 8 subjects", "minimum A- in at least 4 subjects"
_GRADE_IN_AT_LEAST = re.compile(r"minimum\s+" + GRADE + r"\s+in\s+at\s+least\s+" + COUNT + r"\s+subjects", re.I)
# "lima kredit", "5 credits", "3 kredit"
_CREDITS = re.compile(COUNT + r"\s+(?:kredit|credits?)\b", re.I)
# "minimum A in English and Mathematics" (not "… in at least N subjects")
_GRADE_IN_SUBJECTS = re.compile(r"minimum\s+(?:of\s+)?" + GRADE + r"\s+in\s+(?!at\s+least)([^.;]+?)(?=\s+and\s+(?:a\s+)?minimum|\s+and\s+have|[.;]|$)", re.I)
# "kepujian dalam (subjek) Bahasa Melayu", "credit in Bahasa Melayu"
_CREDIT_IN = re.compile(r"(?:kepujian|kredit|credit)\s+(?:dalam|in)\s+(?:the\s+)?(?:subjek\s+|subject\s+)?([^.;]+?)(?=\s+(?:subject|subjek)\b|\s+(?:dalam|in|pada)\s+(?:peperiksaan|the)|[.;]|$)", re.I)
# "termasuk X, Y dan Z" / "including X, Y and Z" after a count rule
_INCLUDING = re.compile(r"(?:termasuk|including)\s+([^.;]+?)(?=\s+(?:dalam|in|pada)\s+(?:peperiksaan|SPM|the)|[.;]|$)", re.I)
# "5B dalam mata pelajaran Biologi, Kimia, …"
# "mata pelajaram" is the advertisement's own spelling.
_IN_SUBJECTS = re.compile(r"(?:dalam\s+mata\s+pela[jr]ar?a[mn]|in\s+the\s+subjects?)\s+([^.;]+)", re.I)
# The requirement can also be met with another exam (STAM, UEC, O-Level …).
_ALTERNATIVE = re.compile(
    r"\bSTAM\b|\bUEC\b|O-?\s?Level|\bGCE\b|setara|equivalent|dan/atau|and/or|"
    r"lain\s+yang\s+diiktiraf|other\s+recogni[sz]ed",
    re.I,
)
# Anything else in the sentence that this module does not convert.
_OTHER_CONDITION = re.compile(
    r"CGPA|PNGK|STPM|A-?\s?Level|aggregate|agregat|units?\b|CEFR|kokurikulum|co-?curricular|umur|\bage\b|"
    r"warganegara|citizen|temuduga|interview|tawaran|offer|JPT|UEC|O-?\s?Level|STAM|Matrikulasi|Asasi|Diploma|"
    r"setaraf|equivalent|lain\s+yang\s+diiktiraf|other\s+recogni[sz]ed|leadership|kepimpinan|bidang|field",
    re.I,
)


def _count(word: str) -> int:
    return int(word) if word.isdigit() else NUMBER_WORDS[word.lower()]


def _subjects(span: str) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    rest = span
    for pattern, code, name in SUBJECTS:
        if pattern.search(rest):
            found.append((code, name))
            rest = pattern.sub(" ", rest)  # "Matematik Tambahan" must not also count as Matematik
    return found


def _grade_phrase(grade: str) -> str:
    return "A+" if grade == "A+" else f"{grade} or better"


def spm_grade_rules(line: str) -> list[ScrapedCriterion]:
    """Checkable SPM grade rules stated in one requirement sentence."""
    if not _SPM.search(line):
        return []
    rules: list[ScrapedCriterion] = []
    seen: set[str] = set()
    # When another exam also satisfies it, a student with no SPM results is
    # "can't check" rather than a failure (the evaluator reads `alt`).
    extra = {"alt": True} if _ALTERNATIVE.search(line) else {}

    def count_rule(n: int, grade: str) -> str:
        label = (
            f"SPM: at least {n} credits (grade C or better)"
            if grade == "C"
            else f"SPM: at least {n} subjects at grade {_grade_phrase(grade)}"
        )
        if label not in seen:
            seen.add(label)
            rules.append(ScrapedCriterion("min_grade", "gte", {"count": n, "grade": grade, **extra}, label, is_checkable=True))
        return grade

    def subject_rule(code: str, name: str, grade: str) -> None:
        label = (
            f"SPM: credit (grade C or better) in {name}"
            if grade == "C"
            else f"SPM: {name} at grade {_grade_phrase(grade)}"
        )
        if label not in seen:
            seen.add(label)
            rules.append(ScrapedCriterion("subject_grade", "gte", {"subject": code, "grade": grade, **extra}, label, is_checkable=True))

    last_grade = None
    for m in _GRADE_IN_AT_LEAST.finditer(line):
        last_grade = count_rule(_count(m.group(2)), m.group(1).upper())
    for m in _COUNT_GRADE.finditer(line):
        last_grade = count_rule(int(m.group(1)), m.group(2).upper())
    for m in _CREDITS.finditer(line):
        last_grade = count_rule(_count(m.group(1)), "C")
    for m in _GRADE_IN_SUBJECTS.finditer(line):
        for code, name in _subjects(m.group(2)):
            subject_rule(code, name, m.group(1).upper())
    for m in _CREDIT_IN.finditer(line):
        for code, name in _subjects(m.group(1)):
            subject_rule(code, name, "C")
    if last_grade:
        for pattern in (_INCLUDING, _IN_SUBJECTS):
            for m in pattern.finditer(line):
                for code, name in _subjects(m.group(1)):
                    subject_rule(code, name, last_grade)
    return rules


def _fully_converted(line: str) -> bool:
    """True when the sentence holds nothing but the SPM grade rules converted
    from it, so the provider's wording can give way to the checkable rows."""
    return not _OTHER_CONDITION.search(line)


def structure_criteria(record: ScrapedScholarship) -> ScrapedScholarship:
    """Add the checkable criteria described in the module docstring, in place."""
    out: list[ScrapedCriterion] = []
    if record.education_levels and not any(c.criterion_type == "education_level" for c in record.criteria):
        names = [LEVEL_LABELS.get(level, level) for level in record.education_levels]
        joined = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " or " + names[-1]
        out.append(
            ScrapedCriterion(
                "education_level", "in", list(record.education_levels),
                f"Education level: {joined}", is_checkable=True,
            )
        )

    grade_lines = [c for c in record.criteria if c.criterion_type == "other" and spm_grade_rules(c.label)]
    # Different grade rules for different routes of one programme: converting
    # them all would fail students who qualify through another route.
    convert = len(grade_lines) <= 1 or len({tuple(r.label for r in spm_grade_rules(c.label)) for c in grade_lines}) <= 1

    for criterion in record.criteria:
        if criterion.criterion_type == "citizenship" and str(criterion.value).upper() == "MY":
            # Only the applicant's own nationality is known; a row that also
            # requires the parents' citizenship stays the provider's wording.
            criterion.is_checkable = not re.search(r"parent|ibu|bapa", criterion.label, re.I)
            out.append(criterion)
            continue
        rules = spm_grade_rules(criterion.label) if convert and criterion in grade_lines else []
        if rules and _fully_converted(criterion.label):
            out.extend(r for r in rules if r.label not in [c.label for c in out])
            continue
        out.append(criterion)
        out.extend(r for r in rules if r.label not in [c.label for c in out])
    record.criteria = out
    return record
