"""
Parser for bnm.gov.my/careers/scholarships — Bank Negara Malaysia's Kijang
scholarships.

RE-INSPECTED 22 November 2026.
  On 9 September 2026 the site's WAF answered Python's HTTP client with HTTP
  403 (keyed on the TLS fingerprint) and the source was left unscraped rather
  than bypassed. It now serves the page with HTTP 200 to the project's
  ordinary Fetcher: same user agent, no TLS or header spoofing, nothing
  circumvented. robots.txt disallows only /view.php for generic crawlers.
  The page (Liferay) is served in Malay to the fetcher's Accept-Language and
  is complete HTML: each programme is a Bootstrap tab pane.

STRUCTURE
  `a.tab-link` names each programme ("Biasiswa Prauniversiti Kijang",
  "Biasiswa Sarjana Muda Kijang (Mohon Sekarang) 17 April - 26 April 2026");
  its pane `div.tab-pane#ks` / `#us` holds a `.card-body` with an intro
  paragraph, "Kriteria Kelayakan" and "Langkah Seterusnya" labels each
  followed by an <ol>. The application window, when shown, is in the tab name.

SOURCE DOCUMENTS
  The requirements point to BNM's approved-institution PDFs ("kolej
  prauniversiti", "universiti-universiti yang diluluskan"). These are linked
  as source_documents so students open the official list in a new tab; their
  contents are not copied into Nexus.

APPLICATION LINK
  "Mohon Sekarang" points at BNM's Oracle Cloud recruitment tenant on
  *.oraclecloud.com, a shared SaaS domain. Allowlisting it would admit any
  tenant on that domain, so no application link is stored and students are
  sent to BNM's own page (publishes_application_links = False).
"""

from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..parsers.keywords import match_fields, match_levels
from ..sanitise import clean_documents, clean_text, parse_date

BASE = "https://www.bnm.gov.my"
PAGE = f"{BASE}/careers/scholarships"

_WINDOW = re.compile(r"(\d{1,2}\s+\w+(?:\s+\d{4})?)\s*[-–]\s*(\d{1,2}\s+\w+\s+\d{4})")
_CITIZEN = re.compile(r"warganegara\s+Malaysia", re.I)
_AGE = re.compile(r"tidak\s+melebihi\s+(?:umur\s+)?(\d{2})\s+tahun", re.I)
_BOND = re.compile(r"berkhidmat|terikat", re.I)
_FUNDING = re.compile(r"yuran\s+pengajian|elaun", re.I)
_LABELS = ("kriteria kelayakan", "langkah seterusnya")


