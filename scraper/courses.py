"""Automatic registered-university catalogue sync, independent of scholarships."""
import argparse
import json
import sys
import time
import uuid
from .course_models import CourseCandidate, CourseRunSummary
from .course_db import CourseDb
from .db import client_from_env, redact
from .course_fetch import CourseFetcher as Fetcher
from .course_sources import SOURCES, get_adapter
from .public_http import FetchError

COURSE_USER_AGENT='NexusCourseBot/1.0 (university programme indexing; final-year project; contact via project repository)'

# 26 minutes: slow sites (UniSZA ~20 s/page from GitHub runners) need more than 20,
# and the database lease on a running crawl expires at 30 minutes.
def run_course_source(adapter,fetcher,db,*,dry_run,max_pages=400,work_seconds=1560,summary=None,preview=None):
    from .course_adapter import ProgrammeReference, SourceFailure, BudgetExceeded
    stats=summary if summary is not None else CourseRunSummary()
    deadline=time.monotonic()+work_seconds
    if hasattr(fetcher,'deadline'): fetcher.deadline=deadline
    requested=set();cache={};failed_pdfs={};programmes={}
    def level_counts(level):
        return stats.pathway_counts.setdefault(level,dict(found=0,fetched=0,valid=0,incomplete=0,fetch_failed=0))
    def fetch(url,kind='html'):
        url=adapter.canonical_url(url)
        cache_key=(url,kind)
        if cache_key in cache: return cache[cache_key]
        if cache_key in failed_pdfs: raise FetchError(failed_pdfs[cache_key])
        if hasattr(fetcher,'on_redirect'): fetcher.on_redirect=adapter.canonical_url
        if len(requested)>=max_pages or time.monotonic()>=deadline: raise BudgetExceeded('Course crawl page/time budget exhausted')
        requested.add(cache_key)
        try:
            if kind=='pdf': result=fetcher.get_pdf_document(url)
            elif kind=='xml': result=fetcher.get_xml_document(url)
            else: result=fetcher.get_document(url)
        except FetchError as error:
            # Shared matrices may be linked from dozens of programmes. Retry on
            # the next crawl, not once per programme in the same bounded run.
            if kind=='pdf':failed_pdfs[cache_key]=str(error)
            raise
        adapter.canonical_url(result.final_url)
        cache[cache_key]=result
        return result
    def failure(url,error):
        stats.coverage_complete=False
        stats.fetch_failed+=1
        stats.errors.append(redact(f'{url}: {error}')[:2000])
        stats.coverage_issues.append(redact(f'{url}: {error}')[:2000])
    try:
        for event in adapter.discover(fetch):
            if isinstance(event,SourceFailure): failure(event.url,event.error)
            elif isinstance(event,ProgrammeReference) and event.programme_key not in programmes:
                programmes[event.programme_key]=event
                stats.found=len(programmes)
                level_counts(event.pathway_type)['found']+=1
        for reference in programmes.values():
            counts=level_counts(reference.pathway_type)
            fetch_error=None
            try:
                candidate=adapter.parse(reference,fetch)
                stats.fetched+=1
                counts['fetched']+=1
            except BudgetExceeded: raise
            except Exception as error:
                fetch_error=error
                candidate=CourseCandidate(adapter.source,reference.programme_key,reference.source_url,error=redact(str(error)))
            valid=not candidate.error and not candidate.issues
            if valid:stats.valid+=1;counts['valid']+=1
            if candidate.issues:counts['incomplete']+=1
            if preview is not None: preview.append(candidate.to_payload())
            if dry_run:
                if fetch_error is not None:
                    failure(reference.source_url,fetch_error);counts['fetch_failed']+=1
                if candidate.issues: stats.incomplete+=1
            else:
                response=db.ingest(candidate)
                outcome=response.get('outcome')
                if outcome in ('inserted','updated','unchanged','protected_manual','incomplete'):
                    setattr(stats,outcome,getattr(stats,outcome)+1)
                elif outcome=='fetch_failed' and response.get('course_id'):
                    # Already published: the course stays as it is and the next run
                    # re-checks it. Not a coverage gap, so not reported as a failure.
                    stats.unchanged+=1;stats.kept_unchecked+=1
                elif outcome=='fetch_failed':
                    failure(reference.source_url,fetch_error or candidate.error);counts['fetch_failed']+=1
                else: raise ValueError('Unexpected course ingestion outcome')
        if stats.kept_unchecked:
            stats.errors.append(f'{stats.kept_unchecked} published course(s) kept as they are: their pages could not be '
                                're-checked this run and are retried on the next run.')
    except BudgetExceeded as error:
        stats.coverage_complete=False
        stats.errors.append(str(error))
    except Exception:
        stats.coverage_complete=False
        raise
    return stats

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',choices=list(SOURCES),default='um')
    parser.add_argument('--dry-run',action='store_true',help='Public source extraction only; no database or run-log writes')
    parser.add_argument('--output',help='Optional local JSON preview file')
    parser.add_argument('--triggered-by',choices=['manual','schedule'],default='manual')
    parser.add_argument('--triggered-by-user')
    parser.add_argument('--request-id')
    args=parser.parse_args(argv)
    if args.request_id:
        try: uuid.UUID(args.request_id)
        except ValueError: parser.error('request-id must be a UUID')
    if args.triggered_by_user:
        try: uuid.UUID(args.triggered_by_user)
        except ValueError: parser.error('triggered-by-user must be a UUID')
    db=None;stats=CourseRunSummary();preview=[];exit_code=0
    try:
        if not args.dry_run:
            db=CourseDb(client_from_env(require_service_role=True))
            if db.begin(args.source,args.triggered_by,args.triggered_by_user,args.request_id) is None:
                print('A course run is already active or this request has already run.'); return 3
        adapter=get_adapter(args.source)
        fetcher=Fetcher(user_agent=COURSE_USER_AGENT)
        # Some sources throttle rapid requests from overseas runners; they ask for a longer gap.
        crawl_delay=getattr(adapter,'crawl_delay',0)
        if crawl_delay and hasattr(fetcher,'delay'): fetcher.delay=max(fetcher.delay,crawl_delay)
        run_course_source(adapter,fetcher,db,dry_run=args.dry_run,summary=stats,preview=preview)
        if stats.status!='completed': exit_code=1
    except KeyboardInterrupt:
        stats.coverage_complete=False;stats.errors.append('Course crawl interrupted');exit_code=130
    except Exception as error:
        stats.coverage_complete=False;stats.errors.append(redact(str(error)));exit_code=1
    finally:
        if db is not None and db.run_id:
            try: db.finish(stats)
            except Exception as error:
                stats.coverage_complete=False;stats.errors.append(redact(f'Could not finish course run: {error}'));exit_code=1
    report={'source':args.source,'dry_run':args.dry_run,'summary':stats.to_payload(),'valid_candidates':stats.valid}
    if args.output:
        from pathlib import Path
        Path(args.output).write_text(json.dumps({**report,'candidates':preview},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return exit_code

if __name__=='__main__': sys.exit(main())
