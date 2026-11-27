"""
Parser for yayasansarawak.org.my — Yayasan Sarawak (Sarawak Foundation)
scholarships, grants and education loans (English pages).

VERIFIED AGAINST THE LIVE SITE, 22 November 2026.
  WordPress. robots.txt (reached through a /my/ redirect on the www host, and
  directly at the bare host) disallows only /wp-admin/. Programme content is
  served as complete HTML in Bootstrap collapse panels; no CAPTCHA, login wall
  or anti-bot challenge is encountered or circumvented.

TARGETS
    /en/biasiswa/   scholarships, grants, bursary
    /en/pinjaman/   education loans
  The /my/ pages are Malay mirrors of the same programmes. Every page on the
  host routes to this parser so a search hit on a mirror (or on a news post)
  returns [] instead of being generically staged as a duplicate.

WHICH PROGRAMMES
  Extracted (post-SPM): BYSTT, YBSTAR, UNIMAS Special Medical Program
  Scholarship, Admission Assistance to Tertiary / Technical Education, BP40
  Bursary, Local Education Scholarship Loan, Overseas Education Loan,
  Technical Training Scholarship Loan.
  Skipped: Sarawak Foundation Local Scholarship (BTYS — Form 1 to Form 6
  school aid) and i-GPS (a flight-fare subsidy, not study funding).

STRUCTURE
  `.panel-group .panel`: `h4.panel-title` is the programme name and
  `.panel-collapse` holds `.table-area` rows, each a `.table-cell-1` label
  (Objective / Requirement / Assistance / Application / Elements of Scholarship
  Payment / Required documents) and a `.table-cell-2` body.

EDUCATION LEVELS
  A student's level is what they hold when applying, so it is derived from the
  level of study funded rather than read off "SPM" (every programme requires an
  SPM Bahasa Melayu credit, which is not an entry level):
    funds foundation / matriculation / certificate / diploma study -> spm
    funds bachelor's / first-degree study -> stpm, matriculation, foundation, diploma
  plus any qualification the requirements name ("CGPA 3.00 for STPM /
  Matriculation / Foundation / Diploma"). Programmes that state neither (the
  UNIMAS medical award, the overseas and technical loans) are left empty for an
  administrator to confirm rather than guessed.

  Application links all point at an http:// IP-address portal, which the
  https-only allowlist rejects, so none is stored; the student is sent to the
  official page instead (publishes_application_links = False).
"""

from __future__ import annotations

import re
from urllib.parse import urlsplit

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..parsers.keywords import match_fields, match_levels
from ..sanitise import clean_text

BASE = "https://yayasansarawak.org.my"
TARGETS = (f"{BASE}/en/biasiswa/", f"{BASE}/en/pinjaman/")

_SKIP = re.compile(r"\bForm\s+1\s+to\s+Form\s+6\b|secondary\s+schools?|subsidi[sz]ing\s+flights", re.I)
_STUDY_SPAN = re.compile(
    r"(?:entry\s+level|studies\s+at|study\s+at|continue\s+their\s+studies\s+at)[^.;]*", re.I
)
_PRE_DEGREE = re.compile(r"foundation|matriculation|certificate|pre\s*diploma|\bdiploma\b", re.I)
_DEGREE = re.compile(r"bachelor|first\s+degree", re.I)
_QUALIFICATION = re.compile(r"cgpa|pngk", re.I)
_CITIZEN = re.compile(r"^malaysian(?:\s+citizens?)?\.?$", re.I)
_SARAWAKIAN = re.compile(r"sarawakian", re.I)
_INCOME = re.compile(r"per\s+capita|income|\bB40\b|\bM40\b", re.I)
_AGE = re.compile(r"\bage", re.I)
_FUNDING = re.compile(r"RM\s?[\d,]+|\bfees?\b|allowance|\d+\s*%|grant", re.I)
DEGREE_FEEDERS = ["stpm", "matriculation", "foundation", "diploma"]