class BnmParser(BaseParser):
    source_id = "bnm"
    provider = "Bank Negara Malaysia (BNM)"
    index_url = PAGE
    path_prefix = PAGE
    max_targets = 1
    publishes_application_links = False

    def discover(self, html: str) -> list[str]:
        return self.guard([self.index_url])

    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        soup = BeautifulSoup(html, "html.parser")
        tabs = [(a.get_text(" ", strip=True), a.get("aria-controls") or a.get("data-target") or a.get("href"))
                for a in soup.select("a.tab-link")]
        panes = soup.select("div.tab-pane[id]")
        if not panes:
            raise ValueError("no scholarship tab panes — page structure changed")
        page_intro = self._page_intro(soup)

        out: list[ScrapedScholarship] = []
        for pane in panes:
            card = pane.select_one(".card-body") or pane
            title_el = card.select_one("p.h4") or card.find(["h2", "h3", "h4"])
            title = title_el.get_text(" ", strip=True) if title_el else ""
            if not title:
                continue
            record = self._record(title, card, url, page_intro)
            if record is not None:
                out.append(record)
        if not out:
            raise ValueError("tab panes present but no programme extracted")
        return out

    def _page_intro(self, soup) -> str:
        article = soup.select_one("div.journal-content-article") or soup
        for p in article.find_all("p"):
            text = p.get_text(" ", strip=True)
            if len(text) > 120 and "BNM" in text:
                return text
        return ""

    def _record(self, title: str, card, url: str, page_intro: str):
        window = _WINDOW.search(title)
        name = re.sub(r"\s*\(Mohon Sekarang\).*$|\s*\d{1,2}\s+\w+\s*[-–].*$", "", title).strip()
        name_value, _ = clean_text(name, "name")
        if not name_value:
            return None

        sections = self._sections(card)
        criteria_lines = sections.get("kriteria kelayakan", [])
        next_steps = sections.get("langkah seterusnya", [])
        intro = " ".join(sections.get("intro", []))

        funding = next((ln for ln in next_steps if _FUNDING.search(ln)), None)
        description = " ".join(p for p in (intro or page_intro, *[ln for ln in next_steps if not _FUNDING.search(ln) and not _BOND.search(ln)]) if p)
        # The shared page intro ends by announcing the tab list.
        description = re.sub(r"\s*BNM menawarkan [^:.]*:", "", description)

        record = ScrapedScholarship(
            name=name_value,
            provider=self.provider,
            source_url=url,
            description=clean_text(description, "description")[0],
            funding_amount=clean_text(funding, "funding_amount")[0] if funding else None,
            education_levels=self._levels(name_value, criteria_lines),
            field_of_study=match_fields(page_intro),
            deadline=parse_date(window.group(2)) if window else None,
        )
        record.criteria = self._criteria(criteria_lines, next_steps)
        record.source_documents = clean_documents(self._documents(card, url), url)
        return record

    def _sections(self, card) -> dict[str, list[str]]:
        """{'intro': [...], 'kriteria kelayakan': [...], 'langkah seterusnya': [...]}.
        Nested list items are kept as their own lines so a multi-route academic
        requirement reads one qualification per line."""
        out: dict[str, list[str]] = {}
        current = "intro"
        for el in card.find_all(["p", "ol", "ul"], recursive=False):
            text = el.get_text(" ", strip=True)
            if el.name == "p":
                if "h4" in (el.get("class") or []) or not text:
                    continue
                if text.lower() in _LABELS:
                    current = text.lower()
                    continue
                if text.lower().startswith(("nota", "mohon sekarang")):
                    continue
                out.setdefault(current, []).append(_tidy(text))
                continue
            for li in el.find_all("li", recursive=False):
                nested = li.find(["ul", "ol"])
                if nested is not None:
                    head = "".join(str(t) for t in li.find_all(string=True, recursive=False)).strip()
                    lead = li.find(["strong", "b"])
                    head = _tidy(f"{lead.get_text(' ', strip=True) if lead else ''} {head}")
                    if head:
                        out.setdefault(current, []).append(head)
                    for sub in nested.find_all("li"):
                        out.setdefault(current, []).append(_tidy(sub.get_text(" ", strip=True)))
                    tail = nested.find_next_sibling(string=True)
                    if tail and tail.strip():
                        out.setdefault(current, []).append(_tidy(tail))
                else:
                    out.setdefault(current, []).append(_tidy(li.get_text(" ", strip=True)))
        return out

    def _levels(self, name: str, lines: list[str]) -> list[str]:
        if re.search(r"prauniversiti", name, re.I):
            return ["spm"]  # awarded on the latest SPM results
        levels: list[str] = []
        for line in lines:
            if re.search(r"PNGK|CGPA", line) and re.search(r"STPM|Diploma|Matrikulasi|Asasi", line, re.I):
                levels.extend(lvl for lvl in match_levels(line) if lvl != "spm")
        return list(dict.fromkeys(levels))

    def _criteria(self, lines: list[str], next_steps: list[str]) -> list[ScrapedCriterion]:
        out: list[ScrapedCriterion] = []

        def add(kind, op, value, label):
            text, _ = clean_text(label, "label")
            if text and text not in [c.label for c in out] and len(out) < 14:
                out.append(ScrapedCriterion(kind, op, value, text, is_checkable=False))

        for line in lines:
            age = _AGE.search(line)
            if _CITIZEN.search(line):
                add("citizenship", "eq", "MY", "Malaysian citizen")
            if age:
                add("age", "lte", int(age.group(1)), line)
            elif not _CITIZEN.search(line):
                add("other", "contains", "provider-condition", line)
        for line in next_steps:
            if _BOND.search(line):
                add("other", "contains", "service-bond", line)
        return out

    def _documents(self, card, url: str) -> list[dict]:
        docs = []
        for anchor in card.find_all("a", href=True):
            if not anchor["href"].lower().split("?")[0].endswith(".pdf"):
                continue
            text = _tidy(anchor.get_text(" ", strip=True))
            label = text[:1].upper() + text[1:]
            if "diluluskan" not in label.lower():
                label += " yang diluluskan BNM"
            docs.append({"label": f"{label} (PDF)", "url": urljoin(url, anchor["href"])})
        return docs


def _tidy(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("‑", "-")).strip()
