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

    bnm       bnm.gov.my/careers/        Blocked by its WAF (TLS fingerprint) on
              scholarships               9 Sep 2026 and left unscraped; since
                                         re-inspected 22 Nov 2026, it serves the
                                         ordinary Fetcher HTTP 200 with nothing
                                         bypassed. Kijang pre-university and
                                         bachelor's scholarships.   REGISTERED.

    mara      mara.gov.my/en/index/      biasiswa.mara.gov.my still does not
              education/education-       resolve, but the main site (WordPress,
              financing/                 robots permits content) now has a stable
                                         financing index in its sitemap. YTP, TESP
                                         and IPMa extracted; post-graduate and the
                                         advance loan skipped. Re-inspected
                                         22 Nov 2026.               REGISTERED.

    ytm       ytm.tm.com.my/             yayasantm.org.my is gone; tm.com.my
              scholarships-future-leader redirects here. Drupal, robots permits
                                         content; FAQ accordion is server-
                                         rendered. Future Leaders extracted; the
                                         Form 4 Young Leaders award skipped.
                                         Inspected 22 Nov 2026.     REGISTERED.

    ytn       ytn.tnb.com.my/            ytn.org.my is gone. WordPress (Divi),
              biasiswa-prime-scholarship robots permits content with Crawl-delay
                                         10 (honoured). TNB PRIME and SHINE: five
                                         records by programme and stage; enrolled-
                                         student top-ups and the stale 2019/2020
                                         Sabah/Sarawak pre-intake skipped.
                                         Inspected 22 Nov 2026.     REGISTERED.

    yayasan_  yayasansarawak.org.my/en/  WordPress, robots permits content;
    sarawak   biasiswa/ and /en/pinjaman/ collapse panels are server-rendered.
                                         Eight post-SPM scholarships, grants and
                                         loans; school aid (BTYS) and the i-GPS
                                         flight subsidy skipped. Inspected
                                         22 Nov 2026.               REGISTERED.

    yayasan_  ptps.sabah.gov.my          ysnet.org.my redirects to a group site
    sabah     sponsor.php (Yayasan       with prose only; applications run
              Sabah)                     through PTPS, whose sponsor page links
                                         the year's advertisement PDF (text
                                         layer, decoded in the bounded PDF
                                         worker). 24 programmes; Master's/PhD
                                         and post-graduate diploma skipped.
                                         Inspected 22 Nov 2026.     REGISTERED.

    ptptn     ptptn.gov.my/pinjaman-     Elementor toggles server-rendered; the
              pendidikan/                education loan, its conditions and the
                                         annual amount table. 23 Nov 2026. REGISTERED.

    yayasan_  yayasanselangor.org.my/    Current loan offer (updated 19 Nov 2026);
    selangor  pinjaman-pelajaran-2/      the RKPYS school programme is skipped.
                                         23 Nov 2026.              REGISTERED.

    maybank   maybankfoundation.com/     Maybank Group Scholarship Programme:
              …/maybank-groups-          Malaysia and UK routes in Elementor tabs;
              scholarship-programme/     Google Form apply link not stored.
                                         23 Nov 2026.              REGISTERED.

    peneraju  yayasanpeneraju.com.my,    robots allows all and pages are server-
              peneraju.org               rendered, but there is no post-SPM
                                         scholarship any more: the only offering is
                                         course financing (RM5k-RM150k packages) for
                                         certification courses whose minimum entry
                                         is a Diploma or Degree. Re-inspected
                                         22 Nov 2026.               NOT scraped.

The Yayasan Peneraju omission is REPORTED rather than papered over. See scraper/README.md
and scraper/SECURITY.md.
"""

from __future__ import annotations

from .parsers.base import BaseParser
from .parsers.bnm import BnmParser
from .parsers.maybank import MaybankParser
from .parsers.ptptn import PtptnParser
from .parsers.yayasan_selangor import YayasanSelangorParser
from .parsers.jpa import JpaParser
from .parsers.khazanah import KhazanahParser
from .parsers.mara import MaraParser
from .parsers.ytm import YtmParser
from .parsers.ytn import YtnParser
from .parsers.yayasan_sarawak import YayasanSarawakParser
from .parsers.yayasan_sabah import YayasanSabahParser
from .parsers.petronas import PetronasParser
from .parsers.ysd import YsdParser

#: Sources that are actually scraped. Keyed by source_id.
REGISTRY: dict[str, type[BaseParser]] = {
    JpaParser.source_id: JpaParser,
    PetronasParser.source_id: PetronasParser,
    YsdParser.source_id: YsdParser,
    KhazanahParser.source_id: KhazanahParser,
    MaraParser.source_id: MaraParser,
    YtmParser.source_id: YtmParser,
    YtnParser.source_id: YtnParser,
    YayasanSarawakParser.source_id: YayasanSarawakParser,
    YayasanSabahParser.source_id: YayasanSabahParser,
    BnmParser.source_id: BnmParser,
    PtptnParser.source_id: PtptnParser,
    YayasanSelangorParser.source_id: YayasanSelangorParser,
    MaybankParser.source_id: MaybankParser,
}

#: Inspected but not scraped, with the honest reason. Surfaced by --list-sources
#: so the gap is visible in the tool itself, not only in a document.
UNAVAILABLE: dict[str, str] = {
    "peneraju": (
        "Yayasan Peneraju (yayasanpeneraju.com.my, peneraju.org) no longer runs "
        "post-SPM scholarships; its only offering is course financing for "
        "certification courses that require a Diploma or Degree to enter "
        "(inspected 22 Nov 2026). Nothing to show a post-SPM student."
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
        # A prefix with a query (one sponsor on a shared PTPS sponsor.php) only
        # claims that exact query, not every page on the same path.
        if prefix.query and parts.query!=prefix.query: continue
        if parts.hostname==prefix.hostname and (parts.path.startswith(prefix.path) or url==parser.index_url): return parser
    return None
