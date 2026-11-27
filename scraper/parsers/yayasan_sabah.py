"""
Parser for Yayasan Sabah higher-education sponsorship, published through the
Sabah Education Sponsorship Portal (PTPS, ptps.sabah.gov.my).

VERIFIED AGAINST THE LIVE SITES, 22 November 2026.
  ysnet.org.my now redirects (over plain http) to yayasansabahgroup.org.my,
  whose education page only describes the programmes in prose and says that
  since 2024 all Sabah sponsorship applications go through PTPS. PTPS
  (robots.txt 404 = no restrictions) lists four sponsors on one
  `sponsor.php?id=...` path; Yayasan Sabah's page carries no programme text,
  only a "Muat Turun Iklan KYS" link to the year's advertisement PDF
  ("Yayasan Sabah 2026.pdf"). The PDF has a real text layer (no OCR) and is
  fetched through Fetcher.get_pdf_document: https only, robots, size and a
  time-limited decoding worker. No login or anti-bot control is involved.

HOW IT IS READ
  attachment() returns the PDF linked from the sponsor page, so each year's
  advertisement is followed from the same source URL without a code change.
  The one-page advertisement is laid out in two columns; pypdf's layout text
  interleaves them line by line, so the page is rebuilt from positioned chunks
  (left column, then right) before parsing. Programmes are numbered items under
  1. BIASISWA, 2. DERMASISWA and 3. PINJAMAN PENGAJIAN; each item runs to the
  next item, section heading or end of its column, with labelled lines
  "Peringkat Pengajian", "Kursus" and "Tempat Pengajian".

WHICH PROGRAMMES
  Every numbered item whose study level includes certificate, pre-diploma,
  diploma, foundation, matriculation, pre-U or a bachelor's degree. Items for
  Master's/PhD only (1.5, 1.14) and the post-graduate diploma (1.19) are
  skipped. Shared conditions from the advertisement are attached to every
  record: Sabah origin, Malaysian citizenship, the age limit (35 for
  certificate/diploma/degree) and the closing date.

EDUCATION LEVELS
  From the level of study funded, as for Yayasan Sarawak: pre-degree study ->
  spm; bachelor's study -> the qualification named in its CGPA requirement
  if one is stated, otherwise stpm/matriculation/foundation/diploma; STAM
  named as an entry route -> stam. An award judged on "SPM 2025" results is
  spm only. Note "Ijazah Sarjana" is a Master's degree, "Ijazah Sarjana Muda"
  and bare "Ijazah" a bachelor's.
"""

from __future__ import annotations

import re
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup

from ..models import ScrapedCriterion, ScrapedScholarship
from ..parsers.base import BaseParser
from ..parsers.keywords import match_fields, match_levels
from ..sanitise import clean_documents, clean_text, clean_url, parse_date

SPONSOR_URL = "https://ptps.sabah.gov.my/landing/sponsor.php?id=QlN1L0lab3hRd3NXQ3hEcUhwQ1dFUT09"
PTPS_HOST = "ptps.sabah.gov.my"
APPLY_URL = "https://ptps.sabah.gov.my/"

KINDS = {"1": "Biasiswa (scholarship)", "2": "Dermasiswa (bursary)", "3": "Pinjaman pengajian (study loan)"}
DEGREE_FEEDERS = ["stpm", "matriculation", "foundation", "diploma"]

_ITEM = re.compile(r"^\s*([1-3])\.(\d{1,2})\.?\s+(\S.*)$")
_SECTION = re.compile(r"^\s*\d\.\s+[A-Z][A-Z ]{3,}")
_LABEL = re.compile(r"^\s*(Peringkat\s+Pengajian|Kursus|Tempat\s+Pengajian)\s*:\s*(.*)$", re.I)
_PRE_DEGREE = re.compile(r"\bSijil\b|Pra-?\s?Diploma|\bDiploma\b(?!\s+Lepasan)|\bAsasi\b|Matrikulasi|Pra-?U\b|\bA\W?\s?Level|persijilan", re.I)
# "Lepasan Ijazah" (a graduate) and "Ijazah Sarjana" (a Master's) are not
# bachelor's study.
_BACHELOR = re.compile(r"(?<!Lepasan\s)\bIjazah\b(?!\s+Sarjana(?!\s+Muda))(?!\s+Lepasan)|Sarjana\s+Muda", re.I)
_INCOME = re.compile(r"\bB40\b|\bM40\b", re.I)
_POSTGRAD = re.compile(r"\bSarjana\b(?!\s+Muda)|\bPhD\b|Doktor\s+Falsafah|Lepasan\s+Ijazah|Kepakaran", re.I)
_SPM_RESULT = re.compile(r"peperiksaan\s+SPM\s+20\d{2}", re.I)
_QUALIFIER = re.compile(r"Kelayakan|Sekurang-kurangnya|keputusan\s+minima|perlu\s+mendapat", re.I)


