import json
import pytest
from scraper import courses


@pytest.mark.parametrize('source',['um','unisza','utem','mmu','utm','taylors','taylors_college','inti','umpsa','sunway_college'])
def test_each_source_dry_run_avoids_database_and_selects_its_adapter(source,monkeypatch,capsys):
    monkeypatch.setattr(courses,'client_from_env',lambda **kwargs:pytest.fail('No database credentials in dry-run'))
    def operation(adapter,fetcher,db,**kwargs):
        assert adapter.source==source
        assert db is None
        kwargs['summary'].found=1
    monkeypatch.setattr(courses,'run_course_source',operation)
    assert courses.main(['--source',source,'--dry-run'])==0
    assert json.loads(capsys.readouterr().out)['source']==source


def test_level_counts_do_not_count_failed_candidate_as_valid():
    from scraper.course_sources import get_adapter
    from scraper.public_http import FetchedDocument
    from scraper.tests.test_course_job import pages,FakeFetcher
    from scraper.courses import run_course_source
    from scraper.parsers.um import UMCourseAdapter
    result=run_course_source(UMCourseAdapter(levels=('degree',)),FakeFetcher(pages()),None,dry_run=True)
    assert result.pathway_counts['degree']['found']==2
    assert result.pathway_counts['degree']['valid']==1
    assert result.pathway_counts['degree']['fetch_failed']==1
