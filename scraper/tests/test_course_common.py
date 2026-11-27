from pathlib import Path
from scraper.public_http import FetchedDocument


def test_um_foundation_preserves_spm_routes_and_broad_field():
    from scraper.course_adapter import ProgrammeReference
    from scraper.parsers.um import UMCourseAdapter
    url='https://study.um.edu.my/foundation-in-social-sciences'
    document=FetchedDocument(Path('scraper/tests/fixtures/courses/um-foundation-detail.html').read_text(encoding='utf-8'),url)
    ref=ProgrammeReference('foundation:foundation-in-social-sciences',url,'foundation',{})
    result=UMCourseAdapter().parse(ref,lambda address:document)
    assert result.record['pathway_type']=='foundation'
    assert result.record['field_of_study']=='Arts and Social Sciences'
    assert result.record['duration_months']==12
    assert any('SPM' in s['route'] and 'Mathematics' in s['text'] for s in result.record['entry_requirement_sections'])
    assert result.record['required_subject_codes']==[]
    assert result.issues==[]


def test_session_conflicts_and_old_evidence_prevent_publication():
    from scraper.parsers.course_common import session_issues
    assert session_issues(['2024/2025'],'2026/2027')==['historical_source_session']
    assert 'conflicting_source_session' in session_issues(['2026/2027','2025/2026'],'2026/2027')
    assert session_issues([],'2026/2027')==[]


def test_um_discovers_diplomas_without_advanced_diploma():
    from scraper.parsers.um import UMCourseAdapter
    root=Path('scraper/tests/fixtures/courses')
    urls={'diploma-faculty-centre':'um-diploma-index','dip-faculty-of-medicine':'um-dip-medicine','dip-faculty-of-nursing':'um-dip-nursing','universiti-malaya-centre-for-continuing-education':'um-dip-centre'}
    def fetch(url):
        name=urls[url.rsplit('/',1)[1]]
        return FetchedDocument((root/(name+'.html')).read_text(encoding='utf-8'),url)
    references=list(UMCourseAdapter(levels=('diploma',)).discover(fetch))
    assert len(references)==7
    assert all(r.pathway_type=='diploma' for r in references)
    assert not any('advanced' in r.source_url or 'executive' in r.source_url for r in references)


def test_um_diploma_retains_local_requirements_and_flags_empty_advertised_route():
    from scraper.parsers.um import UMCourseAdapter
    from scraper.course_adapter import ProgrammeReference
    url='https://study.um.edu.my/diploma-in-radiography'
    document=FetchedDocument(Path('scraper/tests/fixtures/courses/um-diploma-detail.html').read_text(encoding='utf-8'),url)
    candidate=UMCourseAdapter().parse(ProgrammeReference('diploma:diploma-in-radiography',url,'diploma',{}),lambda address:document)
    assert candidate.record['pathway_type']=='diploma'
    assert candidate.record['duration_months']==36
    assert 'Physics' in candidate.record['entry_requirements']
    assert 'empty_requirement_section' in candidate.issues