class YayasanSarawakParser(BaseParser):
    source_id = "yayasan_sarawak"
    provider = "Yayasan Sarawak"
    index_url = TARGETS[0]
    path_prefix = f"{BASE}/"
    max_targets = len(TARGETS)
    publishes_application_links = False

    def discover(self, html: str) -> list[str]:
        return self.guard(list(TARGETS))

    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        soup = BeautifulSoup(html, "html.parser")
        if urlsplit(url).path.startswith("/my/"):
            return []  # Malay mirror of the English target pages
        panels = soup.select(".panel-group .panel")
        if not panels:
            if soup.select_one("body"):
                return []  # news post or other non-programme page on the host
            raise ValueError("not an HTML page")

        out: list[ScrapedScholarship] = []
        for panel in panels:
            title = panel.select_one(".panel-title")
            body = panel.select_one(".panel-collapse")
            if title is None or body is None:
                continue
            sections = _sections(body)
            objective = " ".join(sections.get("objective", []))
            if not objective or _SKIP.search(objective):
                continue
            record = self._record(title.get_text(" ", strip=True), sections, url)
            if record is not None:
                out.append(record)
        if not out and panels:
            raise ValueError("panels present but no programme extracted")
        return out

    def _record(self, name: str, sections: dict[str, list[str]], url: str):
        name_value, _ = clean_text(name, "name")
        if not name_value:
            return None
        objective = sections.get("objective", [])
        requirements = sections.get("requirement", [])
        funding = " ".join(
            sections.get("elements of scholarship payment") or sections.get("assistance") or []
        )
        if not _FUNDING.search(funding):
            # e.g. the local loan's "Assistance" is a payment schedule, not an
            # amount; BP40 states its 80% subsidy in the objective instead.
            spans = [
                m.group(0).strip()
                for m in re.finditer(r"(?:subsidi[sz]ed|covering)[^.]*?\d+\s*%[^.]*", " ".join(objective), re.I)
            ]
            funding = " ".join(spans)

        record = ScrapedScholarship(
            name=name_value,
            provider=self.provider,
            source_url=url,
            description=clean_text(" ".join(objective), "description")[0],
            funding_amount=clean_text(funding, "funding_amount")[0] if funding else None,
            education_levels=_levels(objective + requirements),
            field_of_study=match_fields(" ".join(objective)),
        )
        record.criteria = _criteria(requirements)
        return record


def _sections(body) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for row in body.select(".table-area"):
        label_el = row.select_one(".table-cell-1")
        content = row.select_one(".table-cell-2")
        if label_el is None or content is None:
            continue
        label = re.sub(r"[^a-z ]", "", label_el.get_text(" ", strip=True).lower()).strip()
        label = {"objectives": "objective", "requirements": "requirement"}.get(label, label)
        # Top-level items only: a nested list stays inside its parent's line.
        items = [li for li in content.find_all("li") if li.find_parent("li") is None]
        lines = [el.get_text(" ", strip=True) for el in items] if items else [content.get_text(" ", strip=True)]
        lines = [re.sub(r"\s+", " ", ln).replace(" .", ".").replace(" ,", ",").strip() for ln in lines]
        out.setdefault(label, []).extend(ln for ln in lines if ln)
    return out


def _levels(lines: list[str]) -> list[str]:
    levels: list[str] = []
    for line in lines:
        for span in _STUDY_SPAN.findall(line):
            if _PRE_DEGREE.search(span):
                levels.append("spm")
            if _DEGREE.search(span):
                levels.extend(DEGREE_FEEDERS)
        if _QUALIFICATION.search(line):
            levels.extend(lvl for lvl in match_levels(line) if lvl != "spm")
    return list(dict.fromkeys(levels))


def _criteria(requirements: list[str]) -> list[ScrapedCriterion]:
    """Non-checkable rows in the provider's wording (see JpaParser._criteria)."""
    out: list[ScrapedCriterion] = []

    def add(kind, op, value, label):
        text, _ = clean_text(label, "label")
        if text and text not in [c.label for c in out] and len(out) < 14:
            out.append(ScrapedCriterion(kind, op, value, text, is_checkable=False))

    for line in requirements:
        if _CITIZEN.match(line):
            add("citizenship", "eq", "MY", "Malaysian citizen")
        elif _SARAWAKIAN.search(line) and len(line) < 160:
            add("other", "contains", "sarawakian", line)
        elif _INCOME.search(line):
            add("other", "contains", "household-income", line)
        elif _AGE.match(line):
            add("other", "contains", "age-limit", line)
        else:
            add("other", "contains", "provider-condition", line)
    return out
