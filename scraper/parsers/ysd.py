"""
Parser for yayasansimedarby.com/scholarship-information — the Yayasan Sime Darby
scholarships and bursaries open to the public.

VERIFIED AGAINST THE LIVE SITE, 9 September 2026.
  robots.txt (Drupal default): disallows /core/, /profiles/ and a few README
  files; the content path carries no Disallow. The page is served as complete
  HTML — every programme's eligibility, fields and value are in the response
  body. No CAPTCHA, login wall or anti-bot challenge is encountered or
  circumvented.

WHICH PROGRAMMES
  The page lists eight accordions. Five are public awards for post-SPM students
  and are extracted:
    * YSD Undergraduate Excellence Scholarship
    * YSD Special Needs Bursary
    * the three TVET bursaries (Plantation, Heavy Equipment, Construction)
  Three are staff benefits (Employees Education Programme and variants) and are
  deliberately skipped — the same reasoning that drops JPA's serving-officer
  programmes and PETRONAS's employee schemes.

STRUCTURE
  `div.accordion` wraps `button.accordion-header` (the category) and
  `div.accordion-content` (the detail). Two content formats appear:
    * heading-based — the two flagship awards use <h2> for the name and <h3>
      for "About" / "Eligibility Requirements" / "Accepted Fields of Study" / …
    * label-based — the TVET bursaries put the same section labels inline as
      plain text lines
  Both are handled by `_sections`.

  [D-47] Several programmes state "Application closed." with no date. As with
  PETRONAS, that sets status='expired' — a student cannot apply now — and the
  weekly re-scrape restores 'active' when YSD reopens.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..parsers.keywords import match_fields, match_levels
from ..sanitise import clean_text, parse_date

BASE = "https://www.yayasansimedarby.com"

_SECTION_LABELS = (
    "About",
    "Eligibility Requirements",
    "Accepted Fields of Study",
    "Accepted Universities",
    "Value of Scholarship",
    "Service Bond Period",
    "Application",
)
_CLOSED = re.compile(r"application[s]?\s+(?:is\s+|are\s+|now\s+)?closed", re.I)
# A real "you can apply now" signal — NOT the persistent "Apply Now" button
# label, which is on the page whether or not the window is open.
_OPEN = re.compile(
    r"applications?\s+(?:is\s+|are\s+|now\s+)?open|open\s+for\s+(?:application|submission)"
    r"|opens?\s+on\b|intake\s+is\s+open",
    re.I,
)


class YsdParser(BaseParser):
    source_id = "ysd"
    provider = "Yayasan Sime Darby"
    index_url = f"{BASE}/scholarship-information"
    path_prefix = f"{BASE}/scholarship-information"
    max_targets = 1
    publishes_application_links = False

    def discover(self, html: str) -> list[str]:
        return self.guard([self.index_url])

    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        soup = BeautifulSoup(html, "html.parser")
        accordions = soup.select("div.accordion")
        if not accordions:
            raise ValueError("no accordions — page structure changed")

        out: list[ScrapedScholarship] = []
        for acc in accordions:
            btn = acc.select_one("button.accordion-header, .accordion-header")
            content = acc.select_one("div.accordion-content")
            if btn is None or content is None:
                continue
            category = btn.get_text(" ", strip=True)
            if "employee" in category.lower():
                continue  # staff benefit, not a public scholarship
            record = self._one(category, content, url)
            if record is not None:
                out.append(record)

        if not out:
            raise ValueError("accordions present but no public programme extracted")
        return out

    # -- helpers ---------------------------------------------------------
    def _one(self, category: str, content, url: str) -> ScrapedScholarship | None:
        sections = self._sections(content)

        heading = content.find(["h2", "h3"])
        name = heading.get_text(" ", strip=True) if heading else ""
        if not name or name in _SECTION_LABELS:
            name = f"Yayasan Sime Darby {category} Scholarship"
        name_value, _ = clean_text(name, "name")
        if not name_value:
            return None

        about = sections.get("About", "")
        elig = sections.get("Eligibility Requirements", "")
        fields_text = sections.get("Accepted Fields of Study", "")
        value = sections.get("Value of Scholarship", "")
        application = sections.get("Application", "")

        description = self._description(about, content)

        record = ScrapedScholarship(
            name=name_value,
            provider=self.provider,
            source_url=url,
            description=description,
            funding_amount=self._value_line(value),
            education_levels=self._levels(elig),
            field_of_study=match_fields(fields_text),
            deadline=parse_date(application) if application else None,
        )
        # D-47: an explicit "Application closed" with no counter-signal that it
        # is open means a student cannot apply now.
        if (
            record.deadline is None
            and _CLOSED.search(application)
            and not _OPEN.search(application)
        ):
            record.status = "expired"
        record.criteria = self._criteria(elig)
        return record

    def _sections(self, content) -> dict[str, str]:
        """Return {label: body}. Handles both the heading format and the
        inline-label format."""
        headings = content.find_all(["h2", "h3", "h4"])
        if len(headings) >= 3:
            out: dict[str, str] = {}
            for h in headings:
                label = h.get_text(" ", strip=True)
                if label not in _SECTION_LABELS:
                    continue
                parts = []
                for sib in h.find_next_siblings():
                    if sib.name in ("h2", "h3", "h4"):
                        break
                    parts.append(sib.get_text(" ", strip=True))
                out[label] = " ".join(p for p in parts if p).strip()
            if out:
                return out

        # label-based: split the plain text on the known labels
        text = content.get_text("\n")
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        out = {}
        current = None
        for line in lines:
            if line in _SECTION_LABELS:
                current = line
                out.setdefault(current, "")
                continue
            if current:
                out[current] = (out[current] + " " + line).strip()
        return out

    def _description(self, about: str, content) -> str | None:
        value, _ = clean_text(about, "description")
        if value and len(value) >= 60:
            return value
        # TVET programmes have no "About". Strip the section labels out of the
        # body, then take the longest full sentence — this lands on the "YSD
        # THRIVE …" paragraph rather than a run of list items and labels.
        body = content.get_text(" ", strip=True)
        for label in _SECTION_LABELS:
            body = body.replace(label, ". ")
        best = ""
        for chunk in re.split(r"(?<=\.)\s+", body):
            chunk = chunk.strip(" .")
            if "Contact" in chunk or len(chunk) < 60:
                continue
            # A real sentence has spaces and lowercase words, not a Title-Case list.
            if sum(c.islower() for c in chunk) < 20:
                continue
            if len(chunk) > len(best):
                best = chunk
        if best:
            value, _ = clean_text(best, "description")
            return value
        return value or None

    def _value_line(self, value: str) -> str | None:
        value, _ = clean_text(value, "funding_amount")
        if not value:
            return None
        return value[:300]

    def _levels(self, elig: str) -> list[str]:
        levels = match_levels(elig)
        # "credits in SPM for Diploma applicants" implies a diploma entry from
        # SPM; a bare "credits in SPM" (TVET) is a genuine SPM entry.
        if re.search(r"credits?\s+in\s+SPM(?!\s+for)", elig, re.I) and "spm" not in levels:
            levels = ["spm", *levels]
        return list(dict.fromkeys(levels))

    def _criteria(self, elig: str) -> list[ScrapedCriterion]:
        out: list[ScrapedCriterion] = []
        # The eligibility body is a run of short sentences ending in a period.
        for chunk in re.split(r"(?<=\.)\s+", elig):
            text, _ = clean_text(chunk, "label")
            if not text or not (6 <= len(text) <= 240):
                continue
            if text in [c.label for c in out]:
                continue
            out.append(
                ScrapedCriterion(
                    criterion_type="other",
                    operator="contains",
                    value="provider-condition",
                    label=text,
                    is_checkable=False,
                )
            )
            if len(out) >= 10:
                break
        return out
