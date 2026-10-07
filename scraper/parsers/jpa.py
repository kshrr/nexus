"""
Parser for penajaan.jpa.gov.my — the Public Service Department's sponsorship
portal (Jabatan Perkhidmatan Awam).

VERIFIED AGAINST THE LIVE SITE, 9 September 2026.
  robots.txt: Joomla default. Disallows /administrator/, /api/, /cache/,
  /components/, /libraries/, /modules/, /plugins/, /tmp/ and similar
  infrastructure paths. The content tree this parser reads —
  /info-penajaan/latihan-sebelum-perkhidmatan/program-pelajar/ — carries no
  Disallow. No CAPTCHA, no login wall, no anti-bot challenge is encountered or
  circumvented; the pages are served as plain HTML to an ordinary GET.

WHY THIS SOURCE
  It is the only one of the three candidates whose STUDENT programmes sit in a
  single, stable, enumerable index. JPA also sponsors civil servants
  ("Latihan Dalam Perkhidmatan"), and those pages are deliberately NOT scraped:
  Nexus serves post-SPM students, so a serving officer's training award would
  be noise in a student's list.

STRUCTURE
  Joomla with the YOOtheme builder. Two anchors make extraction stable without
  depending on element ordering:

    * `ul.uk-breadcrumb` — its last item is the programme name, and the
      `.uk-container` enclosing it also encloses the article body
    * `.uk-accordion-title` — semantic section labels ("Syarat Umum",
      "Syarat Khusus", "Bidang Pengajian") paired with their content

  Both survive re-ordering of the page, which a positional selector would not.
"""

from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..parsers.keywords import match_fields, match_levels
from ..sanitise import clean_text, clean_url, parse_date

BASE = "https://penajaan.jpa.gov.my"

_CITIZEN = re.compile(r"warganegara\s+malaysia", re.I)
_AGE = re.compile(r"umur\s+belum\s+mencapai\s+(\d{2})\s*tahun", re.I)
_INCOME = re.compile(r"\bB40\b|\bM40\b|pendapatan\s+(isi\s+rumah|keluarga)", re.I)


