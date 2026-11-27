"""
Parser for ytn.tnb.com.my — Yayasan Tenaga Nasional (YTN): the TNB PRIME
Scholarship and the TNB SHINE Sponsorship (pinjaman boleh ubah).

VERIFIED AGAINST THE LIVE SITE, 22 November 2026.
  ytn.org.my no longer resolves; ytn.tnb.com.my is WordPress (Divi). robots.txt
  disallows only /wp-admin/ and sets Crawl-delay: 10, which fetch.Fetcher
  honours. All requirement blocks are in the response HTML; the page's
  dropdown form only toggles which block is visible. No CAPTCHA, login wall or
  anti-bot challenge is encountered or circumvented.

STRUCTURE
  Both programme pages (/biasiswa-prime-scholarship/ and
  /pinjaman-boleh-ubah-shine-sponsorship/) carry the SAME set of requirement
  sections, each an `.et_pb_section` whose id encodes the route:

      {prime|shine}-{foundation|preintake|diploma|degree}-{oversea|uniten|publicuni}-{entry}

  where entry is spm / stpm / diploma / foundation / current. Inside a section,
  `h3` names the destination, each numbered condition is a two-column nested
  row ("01" | text), and `h4` "Field of study" is followed by the discipline
  list. Fetching one page is therefore enough; each record's source_url is its
  own programme page so the two pages never stage duplicates.

RECORDS
  One record per programme and study stage, merging its destinations and entry
  routes (education_levels = the entry qualifications):
      TNB PRIME Scholarship (Foundation)   spm
      TNB PRIME Scholarship (Degree)       stpm, diploma, matriculation, foundation
      TNB SHINE Sponsorship (Foundation)   spm
      TNB SHINE Sponsorship (Diploma)      spm
      TNB SHINE Sponsorship (Degree)       stpm, diploma, matriculation, foundation

  SKIPPED:
    * `-current` routes — top-ups for students already enrolled, not an entry
      decision a post-SPM student makes
    * any section whose newest stated year is more than a year old. On
      22 Nov 2026 that is the Sabah/Sarawak pre-intake ("SPM trial 2019",
      "18 years old on 1 January 2020"): left on the page, but showing it would
      present a closed 2020 round as current

  No amount or closing date is published. SHINE is a convertible loan with
  partial or full sponsorship (the page title and conditions say so); PRIME's
  amount is not stated, so its funding_amount is left empty.
"""

from __future__ import annotations

import re
from datetime import date

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..parsers.keywords import match_fields, match_levels
from ..sanitise import clean_text, clean_url

BASE = "https://ytn.tnb.com.my"
PAGES = {
    "prime": f"{BASE}/biasiswa-prime-scholarship/",
    "shine": f"{BASE}/pinjaman-boleh-ubah-shine-sponsorship/",
}
NAMES = {"prime": "TNB PRIME Scholarship", "shine": "TNB SHINE Sponsorship"}
STAGES = {"foundation": "Foundation", "diploma": "Diploma", "degree": "Degree"}
DESTINATIONS = {"oversea": "overseas universities", "uniten": "UNITEN", "publicuni": "public universities"}
ENTRY_LEVELS = {"spm": "spm", "stpm": "stpm", "diploma": "diploma", "foundation": "foundation"}

_SECTION_ID = re.compile(r"^(prime|shine)-(foundation|preintake|diploma|degree)-(oversea|uniten|publicuni)-(\w+)$")
_NUMBER = re.compile(r"^\d{2}$")
_YEAR = re.compile(r"\b(20\d{2})\b")
_AGE = re.compile(r"age\s+not\s+exceeding\s+(\d{2})\s+years", re.I)
_INCOME = re.compile(r"income", re.I)
_GROUP_HEADING = re.compile(r"^(?:non[\s-]*)?engineering(?:\s+courses)?$", re.I)


