"""
Data model for the targeted scholarship scraper.

Every field here maps onto a column that ALREADY EXISTS in the Nexus schema
(migrations 0003 and 0010). Nothing new was invented: the brief says not to
create duplicate fields, and an unmapped field would silently never reach the
student-facing page anyway.

    scraper field            -> nexus column
    ---------------------------------------------------------------
    name                     -> scholarships.name
    provider                 -> scholarships.provider
    description              -> scholarships.description
    funding_amount           -> scholarships.funding_amount      (free text)
    education_levels         -> scholarships.education_levels    (text[])
    field_of_study           -> scholarships.field_of_study      (text[])
    deadline                 -> scholarships.deadline            (date, nullable)
    application_link         -> scholarships.application_link    (https only)
    source_url               -> scholarships.source_url
    source_hash              -> scholarships.source_hash         (partial unique)
    scraped_at               -> scholarships.last_scraped_at
    status                   -> scholarships.status
    criteria[]               -> scholarship_criteria rows
    (provenance)             -> scholarships.is_manual, set by the DB trigger

TWO FIELDS THE BRIEF ASKS FOR HAVE NO COLUMN, and are handled rather than faked:

  * "Application opening date" — there is no `opens_at` column. The application
    timeline in Figure 4.5 was never given a data model (requirements.md M-09),
    so an opening date is appended to the description text instead of inventing
    a column. Reported rather than silently dropped.

  * "Household/income requirements" — captured as a NON-CHECKABLE criterion.
    The scholarship's own condition is recorded and shown to the student, but
    Nexus still collects no student income: D-24 / Conflict C-11b removes
    financial background from matching entirely, on the grounds that gathering
    household income from people who may be minors is the worst privacy
    decision available. Storing the requirement is not the same as collecting
    the answer.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal

# scholarship_criteria.criterion_type — migration 0003 CHECK constraint.
CriterionType = Literal[
    "citizenship",
    "education_level",
    "field_of_study",
    "min_grade",
    "subject_grade",
    "age",
    "other",
]

# scholarship_criteria.operator — same CHECK constraint.
Operator = Literal["eq", "in", "gte", "lte", "contains"]

# scholarships.status — same CHECK constraint.
Status = Literal["active", "expired", "flagged", "archived"]

# profiles.education_level enum (architecture.md §3.9). A scraped level that is
# not in this set is dropped rather than stored, or the scholarship would never
# match a student's filter.
EDUCATION_LEVELS = ("spm", "stpm", "stam", "matriculation", "foundation", "diploma")


@dataclass
class ScrapedCriterion:
    """One eligibility condition, destined for scholarship_criteria."""

    criterion_type: CriterionType
    operator: Operator
    value: Any
    label: str
    # False for anything Nexus cannot verify from a student's stored profile.
    # Rendered as a grey dash, never a red cross (§10.6) — a false failure could
    # stop a student applying for something they actually qualify for.
    is_checkable: bool = False

    def to_row(self, scholarship_id: str) -> dict:
        return {
            "scholarship_id": scholarship_id,
            "criterion_type": self.criterion_type,
            "operator": self.operator,
            "value": self.value,
            "label": self.label,
            "is_checkable": self.is_checkable,
        }


@dataclass
class ScrapedScholarship:
    """One scholarship as extracted from a source page, before validation."""

    name: str
    provider: str
    source_url: str
    description: str | None = None
    funding_amount: str | None = None
    education_levels: list[str] = field(default_factory=list)
    field_of_study: list[str] = field(default_factory=list)
    deadline: date | None = None
    application_link: str | None = None
    criteria: list[ScrapedCriterion] = field(default_factory=list)

    # Set by the pipeline, not the parser.
    source_hash: str | None = None
    status: Status = "active"
    scraped_at: datetime | None = None

    #: Human-readable reasons this record was flagged. Non-empty => flagged.
    flags: list[str] = field(default_factory=list)

    @property
    def is_flagged(self) -> bool:
        return bool(self.flags)

    def to_row(self) -> dict:
        """The scholarships row. `is_manual` is deliberately absent: the DB
        trigger owns it, and sending it would let the scraper claim a record
        was human-managed."""
        return {
            "name": self.name,
            "provider": self.provider,
            "description": self.description,
            "funding_amount": self.funding_amount,
            "education_levels": self.education_levels,
            "field_of_study": self.field_of_study,
            "deadline": self.deadline.isoformat() if self.deadline else None,
            "application_link": self.application_link,
            "status": "flagged" if self.is_flagged else self.status,
            "source_url": self.source_url,
            "source_hash": self.source_hash,
            "last_scraped_at": (self.scraped_at or datetime.now()).isoformat(),
        }

    def identity(self) -> str:
        """The stable natural key a source_hash is derived from."""
        return f"{self.source_url}|{self.name}"


@dataclass
class ScrapeStats:
    """Counters for one run, written to crawl_logs."""

    discovered: int = 0
    inserted: int = 0
    updated: int = 0
    skipped_unchanged: int = 0
    skipped_manual: int = 0
    flagged: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)

    def error(self, message: str) -> None:
        self.failed += 1
        # Bounded so a pathological run cannot write an unbounded log row.
        if len(self.errors) < 25:
            self.errors.append(message[:300])

    @property
    def status(self) -> str:
        """crawl_logs.status CHECK: success | partial | failed."""
        if self.failed and not (self.inserted or self.updated or self.skipped_unchanged):
            return "failed"
        if self.failed or self.flagged:
            return "partial"
        return "success"

    def summary(self) -> str:
        return (
            f"discovered={self.discovered} inserted={self.inserted} "
            f"updated={self.updated} unchanged={self.skipped_unchanged} "
            f"manual-protected={self.skipped_manual} flagged={self.flagged} "
            f"failed={self.failed}"
        )