class YayasanSabahParser(BaseParser):
    source_id = "yayasan_sabah"
    provider = "Yayasan Sabah"
    index_url = SPONSOR_URL
    path_prefix = SPONSOR_URL
    max_targets = 1

    def discover(self, html: str) -> list[str]:
        return self.guard([self.index_url])

    # -- the HTML sponsor page -----------------------------------------
    def attachment(self, html: str, url: str) -> str | None:
        soup = BeautifulSoup(html, "html.parser")
        if not self._is_sponsor_page(soup):
            return None
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"]
            if not href.lower().endswith(".pdf"):
                continue
            parts = urlsplit(urljoin(url, href))
            target = urlunsplit(("https", parts.netloc, quote(parts.path, safe="/%"), "", ""))
            if parts.hostname == PTPS_HOST and parts.scheme == "https":
                return target
        return None

    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        # Reached only when attachment() found no PDF.
        if self._is_sponsor_page(BeautifulSoup(html, "html.parser")):
            raise ValueError("Yayasan Sabah sponsor page links no advertisement PDF — page changed")
        return []

    @staticmethod
    def _is_sponsor_page(soup) -> bool:
        name = soup.select_one(".member__name")
        return bool(name and "yayasan sabah" in name.get_text(" ", strip=True).lower())

    # -- the advertisement PDF -----------------------------------------
    def parse_attachment(self, pages, html: str, url: str) -> list[ScrapedScholarship]:
        columns = [col for page in pages for col in _columns(page)]
        text = "\n".join(columns)
        if "JENIS-JENIS TAJAAN" not in text.upper():
            raise ValueError("advertisement PDF has no 'Jenis-jenis tajaan' list — layout changed")

        closing = re.search(r"Tarikh\s+tutup\s+permohonan[^\n]*", text, re.I)
        deadline = parse_date(closing.group(0)) if closing else None
        # The applicant-origin conditions sit in a full-width intro above the two
        # columns, so a column split would cut them; read them from the layout
        # text, which keeps a full-width line whole. Age limits sit in a column.
        shared = _shared_criteria("\n".join(page.text for page in pages), text)

        # Every programme's full terms are in this advertisement, so it is linked
        # from each record for students to open.
        # Decode first: "%20Sabah%202026" would otherwise read as 2020.
        year = re.search(r"\b(20\d{2})\.pdf$", unquote(self.attachment(html, url) or ""), re.I)
        documents = clean_documents(
            [{"label": f"Iklan tawaran tajaan Yayasan Sabah {year.group(1) if year else ''} (PDF)".replace("  ", " "),
              "url": self.attachment(html, url)}],
            url,
        )
        out: list[ScrapedScholarship] = []
        for column in columns:
            for item in _items(column):
                record = self._record(item, url, deadline, shared)
                if record is not None:
                    record.source_documents = list(documents)
                    out.append(record)
        if not out:
            raise ValueError("no programmes extracted from the advertisement PDF")
        return out

    def _record(self, item, url, deadline, shared) -> ScrapedScholarship | None:
        section, name, prose, labels = item
        study = " ".join(labels.get("peringkat pengajian", []) + labels.get("kursus", [])) or f"{name} {prose}"
        pre, bachelor = bool(_PRE_DEGREE.search(study)), bool(_BACHELOR.search(study))
        if not (pre or bachelor):
            if _POSTGRAD.search(study) or _POSTGRAD.search(prose):
                return None  # Master's / PhD / post-graduate diploma only
        name_value, _ = clean_text(name if "yayasan sabah" in name.lower() else f"Yayasan Sabah {name}", "name")
        if not name_value:
            return None

        description = prose
        place = " ".join(labels.get("tempat pengajian", []))
        if place:
            description += f" Tempat pengajian: {place}."
        field_text = re.sub(r"perubatan\s+veterinar", "veterinar", f"{name} {prose} {' '.join(labels.get('kursus', []))}", flags=re.I)

        record = ScrapedScholarship(
            name=name_value,
            provider=self.provider,
            source_url=url,
            description=clean_text(description, "description")[0],
            funding_amount=KINDS[section],
            education_levels=_levels(prose, pre, bachelor),
            field_of_study=match_fields(field_text),
            deadline=deadline,
            application_link=clean_url(APPLY_URL, require_allowlist=True),
        )
        criteria = list(shared)
        if _INCOME.search(prose):
            criteria.append(ScrapedCriterion(
                "other", "contains", "household-income",
                "Household income category is considered (B40)", is_checkable=False,
            ))
        for sentence in re.split(r"(?<=\.)\s+", prose):
            if _QUALIFIER.search(sentence):
                label, _ = clean_text(sentence, "label")
                if label and label not in [c.label for c in criteria]:
                    criteria.append(ScrapedCriterion("other", "contains", "provider-condition", label, is_checkable=False))
        record.criteria = criteria[:14]
        return record


