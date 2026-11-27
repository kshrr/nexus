"""Source-neutral programme references and traversal events."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ProgrammeReference:
    programme_key: str
    source_url: str
    pathway_type: str
    context: dict = field(default_factory=dict)


@dataclass(frozen=True)
class SourceFailure:
    url: str
    error: str


class BudgetExceeded(RuntimeError):
    pass
