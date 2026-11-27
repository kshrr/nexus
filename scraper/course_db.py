"""Course-only RPC adapter. Uses the existing server credential boundary."""
from scraper.db import redact, ScraperDbError


def dropped_connection(error):
    """A request that never got an HTTP answer (e.g. a pooled connection Supabase
    closed while a slow university page was being fetched), as opposed to an
    HTTP error the database actually returned."""
    message=str(error)
    return ' failed: ' in message and '-> HTTP' not in message

class CourseDb:
    def __init__(self, client, run_id=None):
        self.client=client
        self.run_id=run_id

    def begin(self,source,triggered_by,user=None,request_id=None):
        self.run_id=self.client.rpc('begin_course_crawl_run',{'p_source':source,'p_triggered_by':triggered_by,'p_user':user,'p_request_id':request_id})
        return self.run_id

    def _rpc(self,name,payload):
        """Retry once on a dropped connection with fresh connections. Ingest and
        finish are keyed by programme and run, so repeating one is harmless."""
        try:
            return self.client.rpc(name,payload)
        except ScraperDbError as error:
            if not dropped_connection(error): raise
            session=getattr(self.client,'_session',None)
            if session is not None: session.close()
            return self.client.rpc(name,payload)

    def ingest(self,candidate):
        return self._rpc('ingest_course_source',{
            'p_source':candidate.source,'p_programme_key':candidate.programme_key,'p_source_url':candidate.source_url,
            'p_record':candidate.record,'p_evidence':candidate.evidence,'p_issues':candidate.issues,
            'p_error':redact(candidate.error) if candidate.error else None,'p_run_id':self.run_id,
        })

    def finish(self,summary):
        payload=summary.to_payload()
        payload['errors']=[redact(error)[:2000] for error in payload['errors']][:250]
        self._rpc('finish_course_crawl_run',{'p_run_id':self.run_id,'p_summary':payload})
