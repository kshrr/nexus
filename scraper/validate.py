"""
Validation of scraped scholarships before they reach the database.

The governing rule: an invalid record NEVER silently enters the production
scholarship table. It takes one of two paths —

    REJECT  the record is unusable (no name, no source) and cannot be stored
            meaningfully at all
    FLAG    the record is storable but not trustworthy enough to publish; it
            goes in with status='flagged', which hides it from students and
            puts it in the administrator's review queue (§10.4 step 5)

Flagging is preferred to rejecting wherever a human could still salvage the
record. Dropping something silently loses both the data and the evidence that
anything happened.

Nothing here alters the MEANING of a requirement. Sanitisation cleans
presentation; validation decides whether a record is fit to publish. Neither
rewrites what a provider actually asks of a student — a scholarship a student
is wrongly told they qualify for is a worse outcome than a missing one.
"""

from __future__ import annotations

from datetime import date, timedelta

from .models import EDUCATION_LEVELS, ScrapedScholarship
from .sanitise import clean_url

#: A deadline further out than this is almost certainly a mis-parse
#: (a two-digit year read as a century, say) rather than a real date.
MAX_DEADLINE_YEARS = 6

#: Below this, a description is too thin to be worth showing a student.
MIN_DESCRIPTION_CHARS = 60


class RejectedRecord(Exception):
    """The record cannot be stored at all."""


def validate(
    record: ScrapedScholarship,
    *,
    today: date | None = None,
    expect_application_link: bool = True,
) -> ScrapedScholarship:
    """Validate in place, appending to `record.flags`.

    Returns the same record so it can be used in a pipeline. Raises
    RejectedRecord when the record is unusable.
    """
    today = today or date.today()

    # --- hard requirements: without these there is nothing to store ---------
    if not record.name or not record.name.strip():
        raise RejectedRecord("scholarship name is empty")
    if not record.source_url or not clean_url(record.source_url):
        raise RejectedRecord(f"source_url is not a valid https URL: {record.source_url!r}")

    # --- provider: required, but recoverable by an admin --------------------
    if not record.provider or not record.provider.strip():
        record.provider = "Unknown provider"
        record.flags.append("Provider could not be determined from the source page.")

    # --- name sanity --------------------------------------------------------
    if len(record.name.strip()) < 4:
        record.flags.append(f"Scholarship name looks truncated: {record.name!r}")

    # --- application link ---------------------------------------------------
    # Already https-and-allowlist filtered in sanitise. A link that failed
    # that check has been dropped to None, which is recorded rather than
    # passed through: an unreachable or off-domain apply button is worse than
    # none, because a student would trust it.
    if record.application_link is None and expect_application_link:
        record.flags.append("No usable https application link on an allowlisted host.")

    # --- deadline -----------------------------------------------------------
    if record.deadline is not None:
        if record.deadline < today - timedelta(days=1):
            # Not a flag: a closed round is a normal state the UI already
            # handles, and expire_past_deadlines() would set this anyway.
            record.status = "expired"
        elif record.deadline > today + timedelta(days=365 * MAX_DEADLINE_YEARS):
            record.flags.append(
                f"Deadline {record.deadline.isoformat()} is implausibly far away — likely a parse error."
            )
            record.deadline = None

    # --- categorical fields must use Nexus values ---------------------------
    # An unrecognised education level is dropped, not stored: it would never
    # match a student's filter, so keeping it only makes the record look
    # richer than it is.
    unknown_levels = [lvl for lvl in record.education_levels if lvl not in EDUCATION_LEVELS]
    if unknown_levels:
        record.education_levels = [
            lvl for lvl in record.education_levels if lvl in EDUCATION_LEVELS
        ]
        record.flags.append(f"Dropped unrecognised education level(s): {', '.join(unknown_levels)}")

    if not record.education_levels:
        record.flags.append("No education level could be determined — students cannot filter this.")

    # --- description --------------------------------------------------------
    if not record.description:
        record.flags.append("No description extracted.")
    elif len(record.description) < MIN_DESCRIPTION_CHARS:
        record.flags.append("Description is too short to be useful to a student.")

    # --- criteria -----------------------------------------------------------
    # Every criterion needs a label: it becomes the line a student reads on the
    # eligibility checklist, and an unlabelled one would render as a blank row.
    record.criteria = [c for c in record.criteria if c.label and c.label.strip()]

    return record


def summarise(record: ScrapedScholarship) -> str:
    """One line describing the outcome, for --dry-run output and logs."""
    state = "FLAG" if record.is_flagged else record.status.upper()
    bits = [
        f"[{state}]",
        record.name[:58],
        f"({record.provider})",
    ]
    if record.deadline:
        bits.append(f"closes {record.deadline.isoformat()}")
    if record.education_levels:
        bits.append("/".join(record.education_levels))
    if record.criteria:
        bits.append(f"{len(record.criteria)} criteria")
    return " ".join(bits)
