"""
Sanitisation of scraped text — FR-SEC-06, and the mitigation for vulnerability
V-01 (indirect prompt injection via the crawler -> chatbot path).

WHY THIS FILE MATTERS MORE THAN THE REST OF THE SCRAPER

Everything here processes attacker-controllable input. A scholarship provider's
page is third-party content: if one were compromised, or a description field
were editable by an outsider, whatever it contained would flow into the Nexus
database and from there into any surface that reads it. requirements.md §13.3
names this the strongest security contribution available in the project.

The steps are transcribed from architecture.md §10.4:

    1. strip HTML tags and entities
    2. strip control characters and zero-width / bidi characters
    3. collapse whitespace, enforce a maximum length per field
    4. neutralise instruction-like patterns          <- the injection defence
    5. FLAG rather than discard a record over the suspicion threshold
    6. require https on application_link and an allowlisted host

Step 5 is the one people get wrong. Silently dropping a suspicious record hides
an attack; flagging it puts the evidence in front of an administrator and leaves
a trail. That is why `neutralise` reports what it changed instead of quietly
cleaning up.

This is defence in depth, not elimination. It is layered with §12.2 (scraped
descriptions are excluded from the chatbot payload entirely), §12.3 prompt
hardening, and §12.4 output filtering. The thesis should say so plainly.
"""

from __future__ import annotations

import html
import re
import unicodedata
from datetime import date, datetime
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

# --- field length caps ------------------------------------------------------
# Mirrors the DB: chat_messages caps at 4000, and an over-long description is
# itself a signal. These are deliberately generous but finite.
MAX_LENGTHS = {
    "name": 200,
    "provider": 120,
    "description": 4000,
    "funding_amount": 300,
    "label": 300,
}

# --- step 4: instruction-like patterns -------------------------------------
# Taken from architecture.md §10.4. Each is a phrase that only appears in
# scraped prose when someone is trying to address a language model rather than
# a reader.
INJECTION_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("override-instruction", re.compile(r"ignore\s+(all\s+)?previous\s+instructions?", re.I)),
    ("override-instruction", re.compile(r"disregard\s+(the\s+)?(above|previous|prior)", re.I)),
    ("override-instruction", re.compile(r"forget\s+(all\s+)?(your\s+)?(previous\s+)?instructions?", re.I)),
    ("role-injection", re.compile(r"^\s*(system|assistant|user)\s*:", re.I | re.M)),
    ("role-injection", re.compile(r"you\s+are\s+now\s+", re.I)),
    ("role-injection", re.compile(r"act\s+as\s+(an?\s+)?\w+", re.I)),
    ("new-instructions", re.compile(r"new\s+instructions?\s*:", re.I)),
    ("delimiter-spoof", re.compile(r"</?\s*(student_context|system|instructions?)\s*>", re.I)),
    ("delimiter-spoof", re.compile(r"-{3,}\s*END", re.I)),
    ("delimiter-spoof", re.compile(r"#{3,}")),
    ("markdown-fence", re.compile(r"```")),
    ("data-exfil", re.compile(r"(reveal|print|repeat|output)\s+(your\s+)?(system\s+)?prompt", re.I)),
]

#: More than this many distinct hits and the record is not merely cleaned but
#: flagged for a human. One stray "###" in a real page is plausible; four
#: different injection shapes in one description is not.
SUSPICION_THRESHOLD = 2

_REDACTION = "[removed]"

# Zero-width, bidi-override and other invisible characters. Bidi overrides in
# particular can make stored text render differently from what was stored.
_INVISIBLE = re.compile(
    "["
    "​-‏"  # zero-width space/joiners, LRM/RLM
    "‪-‮"  # bidi embedding/override
    "⁠-⁤"  # word joiner, invisible operators
    "⁪-⁯"  # deprecated format chars
    "﻿"  # BOM
    "]"
)

_TAG = re.compile(r"<[^>]*>")
_WS = re.compile(r"[ \t ]+")
_BLANKS = re.compile(r"\n{3,}")

# Tracking parameters stripped from any stored URL.
_TRACKING = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "gclid", "fbclid", "msclkid", "mc_cid", "mc_eid", "igshid", "ref", "ref_src",
    "_ga", "_gl", "yclid", "twclid",
}

#: Hosts an application_link may point at. An arbitrary link harvested from a
#: page and shown to a student inside a trusted UI is a phishing vector, so the
#: destination is constrained rather than trusted (§10.4 step 6).
LINK_ALLOWLIST = (
    "jpa.gov.my",
    "mara.gov.my",
    "petronas.com",
    "petronas.com.my",
    "mohe.gov.my",
    "moe.gov.my",
    "mqa.gov.my",
    "yayasanpeneraju.com.my",
    "biasiswa.gov.my",
)


# ---------------------------------------------------------------------------
# steps 1-3: strip, normalise, bound
# ---------------------------------------------------------------------------
def strip_html(raw: str | None) -> str:
    """Remove tags and resolve entities. Applied before anything else so a
    pattern cannot hide inside markup."""
    if not raw:
        return ""
    text = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", raw)
    text = _TAG.sub(" ", text)
    # Twice: an entity can decode into another entity ("&amp;lt;" -> "&lt;").
    text = html.unescape(html.unescape(text))
    return text


def strip_invisible(text: str) -> str:
    """Drop control and invisible characters, keeping newlines and tabs."""
    text = _INVISIBLE.sub("", text)
    return "".join(
        ch for ch in text if ch in "\n\t" or unicodedata.category(ch)[0] != "C"
    )


