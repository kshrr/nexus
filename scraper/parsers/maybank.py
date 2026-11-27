"""
Parser for the Maybank Group Scholarship Programme page on
maybankfoundation.com.

VERIFIED AGAINST THE LIVE SITE, 23 November 2026.
  WordPress + Elementor. robots.txt does not disallow the page; requirements,
  benefits, closing date and FAQ are in the response HTML (the route tabs are
  CSS). No CAPTCHA, login wall or anti-bot challenge is encountered or
  circumvented.

STRUCTURE
  * the hero carries "Closing date: <date>"
  * "Requirements": Elementor nested tabs — `button.e-n-tab-title` ("For local
    studies in Malaysia", "For studies in the United Kingdom (UK)") with
    aria-controls naming the `#e-n-tab-content-…` panel holding a <ul>
  * "What does the … offer?": a "Funding" list
  * "Discipline of Study": the accepted fields
  The FAQ repeats an older copy of the requirements; the tabs are used.

RECORD
  One record with route-prefixed conditions. The UK route names the entry
  qualifications (STPM, Foundation, Matriculation, Diploma …), which set the
  education levels; the local route is for first-year undergraduates at listed
  public universities. "Apply Now" opens a Google Form (docs.google.com, a
  shared SaaS domain), so no application link is stored.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..parsers.keywords import match_fields, match_levels
from ..sanitise import clean_text, parse_date

BASE = "https://maybankfoundation.com"
PAGE = f"{BASE}/what-we-do/our-pillars/education/maybank-groups-scholarship-programme/"

_INCOME = re.compile(r"household\s+income", re.I)
_AGE = re.compile(r"not\s+more\s+than\s+(\d{2})\s+years", re.I)
_BOND = re.compile(r"(\d)-year\s+bond", re.I)


class MaybankParser(BaseParser):
    source_id = "maybank"
    provider = "Maybank Foundation"
    index_url = PAGE
    path_prefix = f"{BASE}/what-we-do/our-pillars/education/maybank-groups-scholarship-programme"
    max_targets = 1
    publishes_application_links = False

    def discover(self, html: str) -> list[str]:
        return self.guard([self.index_url])

    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        routes = self._routes(soup)
        if not routes:
            raise ValueError("no requirement tabs — page structure changed")
        text = "\n".join(ln.strip() for ln in soup.get_text("\n").splitlines() if ln.strip())

        closing = re.search(r"Closing\s+date\s*:\s*([^\n|]+)", text, re.I)
        record = ScrapedScholarship(
            name="Maybank Group Scholarship Programme",
            provider=self.provider,
            source_url=url,
            description=self._description(text),
            funding_amount=self._funding(soup),
            education_levels=self._levels(routes),
            field_of_study=match_fields(self._section(text, "Discipline of Study", "What does the")),
            deadline=parse_date(closing.group(1)) if closing else None,
        )
        record.criteria = self._criteria(routes, text)
        return [record]

    def _routes(self, soup) -> list[tuple[str, list[str]]]:
        out = []
        for button in soup.select("button.e-n-tab-title"):
            panel = soup.find(id=button.get("aria-controls") or "")
            if panel is None:
                continue
            items = []
            for li in panel.find_all("li"):
                # A university list is written inside one item as "– Name (ABBR)"
                # lines; fold it into "<lead>: ABBR, ABBR, …".
                lines = [re.sub(r"\s+", " ", ln).strip() for ln in li.get_text("\n").split("\n")]
                lines = [ln for ln in lines if ln]
                if not lines:
                    continue
                head, rest = lines[0], [ln for ln in lines[1:] if ln.startswith(("–", "-"))]
                if rest:
                    names = [m.group(1) if (m := re.search(r"\(([A-Za-z]+)\)\s*$", n)) else n.lstrip("–- ") for n in rest]
                    items.append(f"{head.rstrip(':')}: {', '.join(names)}")
                else:
                    items.append(" ".join(lines))
            out.append((button.get_text(" ", strip=True), items))
        return out

    @staticmethod
    def _section(text: str, start: str, end: str) -> str:
        i = text.find(start)
        if i < 0:
            return ""
        j = text.find(end, i + len(start))
        return text[i + len(start): j if j > 0 else i + 2000]

    def _description(self, text: str) -> str | None:
        parts = []
        for pattern in (r"The Maybank Group Scholarship programme offers[^\n]+",
                        r"Full scholarships are awarded to selected students[^\n]+"):
            m = re.search(pattern, text)
            if m:
                parts.append(m.group(0).strip())
        return clean_text(" ".join(parts), "description")[0] if parts else None

    def _funding(self, soup) -> str | None:
        heading = soup.find(string=re.compile(r"^\s*Funding\s*$"))
        lst = heading.find_next("ul") if heading else None
        if lst is None:
            return None
        items = [li.get_text(" ", strip=True) for li in lst.find_all("li")]
        return clean_text("; ".join(i for i in items if i), "funding_amount")[0]

    def _levels(self, routes) -> list[str]:
        levels: list[str] = []
        for _, items in routes:
            for item in items:
                if re.search(r"STPM|Foundation|Matriculation|Diploma", item):
                    levels += [lvl for lvl in match_levels(item) if lvl != "spm"]
        return list(dict.fromkeys(levels))

    def _criteria(self, routes, text: str) -> list[ScrapedCriterion]:
        out: list[ScrapedCriterion] = []

        def add(kind, op, value, label):
            clean, _ = clean_text(label, "label")
            if clean and clean not in [c.label for c in out] and len(out) < 14:
                out.append(ScrapedCriterion(kind, op, value, clean, is_checkable=False))

        ages = {int(m.group(1)) for _, items in routes for i in items if (m := _AGE.search(i))}
        shared_age = next(iter(ages)) if len(ages) == 1 else None
        if shared_age is not None:
            add("age", "lte", shared_age, f"Not more than {shared_age} years of age")
        for title, items in routes:
            route = "Malaysia" if "Malaysia" in title else "United Kingdom" if "Kingdom" in title else title
            for item in items:
                if _AGE.search(item) and shared_age is None:
                    add("other", "contains", "age-limit", f"{route}: {item}")
                    continue
                if _AGE.search(item):
                    continue  # stated once above
                kind, value = ("other", "household-income") if _INCOME.search(item) else ("other", "provider-condition")
                add(kind, "contains", value, f"{route}: {item}")
        bonds = sorted({m.group(1) for m in _BOND.finditer(text)})
        if bonds:
            add("other", "contains", "service-bond",
                f"Scholars are bonded ({' or '.join(b + '-year' for b in bonds)} bond) and offered a job placement at Maybank")
        return out
