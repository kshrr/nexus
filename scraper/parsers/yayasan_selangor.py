"""
Parser for yayasanselangor.org.my/pinjaman-pelajaran-2 — the Yayasan Selangor
education loan (Pinjaman Pelajaran Yayasan Selangor).

VERIFIED AGAINST THE LIVE SITE, 23 November 2026.
  WordPress (Avada/Fusion). robots.txt does not disallow the page; the page is
  complete HTML. This page was last updated 19 Nov 2026 and is the current
  offer; the older /maklumat-tawaran-pinjaman/ page (IPTS allowed, different
  income wording) is not a target. No CAPTCHA, login wall or anti-bot
  challenge is encountered or circumvented.

  Not extracted: /biasiswadermasiswa/ is the RKPYS school programme (Form 1
  onwards), not post-SPM funding.

STRUCTURE
  The conditions are one <p> in a `div.fusion-text`, numbered "1." … "11."
  and separated by <br>; the paragraph before the heading "Syarat Kelayakan
  Permohonan" is the introduction.

RECORD
  One record. Applicants must already be full-time diploma or bachelor's
  students at a local public university, UNISEL or UIS, so the entry levels are
  SPM (diploma study) and the degree feeders. No amount is published.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..sanitise import clean_text

BASE = "https://yayasanselangor.org.my"
PAGE = f"{BASE}/pinjaman-pelajaran-2/"

_ITEM_SPLIT = re.compile(r"(?:^|\s)(?=\d{1,2}\.\s)")
_CITIZEN = re.compile(r"warganegara", re.I)
_ORIGIN = re.compile(r"lahir\s+di\s+Negeri\s+Selangor|bermastautin", re.I)
_INCOME = re.compile(r"pendapatan", re.I)
_AGE = re.compile(r"tidak\s+melebihi\s+(\d{2})\s+tahun", re.I)
_ADMIN = re.compile(r"keputusan\s+adalah\s+muktamad|membuat\s+permohonan\s+pada\s+waktu", re.I)


class YayasanSelangorParser(BaseParser):
    source_id = "yayasan_selangor"
    provider = "Yayasan Selangor"
    index_url = PAGE
    path_prefix = PAGE
    max_targets = 1
    publishes_application_links = False

    def discover(self, html: str) -> list[str]:
        return self.guard([self.index_url])

    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        soup = BeautifulSoup(html, "html.parser")
        block = next((d for d in soup.select("div.fusion-text") if "Syarat Kelayakan" in d.get_text()), None)
        if block is None:
            raise ValueError("no 'Syarat Kelayakan' block — page structure changed")
        paragraphs = [re.sub(r"\s+", " ", p.get_text(" ", strip=True)) for p in block.find_all("p")]
        heading = next((i for i, p in enumerate(paragraphs) if p.lower().startswith("syarat kelayakan")), None)
        if heading is None or heading + 1 >= len(paragraphs):
            raise ValueError("conditions list missing")
        intro = " ".join(p for p in paragraphs[:heading] if not p.isupper())
        items = [i.strip() for i in _ITEM_SPLIT.split(paragraphs[heading + 1]) if i.strip()]

        record = ScrapedScholarship(
            name="Pinjaman Pelajaran Yayasan Selangor",
            provider=self.provider,
            source_url=url,
            description=clean_text(intro, "description")[0],
            education_levels=["spm", "stpm", "matriculation", "foundation", "diploma"],
        )
        record.criteria = self._criteria(items)
        return [record]

    def _criteria(self, items: list[str]) -> list[ScrapedCriterion]:
        out: list[ScrapedCriterion] = []

        def add(kind, op, value, label):
            text, _ = clean_text(label, "label")
            if text and text not in [c.label for c in out]:
                out.append(ScrapedCriterion(kind, op, value, text, is_checkable=False))

        for item in items:
            line = re.sub(r"^\d{1,2}\.\s*", "", item).strip()
            age = _AGE.search(line)
            if _ADMIN.search(line):
                continue
            if _CITIZEN.search(line) and len(line) < 60:
                add("citizenship", "eq", "MY", "Malaysian citizen")
                add("other", "contains", "parents-citizenship", "Both parents are Malaysian citizens")
            elif _ORIGIN.search(line):
                add("other", "contains", "selangorian", line)
            elif _INCOME.search(line):
                add("other", "contains", "household-income", line)
            elif age:
                add("age", "lte", int(age.group(1)), line)
            else:
                add("other", "contains", "provider-condition", line)
        return out[:14]
