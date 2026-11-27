from dataclasses import replace
from pathlib import Path
from scraper.public_http import FetchedDocument, FetchError
from scraper.tests.test_um_courses import document, computing, HOST

class FakeFetcher:
    def __init__(self, pages): self.pages=pages; self.requested=[]
    def get_document(self,url):
        self.requested.append(url)
        item=self.pages[url]
        if isinstance(item,Exception): raise item
        return item

class FakeDb:
    def __init__(self): self.calls=[]
    def ingest(self,candidate):
        self.calls.append(candidate)
        return {'outcome':'incomplete' if candidate.issues else 'fetch_failed' if candidate.error else 'inserted'}

def pages():
    return {
        HOST+'undergraduate-faculties': FetchedDocument('<a href="faculty-of-computer-science">Computing</a>',HOST+'undergraduate-faculties','text/html'),
        HOST+'faculty-of-computer-science': FetchedDocument('<a href="bachelor-of-computer-science-information-system">Degree</a><a href="bachelor-of-computer-science-information-system#x">Same</a><a href="bachelor-of-failed">Another</a>',HOST+'faculty-of-computer-science','text/html'),
        HOST+'bachelor-of-computer-science-information-system':computing(),
        HOST+'bachelor-of-failed':FetchError('HTTP 500'),
    }

def execute(fetcher,db,dry_run=False,**limits):
    from scraper.courses import run_course_source
    from scraper.parsers.um import UMCourseAdapter
    return run_course_source(UMCourseAdapter(levels=('degree',)),fetcher,db,dry_run=dry_run,**limits)

def test_all_degrees_attempted_once_with_partial_failure_preserving_other_records():
    fetcher=FakeFetcher(pages()); db=FakeDb()
    result=execute(fetcher,db)
    assert result.found==2
    assert result.fetched==1
    assert result.inserted==1
    assert result.fetch_failed==1
    assert result.coverage_complete is False
    assert result.status=='partial'
    assert len(fetcher.requested)==4
    assert len(db.calls)==2
    assert db.calls[-1].error=='HTTP 500'

def test_dry_run_never_calls_database():
    db=FakeDb()
    result=execute(FakeFetcher(pages()),db,dry_run=True)
    assert result.found==2
    assert result.inserted==0
    assert db.calls==[]


def test_shared_unavailable_pdf_is_fetched_once_per_run():
    from scraper.course_adapter import ProgrammeReference
    from scraper.course_models import CourseCandidate
    from scraper.courses import run_course_source
    pdf='https://www.utem.edu.my/en/downloads/entry-requirements.pdf'
    class Adapter:
        source='utem'
        canonical_url=staticmethod(lambda url:url)
        def discover(self,fetch):
            for number in (1,2):
                yield ProgrammeReference(f'degree:{number}',f'https://www.utem.edu.my/en/programme-{number}.html','degree',{})
        def parse(self,ref,fetch):
            fetch(ref.source_url)
            try:fetch(pdf,'pdf')
            except FetchError:
                return CourseCandidate(self.source,ref.programme_key,ref.source_url,record={'name':ref.programme_key},issues=['unavailable_requirement_document'])
            raise AssertionError('The shared PDF must remain unavailable')
    class Fetcher:
        def __init__(self):self.pdf_requests=[]
        def get_document(self,url):return FetchedDocument('<h1>Programme</h1>',url)
        def get_pdf_document(self,url):
            self.pdf_requests.append(url)
            raise FetchError('HTTP 404')
    fetcher=Fetcher()
    result=run_course_source(Adapter(),fetcher,None,dry_run=True,max_pages=10,work_seconds=30)
    assert (result.found,result.fetched,result.incomplete,result.fetch_failed)==(2,2,2,0)
    assert fetcher.pdf_requests==[pdf]

def test_failed_faculty_and_page_budget_are_reported_as_incomplete_coverage():
    records=pages();records[HOST+'faculty-of-computer-science']=FetchError('Unavailable')
    result=execute(FakeFetcher(records),FakeDb())
    assert result.coverage_complete is False
    assert result.status=='failed'
    fetcher=FakeFetcher(pages())
    result=execute(fetcher,FakeDb(),max_pages=2)
    assert len(fetcher.requested)==2
    assert result.found==2
    assert result.coverage_complete is False
    assert any('budget' in error.lower() for error in result.errors)

def test_redirect_outside_registered_source_cannot_publish():
    records=pages(); records[HOST+'bachelor-of-computer-science-information-system']=replace(computing(),final_url='https://example.org/bachelor-other')
    db=FakeDb();result=execute(FakeFetcher(records),db)
    assert result.inserted==0
    assert all(candidate.error or candidate.issues for candidate in db.calls)

def test_zero_time_budget_makes_no_requests():
    fetcher=FakeFetcher(pages());result=execute(fetcher,FakeDb(),work_seconds=0)
    assert fetcher.requested==[]
    assert result.coverage_complete is False

def test_budget_during_faculty_traversal_keeps_already_discovered_count():
    records=pages()
    records[HOST+'undergraduate-faculties']=FetchedDocument('<a href="faculty-of-computer-science">Computing</a><a href="faculty-of-pharmacy">Pharmacy</a>',HOST+'undergraduate-faculties','text/html')
    result=execute(FakeFetcher(records),FakeDb(),max_pages=2)
    assert result.found==2
    assert result.coverage_complete is False

def test_same_origin_non_catalogue_redirect_is_a_failure_for_original_identity_and_continues():
    records = pages()
    records[HOST+'bachelor-of-computer-science-information-system'] = replace(computing(), final_url=HOST+'login')
    records[HOST+'bachelor-of-failed'] = replace(computing(), final_url=HOST+'bachelor-of-failed')
    db = FakeDb()
    result = execute(FakeFetcher(records), db)
    assert result.fetch_failed == 1
    assert result.inserted == 1
    assert len(db.calls) == 2
    assert db.calls[0].programme_key == 'bachelor-of-computer-science-information-system'
    assert db.calls[0].error
    assert result.coverage_complete is False

def test_empty_local_applicant_tab_is_not_sent_for_publication():
    from bs4 import BeautifulSoup
    doc = computing()
    soup = BeautifulSoup(doc.html, 'html.parser')
    soup.select_one('#info1').clear()
    records = pages()
    records[HOST+'bachelor-of-computer-science-information-system'] = replace(doc, html=str(soup))
    db = FakeDb()
    result = execute(FakeFetcher(records), db)
    assert result.incomplete == 1
    assert db.calls[0].issues == ['empty_requirement_section']
