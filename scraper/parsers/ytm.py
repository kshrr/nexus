"""
Parser for ytm.tm.com.my — Yayasan Telekom Malaysia (YTM) scholarships.

VERIFIED AGAINST THE LIVE SITE, 22 November 2026.
  yayasantm.org.my no longer resolves, and tm.com.my/yayasantm/* 301-redirects
  here. (tm.com.my itself answers robots.txt with HTTP 403, so the fetcher
  refuses it; ytm.tm.com.my is a separate host whose robots.txt is the Drupal
  default and does not disallow these pages.) Content is served as complete
  HTML: the FAQ accordion holds every answer in the response body, and "Load
  More" only reveals already-loaded items. No CAPTCHA, login wall or anti-bot
  challenge is encountered or circumvented.

WHICH PROGRAMMES
    /scholarships-future-leader  Future Leaders Scholarship — post-SPM, Pre-U
                                 through first degree, local and overseas.
                                                                EXTRACTED
    /scholarships-young-leader   Young Leaders Scholarship — Form 4 students in
                                 government schools, RM1,500 a year. A school
                                 award, not post-SPM.            SKIPPED
  Not a target, and parse() returns [] if the page is ever reached through
  search, so generic extraction does not stage it either.

STRUCTURE
  Drupal paragraphs: `.paragraph--type--application` carries the
  "Closing Date : <date>" line and the Apply button (the ytmapps.tm.com.my
  portal, allowlisted narrowly in sanitise.py); `.faq-wrapper .accordion-item`
  pairs an `.accordion-button` question with an `.accordion-body` answer.
  Fields are read from the answers by what the question asks, not by position.

  The page states no citizenship or income condition. Aggregator sites quote
  income caps and SPM grade minimums that contradict each other; none is on
  the official page, so none is stored.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..parsers.keywords import match_fields
from ..sanitise import clean_text, clean_url, parse_date

BASE = "https://ytm.tm.com.my"

#: question pattern -> role. First match wins per question.
_QUESTIONS = (
    (re.compile(r"application\s+be\s+opened|when.*open", re.I), "opens"),
    (re.compile(r"scholarship\s+covers?", re.I), "covers"),
    (re.compile(r"apply\s+again\s+for\s+the\s+degree|pre-?u\s+scholarship", re.I), "renewal"),
    (re.compile(r"which\s+countries", re.I), "countries"),
    (re.compile(r"courses\s+offered", re.I), "courses"),
    (re.compile(r"minimum\s+academic\s+achievement", re.I), "cgpa"),
    (re.compile(r"considered\s+for\s+local", re.I), "local"),
    (re.compile(r"compulsory\s+bond|mandatory\s+bond", re.I), "bond"),
    (re.compile(r"other\s+sponsor", re.I), "single"),
    (re.compile(r"already\s+started\s+my\s+degree", re.I), "undergrad"),
)
_CLOSING = re.compile(r"closing\s+date\s*:?\s*(.{6,40})", re.I)
_SCHOOL_AWARD = re.compile(r"\bForm\s+4\b", re.I)


class YtmParser(BaseParser):
    source_id = "ytm"
    provider = "Yayasan Telekom Malaysia (YTM)"
    index_url = f"{BASE}/scholarships-future-leader"
    #: Prefix covers every /scholarships-* page so a search hit on Young Leaders is
    #: still routed here — and deliberately excluded — instead of being
    #: generically extracted.
    path_prefix = f"{BASE}/scholarships-"
    max_targets = 1

    def discover(self, html: str) -> list[str]:
        return self.guard([self.index_url])

    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        soup = BeautifulSoup(html, "html.parser")
        faq = self._faq(soup)
        if not faq:
            raise ValueError("no FAQ accordion — page structure changed")
        wrapper = soup.select_one(".faq-wrapper")
        if _SCHOOL_AWARD.search(wrapper.get_text(" ", strip=True) if wrapper else ""):
            return []  # Young Leaders: Form 4 school award, not post-SPM
        if "covers" not in faq or "courses" not in faq:
            raise ValueError("FAQ lacks coverage/courses answers — not a programme page")

        application = soup.select_one(".paragraph--type--application")
        app_text = application.get_text(" ", strip=True) if application else ""
        closing = _CLOSING.search(app_text)

        record = ScrapedScholarship(
            name="Yayasan TM Future Leaders Scholarship",
            provider=self.provider,
            source_url=url,
            description=self._description(faq),
            funding_amount=clean_text(faq["covers"], "funding_amount")[0],
            # "Applications ... open after the announcement of the SPM
            # examination results": an SPM-leaver award.
            education_levels=["spm"] if re.search(r"\bSPM\b", faq.get("opens", "")) else [],
            field_of_study=match_fields(faq["courses"]),
            deadline=parse_date(closing.group(1)) if closing else None,
            application_link=self._apply_link(application),
        )
        record.criteria = self._criteria(faq)
        return [record]

    # -- helpers ---------------------------------------------------------
    def _faq(self, soup) -> dict[str, str]:
        out: dict[str, str] = {}
        for item in soup.select(".faq-wrapper .accordion-item"):
            q = item.select_one(".accordion-button")
            a = item.select_one(".accordion-body")
            if q is None or a is None:
                continue
            question = q.get_text(" ", strip=True)
            answer = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
            for pattern, role in _QUESTIONS:
                if pattern.search(question):
                    out.setdefault(role, answer)
                    break
        return out

    def _description(self, faq: dict[str, str]) -> str | None:
        parts = [
            "Full scholarship from pre-university to first degree, locally or overseas.",
            faq.get("renewal", ""),
            f"Fields: {faq['courses']}" if faq.get("courses") else "",
            f"Overseas destinations: {faq['countries']}" if faq.get("countries") else "",
            faq.get("opens", ""),
        ]
        value, _ = clean_text(" ".join(p for p in parts if p), "description")
        return value

    def _apply_link(self, application) -> str | None:
        if application is None:
            return None
        for anchor in application.find_all("a", href=True):
            if re.search(r"\bapply\b", anchor.get_text(" ", strip=True), re.I):
                return clean_url(anchor["href"], require_allowlist=True)
        return None

    def _criteria(self, faq: dict[str, str]) -> list[ScrapedCriterion]:
        """Non-checkable rows in the provider's wording; see JpaParser._criteria
        for why none is machine-checked."""
        rows = (
            ("cgpa", "Degree stage: {}"),
            ("bond", "Service bond: {}"),
            ("single", "{}"),
            ("local", "Local study: {}"),
        )
        out: list[ScrapedCriterion] = []
        for role, template in rows:
            answer = faq.get(role)
            if not answer:
                continue
            label, _ = clean_text(template.format(answer), "label")
            if label and label not in [c.label for c in out]:
                out.append(
                    ScrapedCriterion("other", "contains", "provider-condition", label, is_checkable=False)
                )
        return out
