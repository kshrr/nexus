"""
Keyword → Nexus-value maps shared by the provider parsers.

These live in one place because every parser needs the SAME target vocabulary:

  * education levels must be the `profiles.education_level` enum values
    (architecture.md §3.9), or a scraped scholarship never matches a student's
    filter
  * field-of-study names must be the `courses.field_of_study` values seeded in
    migration 0009, or the §10.5 relevance signal (scholarship field ∩
    recommended-course field) is always empty

The PATTERNS are deliberately broad — provider sites write "kejuruteraan",
"engineering", "Chemical Engineering" — but the RIGHT-HAND side is always a
value that already exists in the schema. A parser adds nothing to this list; it
only reads it. Anything a page mentions that is not here is dropped, not
invented into a new category.
"""

from __future__ import annotations

import re

#: Entry-qualification phrasing → profiles.education_level enum.
LEVEL_KEYWORDS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bSPM\b|Sijil\s+Pelajaran\s+Malaysia", re.I), "spm"),
    (re.compile(r"\bSTPM\b|Sijil\s+Tinggi\s+Persekolahan", re.I), "stpm"),
    (re.compile(r"\bSTAM\b|Sijil\s+Tinggi\s+Agama", re.I), "stam"),
    (re.compile(r"matrikulasi|matriculation", re.I), "matriculation"),
    (re.compile(r"\basasi\b|foundation", re.I), "foundation"),
    (re.compile(r"\bdiploma\b", re.I), "diploma"),
]

#: Discipline phrasing → courses.field_of_study (migration 0009).
#: Several patterns map to the same field on purpose: the demo course set groups
#: all engineering branches under "Engineering", so a Petroleum Engineering
#: scholarship should carry that same label to overlap an Engineering course.
FIELD_KEYWORDS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"perubatan|\bmedic", re.I), "Medicine"),
    (re.compile(r"pergigian|dent(al|istry)", re.I), "Medicine"),
    (re.compile(r"farmasi|pharmac", re.I), "Pharmacy"),
    (re.compile(r"bioperubatan|biomedic", re.I), "Biomedical Science"),
    (re.compile(r"sains\s+data|data\s+science", re.I), "Data Science"),
    (
        re.compile(
            r"sains\s+komputer|computer\s+science|software\s+engineer|"
            r"teknologi\s+maklumat|information\s+technology",
            re.I,
        ),
        "Computer Science",
    ),
    (re.compile(r"seni\s?bina|architect", re.I), "Architecture"),
    # Keep last: "engineering" is a substring of many specific disciplines, so
    # the more specific software/architecture rules above win first.
    (
        re.compile(
            r"kejurutera|\bengineering\b|mechanical|mechatronic|electrical|"
            r"petroleum|chemical|civil\s+engineer|marine\s+engineer|"
            r"naval|maritime|instrumentation",
            re.I,
        ),
        "Engineering",
    ),
]


def match_levels(text: str) -> list[str]:
    """Education levels named in `text`, de-duplicated, first-seen order."""
    found = [level for pattern, level in LEVEL_KEYWORDS if pattern.search(text or "")]
    return list(dict.fromkeys(found))


#: Words that turn a clause into an EXCLUSION — "we do not sponsor Medicine",
#: "any field except Law", "not including Architecture". Matching a field name
#: inside one of these and storing it as accepted is the worst kind of scraper
#: error: a student is told a scholarship is open to them when the provider has
#: said the opposite. Any clause containing one of these is dropped whole
#: before field matching.
_NEGATION = re.compile(
    r"\b(?:do(?:es)?\s+not|don't|will\s+not|won't|cannot|can't|except|excepting|"
    r"excludes?|excluding|not\s+eligible|not\s+sponsor|not\s+offer|not\s+cover)\b",
    re.I,
)

#: Clause boundaries: sentence punctuation, semicolons, newlines, and the gaps
#: between the JSON arrays some CMSes emit for a discipline list.
_CLAUSE_SPLIT = re.compile(r"[.!?;\n]|\]\s*\[|\]\s|\s\[")


def _split_clauses(text: str) -> tuple[str, str]:
    """Return (positive_text, negative_text) — the clauses that list fields and
    the clauses that rule fields out."""
    positive, negative = [], []
    for part in _CLAUSE_SPLIT.split(text or ""):
        (negative if _NEGATION.search(part) else positive).append(part)
    return " . ".join(positive), " . ".join(negative)


def match_fields(text: str) -> list[str]:
    """Nexus course fields named in `text`, de-duplicated, first-seen order.

    A field named inside an exclusion clause ("we do not sponsor Medicine",
    "any field except Architecture") is removed from the result even if the same
    field is also listed positively elsewhere on the page — an explicit
    "we do not sponsor X" is the provider's clearest statement and it wins.
    Storing a ruled-out field as accepted is the worst kind of scraper error.
    """
    positive, negative = _split_clauses(text)
    accepted = [f for pat, f in FIELD_KEYWORDS if pat.search(positive)]
    excluded = {f for pat, f in FIELD_KEYWORDS if pat.search(negative)}
    return list(dict.fromkeys(f for f in accepted if f not in excluded))
