from scraper.tests.test_um_courses import adapter, computing, HOST

def test_course_rpc_payload_uses_validated_identity_and_evidence():
    from scraper.course_db import CourseDb
    class Client:
        def rpc(self,name,payload):
            assert name=='ingest_course_source'
            assert payload['p_source']=='um'
            assert payload['p_programme_key']=='bachelor-of-computer-science-information-system'
            assert payload['p_run_id']=='run-1'
            assert payload['p_record']['duration_months']==42
            assert payload['p_evidence']['faculty_url']==HOST+'faculty-of-computer-science'
            return {'outcome':'inserted','course_id':'course-1'}
    candidate=adapter().parse(computing(),HOST+'faculty-of-computer-science')
    db=CourseDb(Client(),run_id='run-1')
    assert db.ingest(candidate)=={'outcome':'inserted','course_id':'course-1'}


def test_course_ingest_retries_once_on_a_dropped_database_connection():
    import pytest
    from scraper.course_db import CourseDb
    from scraper.db import ScraperDbError
    from scraper.course_models import CourseCandidate
    class Session:
        closed = 0
        def close(self): Session.closed += 1
    class Client:
        def __init__(self, errors):
            self.errors = list(errors); self.calls = 0; self._session = Session()
        def rpc(self, name, payload):
            self.calls += 1
            if self.errors: raise ScraperDbError(self.errors.pop(0))
            return {'outcome': 'inserted'}
    candidate = CourseCandidate('unisza', 'degree:x', 'https://www.unisza.edu.my/our-faculties/bachelor-x', {})
    dropped = "POST /rpc/ingest_course_source failed: ('Connection aborted.', BrokenPipeError(32, 'Broken pipe'))"
    client = Client([dropped])
    assert CourseDb(client, 'run').ingest(candidate) == {'outcome': 'inserted'}
    assert client.calls == 2 and Session.closed == 1
    rejected = Client(['POST /rpc/ingest_course_source -> HTTP 400: INVALID_SOURCE'])
    with pytest.raises(ScraperDbError):
        CourseDb(rejected, 'run').ingest(candidate)
    assert rejected.calls == 1