def _columns(page) -> list[str]:
    """Rebuild a course_pdf.PdfPage's text column by column from its positioned
    chunks ([x, y, text, size]); fall back to the plain text when there are none."""
    chunks = list(page.chunks or ())
    if not chunks:
        return [page.text]
    xs = [c[0] for c in chunks]
    split = (min(xs) + max(xs)) / 2
    out = []
    for left in (True, False):
        rows: dict[int, list] = {}
        for c in chunks:
            if (c[0] < split) == left:
                rows.setdefault(round(c[1]), []).append(c)
        lines = [
            re.sub(r"\s+", " ", " ".join(str(part[2]).strip() for part in sorted(rows[y]))).strip()
            for y in sorted(rows, reverse=True)
        ]
        out.append("\n".join(ln for ln in lines if ln))
    return out


def _items(column: str):
    """Yield (section, name, prose, {label: value}) for each numbered item. An
    item runs to the next item, the next section heading or the column's end."""
    current = None
    for line in column.splitlines():
        item = _ITEM.match(line)
        if item or _SECTION.match(line):
            if current:
                yield _finish(current)
            current = {"section": item.group(1), "name": item.group(3).strip(), "lines": []} if item else None
        elif current is not None:
            current["lines"].append(line)
    if current:
        yield _finish(current)


def _finish(current):
    prose: list[str] = []
    labels: dict[str, list[str]] = {}
    active = None
    for line in current["lines"]:
        label = _LABEL.match(line)
        if label:
            active = re.sub(r"\s+", " ", label.group(1)).lower()
            labels.setdefault(active, []).append(label.group(2).strip())
        elif active:
            labels[active].append(line.strip())
        else:
            prose.append(line.strip())
    text = re.sub(r"\s+", " ", " ".join(prose)).replace(" .", ".").strip()
    labels = {k: [re.sub(r"\s+", " ", " ".join(v)).strip()] for k, v in labels.items()}
    return current["section"], current["name"].rstrip(". "), text, labels


def _levels(prose: str, pre: bool, bachelor: bool) -> list[str]:
    if _SPM_RESULT.search(prose):
        return ["spm"]  # awarded on this year's SPM results
    levels: list[str] = ["spm"] if pre else []
    if bachelor:
        cgpa = [s for s in re.split(r"(?<=\.)\s+", prose) if re.search(r"CGPA", s, re.I)]
        named = [lvl for s in cgpa for lvl in match_levels(s) if lvl != "spm"]
        if re.search(r"PreMedic|Matrikulasi", " ".join(cgpa), re.I) and "matriculation" not in named:
            named.append("matriculation")
        if named:
            levels += named
        elif re.search(r"\bSTAM\b", prose):
            levels += ["stam", "spm"]  # direct entry on STAM or SPM results
        else:
            levels += DEGREE_FEEDERS
    if re.search(r"\bSTAM\b", prose) and "stam" not in levels:
        levels.append("stam")
    return list(dict.fromkeys(levels))


def _shared_criteria(intro: str, text: str) -> list[ScrapedCriterion]:
    out: list[ScrapedCriterion] = [
        ScrapedCriterion("citizenship", "eq", "MY", "Malaysian citizen", is_checkable=False)
    ]
    # Each origin route may wrap onto the next line; it ends at "; atau" or ".".
    for line in re.findall(r"\((?:i{1,3})\)\s*(Pemohon,.+?)(?:;|\.)(?=\s)", intro, re.S):
        label, _ = clean_text(re.sub(r"\s+", " ", line).strip(), "label")
        if label:
            out.append(ScrapedCriterion("other", "contains", "sabahan", label, is_checkable=False))
    age = re.search(r"Sijil/Diploma/Ijazah\s*-\s*tidak\s+melebihi\s+(\d{2})", text, re.I)
    if age:
        out.append(
            ScrapedCriterion(
                "age", "lte", int(age.group(1)),
                f"Sijil/Diploma/Ijazah: umur tidak melebihi {age.group(1)} tahun", is_checkable=False,
            )
        )
    return out
