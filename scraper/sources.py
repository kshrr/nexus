"""
The source registry.

A source is only listed here once its site has been INSPECTED and a parser
written against real captured HTML. Registering a source speculatively would
produce a parser that either extracts nothing or, worse, extracts the wrong
text and presents it to a student as an eligibility requirement.

Reconnaissance performed 9 September 2026 (all against the live sites):

    jpa       penajaan.jpa.gov.my        robots.txt permits the content tree;
                                         7 student programmes in one enumerable
                                         index.                     REGISTERED.

    petronas  petronas.com/careers/      robots permits it; content server-
              students-graduates         rendered. Extracts only the "Education
                                         Sponsorship (SPM Leavers)" tab.  REGISTERED.

    ysd       yayasansimedarby.com/      robots permits content; server-
              scholarship-information    rendered. Five public awards (staff
                                         programmes skipped).        REGISTERED.

    khazanah  yayasankhazanah.com.my     robots allows all. The programme INDEX
              /scholarship-programmes/   is JS-rendered, but the Khazanah Global
              khazanah-global-...        Scholarship DETAIL page is server-
                                         rendered — that one page is the target. REGISTERED.

    bnm       bnm.gov.my/careers/        Browser and curl get HTTP 200 and the
              scholarships               content IS server-rendered, but the
                                         site's WAF returns HTTP 403 to Python's
                                         HTTP client — the block is on the TLS
                                         fingerprint, not the User-Agent or
                                         rate. Getting past it needs TLS-
                                         handshake spoofing, which the brief
                                         rules out as bypassing anti-bot
                                         protection. NOT scraped.

    mara      biasiswa.mara.gov.my       DNS DOES NOT RESOLVE (verified again
                                         9 Sep 2026). mara.gov.my itself is up
                                         but its sponsorship pages are a moving
                                         target with no stable index; deferred
                                         rather than a blind parser.

The BNM and MARA omissions are REPORTED rather than papered over. See
scraper/README.md and scraper/SECURITY.md.
"""

from __future__ import annotations

from .parsers.base import BaseParser
from .parsers.jpa import JpaParser
from .parsers.khazanah import KhazanahParser
from .parsers.petronas import PetronasParser
from .parsers.ysd import YsdParser

#: Sources that are actually scraped. Keyed by source_id.
REGISTRY: dict[str, type[BaseParser]] = {
    JpaParser.source_id: JpaParser,
    PetronasParser.source_id: PetronasParser,
    YsdParser.source_id: YsdParser,
    KhazanahParser.source_id: KhazanahParser,
}

#: Inspected but not scraped, with the honest reason. Surfaced by --list-sources
#: so the gap is visible in the tool itself, not only in a document.
UNAVAILABLE: dict[str, str] = {
    "bnm": (
        "bnm.gov.my/careers/scholarships is served to a browser and to curl but "
        "its WAF returns HTTP 403 to Python's HTTP client, keyed on the TLS "
        "fingerprint. Bypassing that means spoofing the TLS handshake, which the "
        "brief rules out as defeating anti-bot protection."
    ),
    "mara": (
        "biasiswa.mara.gov.my does not resolve in DNS (verified 9 Sep 2026). "
        "mara.gov.my is reachable but its sponsorship information has no stable, "
        "enumerable index — a parser cannot be pinned to it yet."
    ),
}


def get_parsers(only: list[str] | None = None) -> list[BaseParser]:
    """Instantiate the requested parsers, or all registered ones."""
    if not only:
        return [cls() for cls in REGISTRY.values()]

    unknown = [name for name in only if name not in REGISTRY]
    if unknown:
        hint = ""
        for name in unknown:
            if name in UNAVAILABLE:
                hint += f"\n  {name}: {UNAVAILABLE[name]}"
        raise KeyError(
            f"unknown source(s): {', '.join(unknown)}. "
            f"Registered: {', '.join(REGISTRY)}.{hint}"
        )
    return [REGISTRY[name]() for name in only]

def parser_for_url(url: str) -> BaseParser | None:
    """Known parsers are extraction helpers, not the discovery domain boundary."""
    from urllib.parse import urlsplit
    parts=urlsplit(url)
    for cls in REGISTRY.values():
        parser=cls(); prefix=urlsplit(parser.path_prefix)
        if parts.hostname==prefix.hostname and (parts.path.startswith(prefix.path) or url==parser.index_url): return parser
    return None
