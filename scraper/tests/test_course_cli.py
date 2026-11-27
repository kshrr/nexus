import json
import pytest
from scraper import courses


class FakeDb:
    def __init__(self, claim='run-1'):
        self.run_id = None
        self.claim = claim
        self.finished = []

    def begin(self, *args):
        self.run_id = self.claim
        return self.claim

    def finish(self, summary):
        self.finished.append(summary.to_payload())


def setup_live(monkeypatch, db, operation):
    monkeypatch.setattr(courses, 'client_from_env', lambda **kwargs: object())
    monkeypatch.setattr(courses, 'CourseDb', lambda client: db)
    monkeypatch.setattr(courses, 'Fetcher', lambda **kwargs: object())
    monkeypatch.setattr(courses, 'run_course_source', operation)


@pytest.mark.parametrize('failure,expected_code', [(RuntimeError('database unavailable'), 1), (KeyboardInterrupt(), 130)])
def test_claimed_run_is_finalized_after_failure_with_completed_counts(monkeypatch, capsys, failure, expected_code):
    db = FakeDb()

    def operation(*args, summary, **kwargs):
        summary.found = 8
        summary.fetched = 2
        summary.inserted = 1
        raise failure

    setup_live(monkeypatch, db, operation)
    assert courses.main([]) == expected_code
    report = json.loads(capsys.readouterr().out)
    assert len(db.finished) == 1
    assert db.finished[0]['status'] == 'partial'
    assert db.finished[0]['coverage_complete'] is False
    assert db.finished[0]['inserted'] == 1
    assert report['summary']['found'] == 8


def test_declined_claim_does_not_fetch_or_finish(monkeypatch, capsys):
    db = FakeDb(claim=None)
    def operation(*args, **kwargs):
        pytest.fail('An unclaimed job must not fetch')
    setup_live(monkeypatch, db, operation)
    assert courses.main([]) == 3
    assert db.finished == []
    assert 'already active' in capsys.readouterr().out


def test_dry_run_does_not_initialize_database_credentials(monkeypatch, capsys):
    monkeypatch.setattr(courses, 'client_from_env', lambda **kwargs: pytest.fail('No database in a dry run'))
    monkeypatch.setattr(courses, 'Fetcher', lambda **kwargs: object())
    def operation(*args, dry_run, db=None, **kwargs):
        assert args[2] is None
        assert dry_run
    monkeypatch.setattr(courses, 'run_course_source', operation)
    assert courses.main(['--dry-run']) == 0
    assert json.loads(capsys.readouterr().out)['dry_run'] is True


def test_terminal_error_is_redacted_in_output_and_run_summary(monkeypatch, capsys):
    db = FakeDb()
    secret = 'course-test-service-secret'
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', secret)
    def operation(*args, **kwargs):
        raise RuntimeError('Denied credential ' + secret)
    setup_live(monkeypatch, db, operation)
    assert courses.main([]) == 1
    output = capsys.readouterr().out
    assert secret not in output
    assert secret not in json.dumps(db.finished)
    assert '[redacted]' in output