def collapse_whitespace(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _WS.sub(" ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    return _BLANKS.sub("\n\n", text).strip()


def dedupe_lines(text: str) -> str:
    """Remove consecutive repeated lines.

    Template-driven pages repeat navigation and boilerplate; the same sentence
    three times is noise, not emphasis. Only CONSECUTIVE repeats are dropped so
    a legitimately recurring phrase elsewhere in the text survives.
    """
    out: list[str] = []
    for line in text.split("\n"):
        if out and line.strip() and line.strip() == out[-1].strip():
            continue
        out.append(line)
    return "\n".join(out)


def fix_encoding(text: str) -> str:
    """Repair the common mojibake from UTF-8 decoded as Latin-1, and normalise
    to NFC so visually identical strings hash identically."""
    if "Ã" in text or "â€" in text:
        try:
            repaired = text.encode("latin-1", "ignore").decode("utf-8", "ignore")
            if repaired.count("�") <= text.count("�"):
                text = repaired
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return unicodedata.normalize("NFC", text)


# ---------------------------------------------------------------------------
# step 4: neutralise instruction-like patterns
# ---------------------------------------------------------------------------
def neutralise(text: str) -> tuple[str, list[str]]:
    """Replace instruction-like sequences and report which kinds were found.

    Returns (cleaned_text, findings). The caller decides what to do with the
    findings — `assess_suspicion` turns them into a flag. The text is always
    cleaned; the flag is about whether a human should look.
    """
    findings: list[str] = []
    cleaned = text
    for kind, pattern in INJECTION_PATTERNS:
        cleaned, count = pattern.subn(_REDACTION, cleaned)
        if count:
            findings.append(kind)
    return cleaned, sorted(set(findings))


def assess_suspicion(findings: list[str]) -> str | None:
    """Turn injection findings into a flag reason, or None."""
    if len(findings) >= SUSPICION_THRESHOLD:
        return f"Suspicious content neutralised in scraped text: {', '.join(findings)}"
    return None


# ---------------------------------------------------------------------------
# the public entry point for text
# ---------------------------------------------------------------------------
def clean_text(raw: str | None, field: str = "description") -> tuple[str | None, list[str]]:
    """Full pipeline for one text field.

    Returns (value_or_None, findings). An empty result is None rather than "",
    so an empty field never masquerades as content.
    """
    if raw is None:
        return None, []

    text = strip_html(raw)
    text = fix_encoding(text)
    text = strip_invisible(text)
    text = collapse_whitespace(text)
    text = dedupe_lines(text)
    text, findings = neutralise(text)
    text = collapse_whitespace(text)

    limit = MAX_LENGTHS.get(field, 1000)
    if len(text) > limit:
        findings.append("over-length")
        text = text[:limit].rsplit(" ", 1)[0] + "…"

    return (text or None), findings


# ---------------------------------------------------------------------------
# URLs
# ---------------------------------------------------------------------------
def clean_url(raw: str | None, *, require_allowlist: bool = False) -> str | None:
    """Normalise a URL, strip tracking parameters, and reject anything that is
    not plain https.

    http is rejected rather than upgraded: an application link is where a
    student types personal details, and silently promoting a scheme the site
    may not serve would produce a broken link that looks deliberate. The
    scholarships table has a CHECK constraint requiring https anyway.
    """
    if not raw:
        return None
    raw = strip_invisible(html.unescape(raw.strip()))
    if not raw:
        return None

    try:
        parsed = urlparse(raw)
    except ValueError:
        return None

    if parsed.scheme != "https" or not parsed.netloc:
        return None

    host = parsed.netloc.lower().split(":")[0]
    if host.startswith("www."):
        host = host[4:]

    if require_allowlist and not any(
        host == allowed or host.endswith(f".{allowed}") for allowed in LINK_ALLOWLIST
    ):
        return None

    query = urlencode(
        [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)
         if k.lower() not in _TRACKING]
    )
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, query, ""))


# ---------------------------------------------------------------------------
# dates
# ---------------------------------------------------------------------------
_MONTHS = {
    "jan": 1, "januari": 1, "january": 1,
    "feb": 2, "februari": 2, "february": 2,
    "mac": 3, "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "mei": 5, "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "julai": 7, "july": 7,
    "ogo": 8, "ogos": 8, "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "okt": 10, "oct": 10, "oktober": 10, "october": 10,
    "nov": 11, "november": 11,
    "dis": 12, "dec": 12, "disember": 12, "december": 12,
}

_DATE_PATTERNS = [
    # 31/12/2026, 31-12-2026, 31.12.2026  (day first — Malaysian convention)
    re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b"),
    # 2026-12-31 (ISO)
    re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b"),
]
_TEXT_DATE = re.compile(
    r"\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b"  # 31 Disember 2026 / 31 December 2026
)


def parse_date(raw: str | None) -> date | None:
    """Parse a date from free text, handling the several formats Malaysian
    provider pages mix — including Bahasa Malaysia month names.

    Ambiguity is resolved day-first (31/12/2026), which is the local
    convention. A value that does not parse returns None rather than a guess:
    a wrong deadline is worse than no deadline, because a student would plan
    around it.
    """
    if not raw:
        return None
    text = collapse_whitespace(strip_html(raw))
    if not text:
        return None

    match = _TEXT_DATE.search(text)
    if match:
        day, month_name, year = match.groups()
        month = _MONTHS.get(month_name.lower().strip("."))
        if month:
            try:
                return date(int(year), month, int(day))
            except ValueError:
                return None

    for pattern in _DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        a, b, c = (int(g) for g in match.groups())
        try:
            if pattern is _DATE_PATTERNS[1]:  # ISO: year first
                return date(a, b, c)
            return date(c, b, a)  # day first
        except ValueError:
            return None
    return None


def parse_datetime_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
