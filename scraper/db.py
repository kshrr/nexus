"""
Database integration for the scraper (PostgREST over HTTPS).

WHY NO SUPABASE SDK
  The whole write path is four RPC calls. `requests` is already a dependency
  for fetching pages, and adding an SDK would widen the dependency surface of a
  job that runs with the service-role key -- the most privileged credential in
  the system -- for no functional gain.

------------------------------------------------------------------------------
THE source_hash DECISION  [DECISION REQUIRED -- D-46]
------------------------------------------------------------------------------
The brief asks for two things from one column:

    (a) "Use the existing source_hash mechanism ... ON CONFLICT (source_hash)"
    (b) "The hash should represent the relevant source scholarship data so that
         the system can determine whether a scholarship has changed"

Taken literally together these are contradictory, and implementing them
literally would corrupt the table. `uq_scholarships_source_hash` makes
source_hash the CONFLICT TARGET -- the natural key that says "this row and that
scraped record are the same scholarship". If the hash also covered the
scholarship's content, then a deadline changing on the provider's site would
change the hash, no existing row would match, and the upsert would INSERT A
SECOND ROW. The student would see the scholarship twice, once with a stale
deadline. Change detection would appear to work while silently destroying
deduplication.

So the two jobs are split, which satisfies the intent of both:

    source_hash    IDENTITY. sha256 of source_url + name. Stable across content
                   changes, so a scholarship maps to the same row for its whole
                   life. This is the ON CONFLICT target.

    content_hash   CHANGE.   sha256 of the fields that matter to a student.
                   Computed here for the dry-run report; the authoritative
                   comparison is field-by-field inside
                   scraper_upsert_scholarship(), which returns 'unchanged' when
                   nothing a student would see has moved.

The field-by-field comparison is preferred over storing a content hash because
it needs no schema change and it survives a change to what the scraper
extracts: a stored hash written by an older version of this file would report
every record as changed after any parser improvement.

REPORTED, not silently decided. If the intent is that source_hash be a content
hash, the unique index has to move to (source_url) first.

------------------------------------------------------------------------------
CREDENTIALS
------------------------------------------------------------------------------
The service-role key is read from the environment only. It is never written to
a log line, never included in an error message, and never reaches a frontend
bundle -- scripts/check-bundle-secrets.mjs fails the build if it does. Errors
from PostgREST pass through redact() before they can reach
crawl_logs.error_message, which an administrator reads in the browser.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone

import requests

from .models import ScrapedScholarship, ScrapeStats

TIMEOUT = 30

#: Anything shaped like a credential, stripped before logging. Covers both key
#: formats Supabase issues: the legacy JWT (service-role keys are JWTs) and the
#: current `sb_secret_` / `sb_publishable_` prefixes. Getting the prefix wrong
#: here would mean a service-role key printed verbatim into a crawl log an
#: administrator can read in the browser.
_SECRET_RE = re.compile(
    r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]+"
    r"|sb_(?:secret|publishable)_[A-Za-z0-9_\-]{8,}"
    r"|service_role_key=\S+"
)


def redact(text: str) -> str:
    """Remove anything that looks like a credential from a message."""
    safe=_SECRET_RE.sub("[redacted]", text or "")
    for name in ('BRAVE_SEARCH_API_KEY','GITHUB_DISPATCH_TOKEN','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY'):
        value=os.environ.get(name,'')
        if len(value)>=4: safe=safe.replace(value,'[redacted]')
    return safe


def content_hash(record: ScrapedScholarship) -> str:
    """Hash of the student-visible content -- the 'has this changed' signal."""
    payload = json.dumps(
        {
            "name": record.name,
            "provider": record.provider,
            "description": record.description,
            "funding_amount": record.funding_amount,
            "education_levels": sorted(record.education_levels),
            "field_of_study": sorted(record.field_of_study),
            "deadline": record.deadline.isoformat() if record.deadline else None,
            "application_link": record.application_link,
            "criteria": sorted(c.label for c in record.criteria),
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def identity_hash(record: ScrapedScholarship) -> str:
    """Hash of the natural key -- the ON CONFLICT target. See the note above."""
    return hashlib.sha256(record.identity().encode("utf-8")).hexdigest()


class ScraperDbError(RuntimeError):
    """A database operation failed. The message is already redacted."""


@dataclass
class ExistingScholarship:
    """The subset of an existing row the scraper needs to reason about."""

    id: str
    name: str
    is_manual: bool
    status: str
    deadline: str | None


class SupabaseClient:
    """Thin PostgREST client scoped to exactly what the scraper needs."""

    def __init__(self, url: str, key: str, *, service_role: bool = True):
        if not url or not key:
            raise ScraperDbError(
                "SUPABASE_URL and a Supabase key are required. Set them in the "
                "environment (GitHub Actions Secrets in CI); they are never read "
                "from a file in the repository."
            )
        self.rest = url.rstrip("/") + "/rest/v1"
        self.service_role = service_role
        self._session = requests.Session()
        self._session.headers.update(
            {
                "apikey": key,
                "Authorization": "Bearer " + key,
                "Content-Type": "application/json",
                "User-Agent": "NexusScholarshipScraper/1.0",
            }
        )

    # -- plumbing -----------------------------------------------------------
    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        try:
            response = self._session.request(
                method, self.rest + path, timeout=TIMEOUT, **kwargs
            )
        except requests.RequestException as exc:
            raise ScraperDbError(redact(f"{method} {path} failed: {exc}")) from None
        if response.status_code >= 400:
            raise ScraperDbError(
                redact(
                    f"{method} {path} -> HTTP {response.status_code}: {response.text[:400]}"
                )
            )
        return response

    def rpc(self, name: str, payload: dict):
        response = self._request("POST", f"/rpc/{name}", json=payload)
        # A `RETURNS void` function (finish_crawl_run) answers 204 with no body;
        # calling .json() on that raises. Scalar- and text-returning functions
        # (begin_crawl_run, scraper_upsert_scholarship) answer 200 with a body.
        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    # -- reads ---------------------------------------------------------------
    # These work with the anon key too, which is what makes --dry-run possible
    # without holding the service-role credential.
    def existing_by_hashes(self, hashes: list[str]) -> dict[str, ExistingScholarship]:
        """Fetch rows matching these identity hashes, keyed by hash."""
        if not hashes:
            return {}
        out: dict[str, ExistingScholarship] = {}
        # Chunked so a long run cannot build a URL the server rejects.
        for start in range(0, len(hashes), 40):
            chunk = hashes[start : start + 40]
            quoted = ",".join('"' + h + '"' for h in chunk)
            rows = self._request(
                "GET",
                "/scholarships",
                params={
                    "select": "id,name,source_hash,is_manual,status,deadline",
                    "source_hash": f"in.({quoted})",
                },
            ).json()
            for row in rows:
                out[row["source_hash"]] = ExistingScholarship(
                    id=row["id"],
                    name=row["name"],
                    is_manual=bool(row["is_manual"]),
                    status=row["status"],
                    deadline=row.get("deadline"),
                )
        return out

    # -- run lifecycle (service role only) -----------------------------------
    def begin_run(self, triggered_by: str, user_id: str | None = None) -> str | None:
        """Claim the right to run. None means another run is already active."""
        return self.rpc(
            "begin_crawl_run",
            {"p_triggered_by": triggered_by, "p_triggered_by_user": user_id},
        )

    def finish_run(self, run_id: str, stats: ScrapeStats) -> None:
        self.rpc(
            "finish_crawl_run",
            {
                "p_id": run_id,
                "p_status": stats.status,
                "p_inserted": stats.inserted,
                "p_updated": stats.updated,
                "p_failed": stats.failed,
                "p_error_message": redact("; ".join(stats.errors))[:2000] or None,
            },
        )

    # -- the write -----------------------------------------------------------
    def upsert(self, record: ScrapedScholarship) -> str:
        """Write one record. Returns the outcome the SQL function decided:
        inserted | updated | unchanged | skipped_manual.

        The decision is made in the database, not here, so an administrator's
        edit cannot be lost to a race between a check and the write.
        """
        return self.rpc(
            "scraper_upsert_scholarship",
            {
                "p_record": record.to_row(),
                "p_criteria": [
                    {
                        "criterion_type": c.criterion_type,
                        "operator": c.operator,
                        "value": c.value,
                        "label": c.label,
                        "is_checkable": c.is_checkable,
                    }
                    for c in record.criteria
                ],
            },
        )

    def discovery_settings(self):
        from .discovery_models import DiscoverySettings
        rows=self._request('GET','/scholarship_discovery_settings',params={'select':'*','id':'eq.true'}).json()
        if not rows: raise ScraperDbError('Scholarship discovery settings are missing. Apply migration 0014.')
        return DiscoverySettings(**{key:value for key,value in rows[0].items() if key not in ('id','updated_at')})

    def stage(self,candidate):
        return self.rpc('scraper_stage_discovery',{'p_candidate':candidate.to_payload()})

    def selected_discoveries(self):
        cursor='1970-01-01T00:00:00+00:00'; after_id='00000000-0000-0000-0000-000000000000'; cutoff=datetime.now(timezone.utc).isoformat()
        while True:
            rows=self.rpc('scraper_selected_discoveries',{'p_cursor':cursor,'p_after_id':after_id,'p_cutoff':cutoff,'p_limit':100})
            if not rows: return
            cursor=rows[-1]['last_checked_at'] or '1970-01-01T00:00:00+00:00'; after_id=rows[-1]['id']
            for row in rows:
                yield row
            if len(rows)<100: return

    def monitor(self,id,candidate):
        return self.rpc('scraper_monitor_discovery',{'p_id':id,'p_candidate':candidate.to_payload()})

    def record_discovery_error(self,id,error):
        return self.rpc('scraper_record_discovery_error',{'p_id':id,'p_error':redact(error)})

    def begin_discovery_run(self,triggered_by,user_id,mode,request_id=None):
        return self.rpc('begin_discovery_crawl_run',{'p_triggered_by':triggered_by,'p_triggered_by_user':user_id,'p_mode':mode,'p_request_id':request_id})

    def finish_discovery_run(self,run_id,stats):
        from dataclasses import asdict
        payload=asdict(stats); payload['status']=stats.status; payload['errors']=[redact(e) for e in stats.errors]
        return self.rpc('finish_discovery_crawl_run',{'p_id':run_id,'p_stats':payload})


def prepare(record: ScrapedScholarship) -> ScrapedScholarship:
    """Stamp the identity hash and scrape time. Call before upsert or compare."""
    record.source_hash = identity_hash(record)
    record.scraped_at = datetime.now(timezone.utc)
    return record


def client_from_env(*, require_service_role: bool = True) -> SupabaseClient:
    """Build a client from environment variables only.

    A read-only dry run may fall back to the anon key: it is a public
    credential, RLS still applies to it, and it is enough to see which
    scholarships already exist. A WRITE requires the service-role key, supplied
    by GitHub Actions Secrets and never stored in the repository.
    """
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "")
    service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if require_service_role:
        if not service:
            raise ScraperDbError(
                "SUPABASE_SERVICE_ROLE_KEY is not set. Writing requires it. "
                "Use --dry-run to exercise the pipeline without it."
            )
        return SupabaseClient(url, service, service_role=True)

    anon = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY", "")
    return SupabaseClient(url, service or anon, service_role=bool(service))
