"""
Parser for yayasankhazanah.com — the Khazanah Global Scholarship Programme.

VERIFIED AGAINST THE LIVE SITE, 9 September 2026.
  robots.txt: "User-agent: * / Disallow:" — nothing is disallowed. No CAPTCHA,
  login wall or anti-bot challenge is encountered or circumvented.

WHY ONLY ONE PROGRAMME, AND ONLY THE DETAIL PAGE
  The /scholarship-programmes INDEX renders its programme cards with JavaScript
  — the served HTML shows "No results found". It cannot be scraped as an index.
  The one programme with a static, server-rendered detail page is the Khazanah
  Global Scholarship, so that page is the single target (like PETRONAS). If
  Khazanah later server-renders its index, `discover` can be widened then.

STRUCTURE
  XTopia CMS. The stable anchor is `div.accordian-header` (the CMS's own
  spelling) paired with the `div.item-content` that immediately follows it:
    * "General Information" — the description
    * "Eligibility"        — numbered criteria, split into "Foundation Studies"
                             (SPM entry) and "Undergraduate" (STPM / A-Level /
                             diploma / foundation / matriculation entry)
    * "Subject Areas"      — JSON arrays of disciplines
  A "Programme Summary" block carries the recurring application window and the
  coverage ("Full"). There is no application DATE — the window is stated as a
  month, yearly — so nothing goes in `deadline`; the window is appended to the
  description instead (the same choice `models.py` documents for an opening
  date with no column).
"""

from __future__ import annotations

import json
import re

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..parsers.keywords import match_fields, match_levels
from ..sanitise import clean_text

BASE = "https://www.yayasankhazanah.com.my"

_CYCLE = re.compile(r"Application Cycle\s*(.+?)\s*(?:Scholarship Coverage|\*|$)", re.I | re.S)
_COVERAGE = re.compile(r"Scholarship Coverage\s*([A-Za-z][\w /]{1,40})", re.I)


class KhazanahParser(BaseParser):
    source_id = "khazanah"
    provider = "Yayasan Khazanah"
    index_url = f"{BASE}/scholarship-programmes/khazanah-global-scholarship-programme"
    path_prefix = f"{BASE}/scholarship-programmes/"
    max_targets = 1
    publishes_application_links = False

    def discover(self, html: str) -> list[str]:
        return self.guard([self.index_url])

    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        soup = BeautifulSoup(html, "html.parser")

        name = self._name(soup)
        if not name:
            raise ValueError("no programme title — not the expected page")

        sections = self._sections(soup)
        general = sections.get("General Information", "")
        eligibility = sections.get("Eligibility", "")
        subjects = sections.get("Subject Areas", "")
        if not eligibility:
            raise ValueError("no Eligibility section — page structure changed")

        page_text = soup.get_text(" ", strip=True)
        description = self._description(general, page_text)
        coverage_match = _COVERAGE.search(page_text)

        record = ScrapedScholarship(
            name=name,
            provider=self.provider,
            source_url=url,
            description=description,
            funding_amount=coverage_match.group(1).strip() if coverage_match else None,
            education_levels=match_levels(eligibility),
            field_of_study=match_fields(subjects or eligibility),
            deadline=None,  # a recurring month, never a date — see module docstring
        )
        record.criteria = self._criteria(eligibility)
        return [record]

    # -- helpers ---------------------------------------------------------
    def _name(self, soup: BeautifulSoup) -> str | None:
        if soup.title:
            raw = soup.title.get_text(strip=True).split(" - ")[0].split(" | ")[0]
            value, _ = clean_text(raw, "name")
            if value and "khazanah" in value.lower():
                return value
        h = soup.find(["h1", "h2"])
        if h:
            value, _ = clean_text(h.get_text(" ", strip=True), "name")
            return value
        return None

    def _sections(self, soup: BeautifulSoup) -> dict[str, str]:
        out: dict[str, str] = {}
        for hdr in soup.select("div.accordian-header"):
            title = hdr.get_text(" ", strip=True)
            body = hdr.find_next_sibling()
            if not title or body is None:
                continue
            value, _ = clean_text(body.get_text("\n", strip=True), "description")
            if value:
                out[title] = value
        return out

    def _description(self, general: str, page_text: str) -> str | None:
        value, _ = clean_text(general, "description")
        value = value or ""
        cycle = _CYCLE.search(page_text)
        if cycle:
            window, _ = clean_text(cycle.group(1), "description")
            if window:
                # No date column — record the recurring window in the prose.
                value = f"{value} Application window: {window}".strip()
        return value or None

    def _criteria(self, eligibility: str) -> list[ScrapedCriterion]:
        """One criterion per requirement line. A line under 'Foundation Studies'
        or 'Undergraduate' keeps that heading as context. All non-checkable —
        Nexus stores no SPM aggregate grade, CEFR band, age or leadership record
        to verify any of them against."""
        out: list[ScrapedCriterion] = []
        heading = ""
        for raw in eligibility.split("\n"):
            line = raw.strip(" .;*")
            if not line:
                continue
            if line in ("Foundation Studies", "Undergraduate (Bachelor's Degree)", "Undergraduate"):
                heading = line
                continue
            if line.isdigit() or len(line) < 12 or len(line) > 240:
                continue
            value, _ = clean_text(line, "label")
            if not value:
                continue
            label = f"{heading}: {value}" if heading else value
            if label not in [c.label for c in out]:
                out.append(
                    ScrapedCriterion(
                        criterion_type="other",
                        operator="contains",
                        value="provider-condition",
                        label=label,
                        is_checkable=False,
                    )
                )
            if len(out) >= 12:
                break
        return out
