"""Evidence-bearing course candidates; identity does not depend on mutable content."""
from dataclasses import dataclass, field, asdict

@dataclass
class CourseCandidate:
    source: str
    programme_key: str
    source_url: str
    record: dict = field(default_factory=dict)
    evidence: dict = field(default_factory=dict)
    issues: list[str] = field(default_factory=list)
    error: str | None = None

    def to_payload(self):
        return asdict(self)

@dataclass
class CourseRunSummary:
    found: int = 0
    fetched: int = 0
    valid: int = 0
    inserted: int = 0
    updated: int = 0
    unchanged: int = 0
    protected_manual: int = 0
    incomplete: int = 0
    fetch_failed: int = 0
    # Published courses whose page could not be re-checked this run; kept as they
    # are (and counted as unchanged) rather than reported as failures.
    kept_unchecked: int = 0
    coverage_complete: bool = True
    errors: list[str] = field(default_factory=list)
    pathway_counts: dict = field(default_factory=dict)
    coverage_issues: list[str] = field(default_factory=list)

    @property
    def status(self):
        if not self.coverage_complete or self.fetch_failed:
            return 'partial' if self.fetched else 'failed'
        return 'completed'

    def to_payload(self):
        return {**asdict(self), 'status': self.status}
