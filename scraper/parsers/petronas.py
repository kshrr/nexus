"""
Parser for petronas.com/careers/students-graduates — the PETRONAS Education
Sponsorship for SPM leavers.

VERIFIED AGAINST THE LIVE SITE, 9 September 2026.
  robots.txt (Drupal default): disallows /core/, /profiles/, /admin/,
  /comment/reply/, /filter/tips, /node/add/, /search/, /user/register. The
  careers content path this parser reads carries no Disallow. The page is
  served as complete HTML to an ordinary GET — the scholarship text, the
  eligibility list and the application-period notice are all in the response
  body, not loaded by script. No CAPTCHA, login wall or anti-bot challenge is
  encountered or circumvented.

WHY ONLY ONE PROGRAMME
  The page presents four tabs — Education Sponsorship (SPM Leavers), Internship,
  GEES, and an empty one. Only the first is a scholarship for Nexus's audience
  (post-SPM students). Internship and GEES target people already in or past a
  degree, so they are deliberately NOT extracted — the same reasoning that
  excludes JPA's serving-officer programmes.

STRUCTURE
  Drupal paragraphs. The stable anchor is the tab wrapper
  `div.paragraph--type--page-tabs-item`; the target tab is the one whose text
  contains "Education Sponsorship (SPM Leavers)". Inside it:
    * `.JmasterInnerRow2Left`  — the <h2> name and the intro paragraph
    * `.JmasterInnerRow2Right` — "Eligibility Criteria", "Terms & Conditions"
      and "Application Period"
  A list of sponsored disciplines follows as <h2> headings in the same tab.

  [DECISION REQUIRED — D-47]  The page states an application window in prose
  ("The application for the sponsorship is now closed"), with no date. There is
  no `opens_at` column and nothing to put in `deadline`. When the text says the
  window is closed, this parser sets status='expired' — the same state a past
  deadline produces in validate.py, and for the same reason: a student cannot
  apply right now. The weekly re-scrape flips it back to 'active' when PETRONAS
  reopens and updates the page. Reported here rather than silently decided.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..parsers.keywords import match_fields
from ..sanitise import clean_text

BASE = "https://www.petronas.com"

_TARGET_TAB = re.compile(r"education\s+sponsorship\s*\(spm\s+leavers\)", re.I)
_CLOSED = re.compile(r"\b(now\s+closed|is\s+closed|currently\s+closed|closed|ditutup)\b", re.I)
#: An explicit "you can apply now" statement. "future openings" must NOT count
#: as this — hence the required verb/adjacency rather than the bare word "open".
_OPEN = re.compile(r"\b(now\s+open|is\s+open|are\s+open|open\s+for\s+(application|submission))\b", re.I)
#: A line that reads as an explanatory sentence rather than a requirement.
_PROSE = re.compile(r"^(This|These|We|Our|As part|It (helps|aims)|The assessment)\b", re.I)
#: The right-column sub-sections, in the order the page presents them.
_SECTION_HEADINGS = ("Eligibility Criteria", "Terms & Conditions", "Application Period")


class PetronasParser(BaseParser):
    source_id = "petronas"
    provider = "PETRONAS"
    index_url = f"{BASE}/careers/students-graduates"
    path_prefix = f"{BASE}/careers/students-graduates"
    max_targets = 2
    # The education-sponsorship portal ("Online Application System") opens only
    # during an application window and is not linked from this page. The apply
    # links that ARE present belong to the Internship and Graduate programmes,
    # which this parser does not extract. Declaring False here keeps validation
    # from flagging the record for a link it was never going to have.
    publishes_application_links = False

    # -- discovery --------------------------------------------------------
    def discover(self, html: str) -> list[str]:
        """One page, one target. The programme is a tab on the index page
        itself, not a separate URL — so discovery just returns that page,
        and `guard` confirms it is on the expected path."""
        return self.guard([self.index_url])

    # -- extraction ------------------------------------------------------
    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        soup = BeautifulSoup(html, "html.parser")

        tab = self._target_tab(soup)
        if tab is None:
            raise ValueError(
                "no 'Education Sponsorship (SPM Leavers)' tab — page structure changed"
            )

        left = tab.select_one(".JmasterInnerRow2Left")
        right = tab.select_one(".JmasterInnerRow2Right")
        if left is None or right is None:
            raise ValueError("expected two-column tab layout not found")

        name = self._heading_text(left)
        if not name:
            raise ValueError("no programme name in the tab heading")

        right_text, _ = clean_text(right.get_text("\n", strip=True), "description")
        right_text = right_text or ""

        record = ScrapedScholarship(
            name=name,
            provider=self.provider,
            source_url=url,
            description=self._description(left),
            funding_amount=None,  # the page states no figure; nothing is invented
            education_levels=["spm"],
            field_of_study=self._disciplines(tab),
            deadline=None,  # stated only in prose, with no date — see D-47
        )

        # D-47: an explicitly closed window means "cannot apply now".
        if self._window_closed(right_text):
            record.status = "expired"

        record.criteria = self._criteria(right_text)
        return [record]

    # -- helpers -------------------------------------------------------
    def _target_tab(self, soup: BeautifulSoup):
        for tab in soup.select("div.paragraph--type--page-tabs-item"):
            if _TARGET_TAB.search(tab.get_text(" ", strip=True)):
                return tab
        return None

    def _heading_text(self, node) -> str | None:
        for h in node.find_all(re.compile(r"^h[1-3]$")):
            text = h.get_text(" ", strip=True)
            if text:
                value, _ = clean_text(text, "name")
                return value
        return None

    def _description(self, left) -> str | None:
        """The intro paragraph — the first <p> in the left column with real
        prose, not the heading."""
        for p in left.find_all("p"):
            raw = p.get_text(" ", strip=True)
            if len(raw) >= 60:
                value, _ = clean_text(raw, "description")
                if value:
                    return value
        # Fall back to the left column minus its heading.
        text, _ = clean_text(left.get_text(" ", strip=True), "description")
        if not text:
            return None
        heading = self._heading_text(left) or ""
        return text.replace(heading, "", 1).strip() or None

    def _disciplines(self, tab) -> list[str]:
        """Sponsored disciplines are listed as <h2> headings after the
        Application Period section. Map them onto Nexus course fields; anything
        with no Nexus equivalent (Law, Marketing, Actuarial Science, …) is
        dropped rather than stored as a field that could never match."""
        headings = " ".join(
            h.get_text(" ", strip=True)
            for h in tab.find_all("h2")
            if not _TARGET_TAB.search(h.get_text(" ", strip=True))
        )
        return match_fields(headings)

    def _window_closed(self, right_text: str) -> bool:
        # Anchor on the heading as a whole line — "application period" also
        # appears mid-sentence in the eligibility Note, which must not match.
        match = re.search(
            r"^Application Period\s*\n(.{0,300})", right_text, re.M | re.S
        )
        segment = match.group(1) if match else ""
        if _OPEN.search(segment):
            return False
        return bool(_CLOSED.search(segment))

    def _criteria(self, right_text: str) -> list[ScrapedCriterion]:
        """Turn the eligibility block into scholarship_criteria rows.

        EVERY criterion is is_checkable=False — the same decision as the JPA
        parser. Nexus stores SPM results but not at the "8A" aggregate or CEFR
        band this page asks for, does not collect leadership history, and the
        assessments are a selection process, not a profile fact. Rendered as a
        grey dash with "check the provider's page", never a red cross. An
        administrator can promote any of them in the criteria editor.
        """
        criteria: list[ScrapedCriterion] = []

        block = right_text
        match = re.search(
            r"Eligibility Criteria\s*\n(.+?)(?:\nTerms & Conditions|\nApplication Period|\Z)",
            right_text,
            re.I | re.S,
        )
        if match:
            block = match.group(1)

        for raw in block.split("\n"):
            line = raw.strip(" .;")
            if len(line) < 12 or len(line) > 160:
                continue
            if line.lower().startswith("note:"):
                continue
            # Drop explanatory sentences: a requirement is a short phrase or a
            # "label: value" pair, not a paragraph about the selection ethos.
            if _PROSE.match(line) or (len(line) > 90 and ":" not in line and line.endswith(".")):
                continue
            value, _ = clean_text(line, "label")
            if not value:
                continue
            label = re.sub(r"^\d+\.\s*", "", value)
            if label and label not in [c.label for c in criteria]:
                criteria.append(
                    ScrapedCriterion(
                        criterion_type="other",
                        operator="contains",
                        value="provider-condition",
                        label=label,
                        is_checkable=False,
                    )
                )
            if len(criteria) >= 8:
                break
        return criteria
