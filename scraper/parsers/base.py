"""
Parser interface.

Each source gets its own parser because provider sites share no structure —
JPA is Joomla/YOOtheme, MARA is WordPress, PETRONAS is Drupal. A single generic
extractor across all three would be a pile of special cases pretending to be
one algorithm.

A parser does two things and nothing else:

    discover(html)  -> the TARGET page URLs for this source
    parse(html,url) -> one ScrapedScholarship

`discover` is what keeps this a targeted scraper rather than a crawler. It
returns a bounded list drawn from one known index page; it never follows
arbitrary links, never recurses, and never leaves the source's own path prefix.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import ScrapedScholarship


class BaseParser(ABC):
    #: Stable identifier used in logs and the source registry.
    source_id: str = ""

    #: Human-readable provider name written to scholarships.provider.
    provider: str = ""

    #: The single index page scholarship links are discovered from.
    index_url: str = ""

    #: Every discovered URL must start with this. The guard that stops a bug in
    #: link extraction turning a targeted scraper into a site-wide crawler.
    path_prefix: str = ""

    #: Some providers never publish a per-programme application URL — they open
    #: applications seasonally through a separate portal. Declaring that here
    #: stops validation flagging every record from such a source for a missing
    #: link, which would bury real problems in the review queue. The student
    #: still reaches the official page via source_url, which the detail page
    #: already renders.
    publishes_application_links: bool = True

    #: Upper bound on target pages per run. A source that suddenly offers 500
    #: links has changed shape and should be re-inspected, not hammered.
    max_targets: int = 25

    @abstractmethod
    def discover(self, html: str) -> list[str]:
        """Return absolute URLs of the scholarship pages to fetch."""

    @abstractmethod
    def parse(self, html: str, url: str) -> list[ScrapedScholarship]:
        """Extract every scholarship on the page.

        Usually one, but a provider that lists several programmes on a single
        page (BNM's Kijang tabs, YSD's accordion) returns several. Raise
        ValueError if the page is not a scholarship page at all; return an empty
        list only if the page is valid but genuinely holds nothing to store.
        """

    def guard(self, urls: list[str]) -> list[str]:
        """Apply the prefix and count limits to discovered URLs.

        Deliberately in the base class: a parser author cannot forget it, and a
        parser that starts returning off-site links fails closed.
        """
        kept: list[str] = []
        for url in urls:
            if self.path_prefix and not url.startswith(self.path_prefix):
                continue
            if url not in kept:
                kept.append(url)
        return kept[: self.max_targets]