class JpaParser(BaseParser):
    source_id = "jpa"
    provider = "Jabatan Perkhidmatan Awam (JPA)"
    index_url = f"{BASE}/program-pelajar.html"
    path_prefix = f"{BASE}/info-penajaan/latihan-sebelum-perkhidmatan/program-pelajar/"
    max_targets = 15
    # Verified 9 Sep 2026: the programme pages carry no apply URL. The only
    # in-article external link is a FAQ about the funding instrument; the
    # application portals (esilav2, MySELF) appear in site chrome and are not
    # tied to a programme or an intake.
    publishes_application_links = False

    # -- discovery ----------------------------------------------------------
    def discover(self, html: str) -> list[str]:
        """Collect student-programme links from the index page only.

        The prefix filter in `guard` is what confines this to the student tree;
        civil-servant programmes live under .../latihan-dalam-perkhidmatan/ and
        are excluded by construction rather than by a blocklist.
        """
        soup = BeautifulSoup(html, "html.parser")
        urls = [
            urljoin(BASE, a["href"])
            for a in soup.find_all("a", href=True)
            if "program-pelajar/" in a["href"]
        ]
        return self.guard(urls)

    # -- extraction ---------------------------------------------------------
    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        soup = BeautifulSoup(html, "html.parser")

        name = self._name(soup)
        if not name:
            raise ValueError("no programme name in breadcrumb — not a programme page")

        sections = self._sections(soup)
        body = self._body_text(soup)
        description = self._description(soup)

        record = ScrapedScholarship(
            name=name,
            provider=self.provider,
            source_url=url,
            description=description,
            funding_amount=self._funding(body),
            education_levels=self._levels(f"{description or ''} {sections.get('Syarat Umum', '')}"),
            field_of_study=self._fields(
                " ".join([sections.get("Bidang Pengajian", ""), description or ""])
            ),
            deadline=parse_date(body) if "tarikh tutup" in body.lower() else None,
            application_link=self._apply_link(soup),
        )
        record.criteria = self._criteria(sections)
        return [record]

    # -- helpers ------------------------------------------------------------
    def _name(self, soup: BeautifulSoup) -> str | None:
        crumb = soup.select_one("ul.uk-breadcrumb")
        if not crumb:
            return None
        items = [li.get_text(" ", strip=True) for li in crumb.find_all("li")]
        items = [i for i in items if i]
        if not items:
            return None
        value, _ = clean_text(items[-1], "name")
        return value

    def _content_container(self, soup: BeautifulSoup):
        """The `.uk-container` that holds both the breadcrumb and the article.

        Anchoring on the breadcrumb rather than an index or a theme class means
        the header, sidebar and footer panels — which repeat on every page and
        would otherwise dominate the text — are excluded structurally.
        """
        crumb = soup.select_one("ul.uk-breadcrumb")
        node = crumb
        while node is not None:
            classes = node.get("class") or []
            if "uk-container" in classes:
                return node
            node = node.parent
        return None

    def _body_text(self, soup: BeautifulSoup) -> str:
        container = self._content_container(soup)
        if container is None:
            return ""
        text, _ = clean_text(container.get_text("\n", strip=True), "description")
        return text or ""

    def _description(self, soup: BeautifulSoup) -> str | None:
        """The introductory paragraph: the first substantial panel inside the
        content container that is not itself an accordion section."""
        container = self._content_container(soup)
        if container is None:
            return None
        for panel in container.select("div.uk-panel"):
            if panel.find_parent(class_="uk-accordion-content"):
                continue
            raw = panel.get_text(" ", strip=True)
            if len(raw) < 120:
                continue
            value, _ = clean_text(raw, "description")
            if value:
                return value
        return None

    def _sections(self, soup: BeautifulSoup) -> dict[str, str]:
        """Map accordion title -> cleaned section text."""
        out: dict[str, str] = {}
        for title_el in soup.select(".uk-accordion-title"):
            title = title_el.get_text(" ", strip=True)
            content = title_el.find_next(class_="uk-accordion-content")
            if not title or content is None:
                continue
            value, _ = clean_text(content.get_text("\n", strip=True), "description")
            if value:
                out[title] = value
        return out

    def _funding(self, body: str) -> str | None:
        """JPA states the award type as 'Bentuk penajaan : …'."""
        match = re.search(r"Bentuk\s+penajaan\s*:?\s*\n?(.{3,200})", body, re.I)
        if not match:
            return None
        value, _ = clean_text(match.group(1).split("\n")[0], "funding_amount")
        return value

    def _levels(self, text: str) -> list[str]:
        return match_levels(text)

    def _fields(self, text: str) -> list[str]:
        return match_fields(text)

    def _apply_link(self, soup: BeautifulSoup) -> str | None:
        """An application link, restricted to allowlisted hosts.

        A link harvested from a page and shown inside a trusted UI is a
        phishing vector, so an off-allowlist destination is dropped rather than
        stored — validation then flags the record for a human.
        """
        container = self._content_container(soup) or soup
        for anchor in container.find_all("a", href=True):
            href = anchor["href"]
            label = anchor.get_text(" ", strip=True).lower()
            if not re.search(r"mohon|permohonan|apply|esila|daftar", f"{href} {label}", re.I):
                continue
            cleaned = clean_url(urljoin(BASE, href), require_allowlist=True)
            if cleaned:
                return cleaned
        return None

    def _criteria(self, sections: dict[str, str]) -> list[ScrapedCriterion]:
        """Turn the conditions blocks into scholarship_criteria rows.

        EVERY criterion is written with is_checkable=False, and that is a
        deliberate decision rather than laziness:

          * citizenship and age have no collection point at all — ui-spec §9.1
            states Nexus does not collect nationality, IC number or date of
            birth, so neither can ever be verified from a stored profile
          * household income is not collected either, by D-24 / Conflict C-11b
          * the remaining provider wording is prose, not a machine-checkable
            predicate, and guessing a threshold from it would put a red cross
            against a student who actually qualifies

        A non-checkable criterion renders as a grey dash with "check the
        provider's page" (§10.6), never as a failure. An administrator can
        promote any of them to a checkable type in the criteria editor, where a
        human has judged the mapping.
        """
        criteria: list[ScrapedCriterion] = []
        general = sections.get("Syarat Umum", "")
        specific = sections.get("Syarat Khusus", "")
        combined = f"{general}\n{specific}"

        if _CITIZEN.search(combined):
            criteria.append(
                ScrapedCriterion(
                    criterion_type="citizenship",
                    operator="eq",
                    value="MY",
                    label="Malaysian citizen",
                    is_checkable=False,
                )
            )

        age = _AGE.search(combined)
        if age:
            criteria.append(
                ScrapedCriterion(
                    criterion_type="age",
                    operator="lte",
                    value=int(age.group(1)),
                    label=f"Under {age.group(1)} years old at the qualifying date",
                    is_checkable=False,
                )
            )

        if _INCOME.search(combined):
            # Recorded as `other`: the criterion taxonomy in migration 0003 has
            # no income type, and Nexus deliberately collects no student income.
            criteria.append(
                ScrapedCriterion(
                    criterion_type="other",
                    operator="contains",
                    value="household-income",
                    label="Household income category is considered (B40 / M40 prioritised)",
                    is_checkable=False,
                )
            )

        for heading, block in (("General condition", general), ("Academic condition", specific)):
            for line in self._condition_lines(block):
                criteria.append(
                    ScrapedCriterion(
                        criterion_type="other",
                        operator="contains",
                        value="provider-condition",
                        label=f"{heading}: {line}",
                        is_checkable=False,
                    )
                )
        return criteria

    def _condition_lines(self, block: str, limit: int = 6) -> list[str]:
        """Split a conditions block into individual, readable requirements."""
        if not block:
            return []
        lines = [ln.strip(" ;.") for ln in block.split("\n")]
        out: list[str] = []
        for line in lines:
            if len(line) < 25 or len(line) > 220:
                continue
            # Already captured as a typed criterion above.
            if _CITIZEN.search(line) or _AGE.search(line):
                continue
            value, _ = clean_text(line, "label")
            if value and value not in out:
                out.append(value)
            if len(out) >= limit:
                break
        return out