class YtnParser(BaseParser):
    source_id = "ytn"
    provider = "Yayasan Tenaga Nasional (YTN)"
    index_url = PAGES["prime"]
    path_prefix = f"{BASE}/"
    max_targets = 1

    #: Overridable in tests; staleness is judged against the run date.
    today = staticmethod(date.today)

    def discover(self, html: str) -> list[str]:
        # Both pages hold every section; one fetch is enough.
        return self.guard([self.index_url])

    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        soup = BeautifulSoup(html, "html.parser")
        sections = [s for s in soup.select(".et_pb_section[id]") if _SECTION_ID.match(s["id"])]
        if not sections:
            # Other YTN pages (gallery, articles, nurture programmes) are not
            # scholarship pages; the prefix routes them here, so say so.
            if soup.select_one(".et_pb_section"):
                return []
            raise ValueError("no requirement sections — page structure changed")

        groups: dict[tuple[str, str], list[dict]] = {}
        oldest_allowed = self.today().year - 1
        for section in sections:
            programme, stage, dest, entry = _SECTION_ID.match(section["id"]).groups()
            if entry == "current" or stage not in STAGES:
                continue
            text = section.get_text(" ", strip=True)
            years = [int(y) for y in _YEAR.findall(text)]
            if years and max(years) < oldest_allowed:
                continue  # stale round left on the page
            groups.setdefault((programme, stage), []).append(
                {
                    "dest": dest,
                    "entry": entry,
                    "conditions": _conditions(section),
                    "fields": _fields(section),
                }
            )

        apply = self._apply_link(soup)
        out = []
        for (programme, stage), routes in groups.items():
            out.append(self._record(programme, stage, routes, apply))
        return out

    # -- record ----------------------------------------------------------
    def _record(self, programme, stage, routes, apply) -> ScrapedScholarship:
        name = f"{NAMES[programme]} ({STAGES[stage]})"
        dests = list(dict.fromkeys(DESTINATIONS[r["dest"]] for r in routes))
        all_conditions = [c for r in routes for c in r["conditions"]]
        entry_lines = " ".join(c for c in all_conditions if c.lower().startswith("pass your"))
        levels = [ENTRY_LEVELS[r["entry"]] for r in routes if r["entry"] in ENTRY_LEVELS]
        levels += [lvl for lvl in match_levels(entry_lines) if lvl != "spm" or "spm" in levels]
        field_text = " . ".join(f for r in routes for f in r["fields"])

        kind = "Scholarship" if programme == "prime" else "Convertible-loan sponsorship"
        description = (
            f"{kind} from Yayasan Tenaga Nasional for {STAGES[stage].lower()} study at "
            f"{_join(dests)}."
        )
        fields_listed = list(dict.fromkeys(f for r in routes for f in r["fields"]))
        if fields_listed:
            description += f" Fields of study listed: {', '.join(fields_listed)}."
        description += (
            " Applicants are shortlisted and interviewed; successful candidates are "
            "contacted within three months."
        )
        funding = None
        if programme == "shine":
            funding = "Convertible loan (pinjaman boleh ubah); partial or full sponsorship"

        record = ScrapedScholarship(
            name=clean_text(name, "name")[0],
            provider=self.provider,
            source_url=PAGES[programme],
            description=clean_text(description, "description")[0],
            funding_amount=funding,
            education_levels=list(dict.fromkeys(levels)),
            field_of_study=match_fields(field_text),
            application_link=apply,
        )
        record.criteria = self._criteria(routes)
        return record

    def _criteria(self, routes) -> list[ScrapedCriterion]:
        """Conditions shared by every route are stated once; route-specific ones
        are prefixed with their destination and entry. All non-checkable, as
        documented on JpaParser._criteria."""
        out: list[ScrapedCriterion] = []

        def add(kind, op, value, label):
            text, _ = clean_text(label, "label")
            if text and text not in [c.label for c in out] and len(out) < 20:
                out.append(ScrapedCriterion(kind, op, value, text, is_checkable=False))

        ages = {int(m.group(1)) for r in routes for c in r["conditions"] if (m := _AGE.search(c))}
        if len(ages) == 1:
            line = next(c for r in routes for c in r["conditions"] if _AGE.search(c))
            add("age", "lte", ages.pop(), line)
        if any(_INCOME.search(c) for r in routes for c in r["conditions"]):
            add("other", "contains", "household-income",
                "Parents' income is considered when awarding partial or full sponsorship")

        def common(rs):
            return set(rs[0]["conditions"]).intersection(*(r["conditions"] for r in rs[1:]))

        shared = common(routes)
        dests = {r["dest"] for r in routes}
        by_dest = {d: common([r for r in routes if r["dest"] == d]) for d in dests}
        multi = {d: sum(r["dest"] == d for r in routes) > 1 for d in dests}
        for r in routes:
            for line in r["conditions"]:
                if _AGE.search(line) and len(ages) <= 1 or _INCOME.search(line):
                    continue
                if line in shared or len(routes) == 1:
                    label = line
                elif multi[r["dest"]] and line in by_dest[r["dest"]]:
                    label = f"{DESTINATIONS[r['dest']]}: {line}"
                else:
                    label = f"{DESTINATIONS[r['dest']]}, {r['entry'].upper()} entry: {line}"
                add("other", "contains", "provider-condition", label)
        return out

    def _apply_link(self, soup) -> str | None:
        for anchor in soup.find_all("a", href=True):
            if re.search(r"\bapply\b", anchor.get_text(" ", strip=True), re.I):
                link = clean_url(anchor["href"], require_allowlist=True)
                if link:
                    return link
        return None


def _conditions(section) -> list[str]:
    out = []
    for row in section.select(".et_pb_row_nested"):
        cols = row.find_all("div", class_="et_pb_column", recursive=False)
        if len(cols) == 2 and _NUMBER.match(cols[0].get_text(" ", strip=True)):
            text = re.sub(r"\s+", " ", cols[1].get_text(" ", strip=True)).strip()
            if text and text not in out:
                out.append(text)
    return out


def _fields(section) -> list[str]:
    """Discipline names listed under each 'Field of study' heading."""
    out = []
    for h4 in section.find_all("h4"):
        if not re.match(r"field\s+of\s+study", h4.get_text(" ", strip=True), re.I):
            continue
        holder = h4.find_parent(class_="et_pb_text") or h4.parent
        for el in holder.find_all(["p", "li"]):
            text = el.get_text(" ", strip=True)
            if text and not re.match(r"field\s+of\s+study", text, re.I):
                for t in el.get_text("\n").split("\n"):
                    t = re.sub(r"^non[\s-]*engineering\s*,\s*", "", t.strip(), flags=re.I)
                    if t:
                        out.append(t)
    # Group headings ("Engineering Courses", "Non Engineering") are not fields.
    return [f for f in dict.fromkeys(out) if not _GROUP_HEADING.match(f)]


def _join(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " or " + items[-1]
