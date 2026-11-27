"""
Parser for mara.gov.my — Majlis Amanah Rakyat education financing
(English pages under /en/index/education/education-financing/).

VERIFIED AGAINST THE LIVE SITE, 22 November 2026.
  robots.txt disallows only /wp-admin/ (admin-ajax.php allowed); the content
  tree carries no Disallow. Pages are WordPress + the Enfold theme and are
  served as complete HTML: every programme's introduction and terms are in the
  response body (the tabs are CSS-toggled, not fetched by JavaScript). No
  CAPTCHA, login wall or anti-bot challenge is encountered or circumvented.

  This replaces the 9 September 2026 "not scraped" note: biasiswa.mara.gov.my
  still does not resolve, but the main site now has a stable index of
  financing levels, enumerated in its WordPress sitemap.

WHICH PROGRAMMES
  Index: .../education-financing/ links to four level pages. Its menu links are
  `?page_id=` permalinks that redirect, so the verified canonical pages are
  pinned in TARGETS rather than derived from those links (the same approach
  as YSD's single pinned page).

    preparatory level        Young Talent Development Program (YTP)  EXTRACTED
    diploma & degree levels  Tertiary Education Loan Program (TESP)  EXTRACTED
                             Excellent Student Program (IPMa)        EXTRACTED
    post-graduate levels     GrEP, Pro-P (Master's / PhD / professional)
                             — not post-SPM, skipped like JPA's serving-officer
                             programmes.                             SKIPPED
    student advance loan     RM2,000 registration-fee loan, not a sponsorship
                             programme.                              SKIPPED

  A skipped page still parses to an empty list (recognised, nothing for a
  post-SPM student), so web discovery does not fall back to generic
  extraction and stage it anyway.

STRUCTURE
  Two layouts share one walk over #main in document order:
    * tab layout (diploma/degree, post-graduate): an `h3.av-special-heading-tag`
      names the programme, then `section.av_tab_section` blocks carry the
      "Introduction" / "Terms of Application" / "Others" tabs
    * heading layout (preparatory): `h3.av-special-heading-tag` headings for the
      programme and for each section label, each followed by a
      `div.avia_textblock`
  An h3 that is a known section label opens a section; any other h3 opens a
  new programme.

FUNDING
  MARA education financing is a loan (convertible on excellent results for
  some programmes). No page states an amount, so funding_amount is left empty
  rather than inferred; the introduction text is kept as the description.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..parsers.keywords import match_fields, match_levels
from ..sanitise import clean_text

BASE = "https://www.mara.gov.my"
FINANCING = f"{BASE}/en/index/education/education-financing/"

#: The level pages that hold post-SPM programmes. Post-graduate and advance
#: loan pages are deliberately absent (see module docstring).
TARGETS = (
    f"{FINANCING}peringkat-persediaan-2/",
    f"{FINANCING}peringkat-diploma-ijazah-2/",
)

_SECTION_LABELS = {
    "introduction": "introduction",
    "terms of application": "terms",
    "terms of sponsorship": "terms",
    "others": "others",
}
_INTRO_PREFIX = re.compile(r"^introduction\s+to\s+(?:the\s+)?", re.I)
_POSTGRAD = re.compile(
    r"post[\s-]?graduate|master'?s?\s+degree|doctor\s+of\s+philosophy|\bph\.?d\b|"
    r"professional\s*/\s*expertise",
    re.I,
)
# Section sub-headings and table headers that carry no condition of their own.
_NOISE = re.compile(
    r"^(?:introduction|general terms|academic terms|terms of application|"
    r"terms of sponsorship|others|level|age limit|education level|"
    r"place of education)$",
    re.I,
)
_CITIZEN = re.compile(r"\bcitizen", re.I)
_BUMIPUTERA = re.compile(r"bumiputera", re.I)
_INCOME = re.compile(r"\bB40\b|\bM40\b", re.I)
_AGE_EXACT = re.compile(r"\baged?\s+(\d{2})\b", re.I)
_AGE_TABLE = re.compile(r"age\s+limit", re.I)


class MaraParser(BaseParser):
    source_id = "mara"
    provider = "Majlis Amanah Rakyat (MARA)"
    index_url = FINANCING
    path_prefix = FINANCING
    max_targets = len(TARGETS)
    # Applications open seasonally through MARA's own portals, which the level
    # pages do not link per programme.
    publishes_application_links = False

    def discover(self, html: str) -> list[str]:
        return self.guard(list(TARGETS))

    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        soup = BeautifulSoup(html, "html.parser")
        main = soup.select_one("#main")
        if main is None or main.select_one(".post-entry") is None:
            raise ValueError("no #main .post-entry — not a MARA content page")

        out: list[ScrapedScholarship] = []
        for name, sections in self._programmes(main):
            record = self._record(name, sections, url)
            if record is not None:
                out.append(record)
        return out

    # -- structure walk --------------------------------------------------
    def _programmes(self, main) -> list[tuple[str, dict[str, list[str]]]]:
        programmes: list[tuple[str, dict[str, list[str]]]] = []
        current: dict[str, list[str]] | None = None
        section = "introduction"

        def is_block(tag) -> bool:
            classes = tag.get("class") or []
            if tag.name == "h3" and "av-special-heading-tag" in classes:
                return True
            if tag.name == "section" and "av_tab_section" in classes:
                return True
            return (
                tag.name == "div"
                and "avia_textblock" in classes
                and tag.find_parent("section", class_="av_tab_section") is None
            )

        for block in main.find_all(is_block):
            if block.name == "h3":
                text = block.get_text(" ", strip=True)
                label = _SECTION_LABELS.get(text.lower())
                if label:
                    section = label
                    continue
                if not text:
                    continue
                current = {}
                section = "introduction"
                programmes.append((_INTRO_PREFIX.sub("", text), current))
                continue
            if current is None:
                continue  # index menu tabs, advance-loan blocks: no programme
            if block.name == "section":
                title = block.select_one(".tab")
                body = block.select_one(".tab_content")
                label = _SECTION_LABELS.get(
                    title.get_text(" ", strip=True).lower() if title else "", "others"
                )
                if body is not None:
                    current.setdefault(label, []).extend(_lines(body))
                continue
            current.setdefault(section, []).extend(_lines(block))
        return programmes

    # -- record ----------------------------------------------------------
    def _record(
        self, name: str, sections: dict[str, list[str]], url: str
    ) -> ScrapedScholarship | None:
        intro = [ln for ln in sections.get("introduction", []) if not _NOISE.match(ln)]
        terms = [ln for ln in sections.get("terms", []) if not _NOISE.match(ln)]
        others = [ln for ln in sections.get("others", []) if not _NOISE.match(ln)]
        intro_text = " ".join(intro)
        if _POSTGRAD.search(intro_text) or _POSTGRAD.search(name):
            return None

        name_value, _ = clean_text(name, "name")
        if not name_value:
            return None
        description, _ = clean_text(intro_text, "description")

        # Entry levels come from who the programme is "for", not from the
        # programmes it funds: YTP sends SPM leavers INTO foundation/A-Levels,
        # so the preparatory list in its introduction must not become a level.
        who = intro[0] if intro else ""
        levels = match_levels(f"{who} {' '.join(terms)}")
        if re.search(r"\bIPMa\b", name) and "diploma" not in levels:
            levels.append("diploma")  # IPMa certificate/diploma students

        record = ScrapedScholarship(
            name=name_value,
            provider=self.provider,
            source_url=url,
            description=description,
            education_levels=list(dict.fromkeys(levels)),
            field_of_study=match_fields(" ".join(others)),
        )
        record.criteria = self._criteria(terms, others)
        return record

    def _criteria(self, terms: list[str], others: list[str]) -> list[ScrapedCriterion]:
        """Typed rows where the wording is unambiguous, the provider's own
        wording for the rest. Every row is non-checkable for the same reasons
        documented on JpaParser._criteria: Nexus collects no citizenship,
        ethnicity, age or income, and guessing a predicate from prose would put
        a red cross against a student who qualifies."""
        out: list[ScrapedCriterion] = []
        combined = terms + others

        def add(kind, op, value, label):
            text, _ = clean_text(label, "label")
            if text and text not in [c.label for c in out]:
                out.append(ScrapedCriterion(kind, op, value, text, is_checkable=False))

        if any(_CITIZEN.search(ln) for ln in combined):
            add("citizenship", "eq", "MY", "Malaysian citizen")
        for line in combined:
            if _BUMIPUTERA.search(line):
                add("other", "contains", "bumiputera", line)
                break
        for line in combined:
            exact = _AGE_EXACT.search(line)
            if exact:
                add("age", "eq", int(exact.group(1)), line)
                break
        else:
            limits = _age_table(combined)
            if limits:
                add("other", "contains", "age-limit", f"Age limit: {limits}")
        if any(_INCOME.search(ln) for ln in combined):
            add(
                "other",
                "contains",
                "household-income",
                "Household income category is considered (B40 / M40 prioritised)",
            )

        for line in combined:
            if len(out) >= 14:
                break
            if not (15 <= len(line) <= 240):
                continue
            if _CITIZEN.search(line) or _BUMIPUTERA.search(line) or _AGE_EXACT.search(line):
                continue
            if _AGE_TABLE.search(line) or "|" in line:
                continue  # age-table header/rows, already summarised above
            if _INCOME.search(line) and len(line) < 40:
                continue  # "Priority for the B40 Group" — the typed row says it
            add("other", "contains", "provider-condition", line)
        return out


def _lines(node) -> list[str]:
    """Readable lines from a content block: one per list item, paragraph or
    table row, without the duplicate text a nested element would add, and with
    inline markup (e.g. an <em> inside a list item) kept on its line."""
    out: list[str] = []
    for el in node.find_all(["p", "li", "tr"]):
        if el.find_parent(["li", "tr"]) is not None:
            continue
        if el.name == "tr":
            cells = [c.get_text(" ", strip=True) for c in el.find_all(["td", "th"])]
            text = " | ".join(c for c in cells if c)
        else:
            text = el.get_text(" ", strip=True)
        text = re.sub(r"\s+", " ", text).replace("( ", "(").replace(" )", ")").strip()
        if text:
            out.append(text)
    return out


def _age_table(lines: list[str]) -> str | None:
    """'Diploma | < 30 years' rows -> 'Diploma < 30 years; ...'."""
    rows = []
    for line in lines:
        cells = [c.strip() for c in line.split("|")]
        if len(cells) == 2 and re.search(r"\d{2}\s*years", cells[1], re.I):
            rows.append(f"{cells[0]} {cells[1]}")
    return "; ".join(rows) or None
