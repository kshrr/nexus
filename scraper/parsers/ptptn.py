"""
Parser for ptptn.gov.my/pinjaman-pendidikan — the PTPTN education loan
(Perbadanan Tabung Pendidikan Tinggi Nasional).

VERIFIED AGAINST THE LIVE SITE, 23 November 2026.
  WordPress + Elementor. robots.txt does not disallow the page; the project's
  ordinary Fetcher gets HTTP 200 and the conditions and loan tables are in the
  response HTML (the toggles are CSS, not fetched by JavaScript). No CAPTCHA,
  login wall or anti-bot challenge is encountered or circumvented.

STRUCTURE
  `.elementor-toggle-item` pairs a `.elementor-tab-title` ("Syarat-Syarat
  Permohonan", "Jumlah Pinjaman", FAQ questions …) with `.elementor-tab-content`.
    * "Syarat-Syarat Permohonan" -> an <ol> of conditions
    * "Jumlah Pinjaman" -> three tables: the 100/75/50 % tiers, the full-time
      annual amounts (institution cell spans rows), part-time ceilings
  The introduction is the text block under the "Pengenalan" heading.

RECORD
  One record. It funds diploma, foundation (IPTS) and bachelor's study (as
  well as postgraduate study, which Nexus does not list), so the entry levels
  are SPM (pre-degree study) and the degree feeders. funding_amount states the
  annual full-time range for those levels from the table and the income-based
  percentage tiers; nothing is inferred.
"""

from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..sanitise import clean_text, clean_url

BASE = "https://www.ptptn.gov.my"
PAGE = f"{BASE}/pinjaman-pendidikan/"

_POSTGRAD = re.compile(r"Sarjana\s*\(Master\)|Doktor\s+Falsafah|PhD|Kursus\s+Profesional", re.I)
_NUMBER = re.compile(r"^[\d,]+$")
_CITIZEN = re.compile(r"warganegara\s+malaysia", re.I)
_AGE = re.compile(r"tidak\s+melebihi\s+(\d{2})\s+tahun", re.I)
_INCOME = re.compile(r"pendapatan", re.I)


class PtptnParser(BaseParser):
    source_id = "ptptn"
    provider = "Perbadanan Tabung Pendidikan Tinggi Nasional (PTPTN)"
    index_url = PAGE
    path_prefix = PAGE
    max_targets = 1

    def discover(self, html: str) -> list[str]:
        return self.guard([self.index_url])

    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        soup = BeautifulSoup(html, "html.parser")
        toggles = {
            item.select_one(".elementor-tab-title").get_text(" ", strip=True): item.select_one(".elementor-tab-content")
            for item in soup.select(".elementor-toggle-item")
            if item.select_one(".elementor-tab-title") and item.select_one(".elementor-tab-content")
        }
        conditions = toggles.get("Syarat-Syarat Permohonan")
        amounts = toggles.get("Jumlah Pinjaman")
        if conditions is None or amounts is None:
            raise ValueError("PTPTN conditions/amount toggles missing — page structure changed")

        record = ScrapedScholarship(
            name="Pinjaman Pendidikan PTPTN",
            provider=self.provider,
            source_url=url,
            description=self._introduction(soup),
            funding_amount=self._funding(amounts),
            # Diploma / foundation study is entered from SPM; bachelor's study
            # from STPM, matriculation, foundation or a diploma.
            education_levels=["spm", "stpm", "matriculation", "foundation", "diploma"],
            application_link=self._apply_link(soup, url),
        )
        record.criteria = self._criteria(conditions)
        return [record]

    def _introduction(self, soup) -> str | None:
        heading = soup.find(lambda t: t.name in ("h1", "h2", "h3") and t.get_text(strip=True) == "Pengenalan")
        block = heading.find_next("p") if heading else None
        return clean_text(block.get_text(" ", strip=True), "description")[0] if block else None

    def _funding(self, amounts) -> str | None:
        """Annual full-time range for diploma/foundation/bachelor's rows, plus
        the income-based percentage tiers, all read from the tables."""
        tables = amounts.find_all("table")
        values: list[int] = []
        for table in tables:
            for tr in table.find_all("tr"):
                cells = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
                numbers = [c for c in cells if _NUMBER.match(c)]
                if len(numbers) != 3:  # the full-time table: max / 75 % / 50 %
                    continue
                level = cells[len(cells) - 4]
                if _POSTGRAD.search(level):
                    continue
                values.append(int(numbers[0].replace(",", "")))
        if not values:
            return None
        tiers = " 75% atau 50% daripada maksimum bergantung pada status STR dan pendapatan keluarga."
        text = f"Pinjaman sepenuh masa RM{min(values):,}–RM{max(values):,} setahun mengikut institusi dan peringkat pengajian (maksimum).{tiers}"
        return clean_text(text, "funding_amount")[0]

    def _apply_link(self, soup, url) -> str | None:
        for anchor in soup.find_all("a", href=True):
            if "ionline" in anchor["href"]:
                return clean_url(urljoin(url, anchor["href"]), require_allowlist=True)
        return None

    def _criteria(self, conditions) -> list[ScrapedCriterion]:
        out: list[ScrapedCriterion] = []
        for li in conditions.find_all("li"):
            line = re.sub(r"\s+", " ", li.get_text(" ", strip=True))
            line = re.sub(r"\s*;?\s*(?:dan)?\s*$", "", line).strip()  # list joiners "…; dan"
            label, _ = clean_text(line, "label")
            if not label:
                continue
            age = _AGE.search(line)
            if _CITIZEN.search(line) and len(line) < 40:
                out.append(ScrapedCriterion("citizenship", "eq", "MY", "Malaysian citizen", is_checkable=False))
            elif age:
                out.append(ScrapedCriterion("age", "lte", int(age.group(1)), label, is_checkable=False))
            elif _INCOME.search(line):
                out.append(ScrapedCriterion("other", "contains", "household-income", label, is_checkable=False))
            else:
                out.append(ScrapedCriterion("other", "contains", "provider-condition", label, is_checkable=False))
        return out[:14]
