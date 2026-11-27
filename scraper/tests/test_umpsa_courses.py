from pathlib import Path
import pytest
from scraper.public_http import FetchedDocument
from scraper.course_adapter import ProgrammeReference, SourceFailure

ROOT = Path('scraper/tests/fixtures/courses')
BASE = 'https://admission.umpsa.edu.my/undergraduate-study/'


def parse(path, level, fixture):
    from scraper.parsers.umpsa import UMPSACourseAdapter
    reference = ProgrammeReference(f'{level}:{path}', BASE + path, level, {})
    return UMPSACourseAdapter().parse(reference, lambda url, kind='html': FetchedDocument(
        (ROOT / fixture).read_text(encoding='utf-8'), url))


def test_umpsa_index_lists_diplomas_and_degrees():
    from scraper.parsers.umpsa import UMPSACourseAdapter
    events = list(UMPSACourseAdapter().discover(lambda url, kind='html': FetchedDocument(
        (ROOT / 'umpsa-ug-programme.html').read_text(encoding='utf-8'), url)))
    assert not [e for e in events if isinstance(e, SourceFailure)]
    levels = [e.pathway_type for e in events]
    assert (levels.count('diploma'), levels.count('degree')) == (8, 42)
    keys = {e.programme_key for e in events}
    assert 'diploma:dipoma-computer-2/diploma-in-computer-science' in keys  # the site's own "dipoma" folder
    # Pages sharing a printed UPU code keep separate identities by path.
    assert len(keys) == 50
    assert {'degree:dual-degree/02-bachelor-of-engineering-dual-degree-in-mechatronic-engineering-programme-ump-hska-germany',
            'degree:engineering/06-b-eng-hons-mechatronics-engineering'} <= keys
    assert not any('/undergraduate/international' in e.source_url for e in events)


def test_umpsa_diploma_route_pop_up_and_facts():
    result = parse('diploma-engineering/diploma-in-civil-engineering', 'diploma', 'umpsa-diploma-civil.html')
    record = result.record
    assert result.issues == []
    assert record['name'] == 'Diploma in Civil Engineering'
    assert record['duration_months'] == 33  # "6 Semester ( 2 Year 9 Month )"
    assert result.evidence['upu_code'] == 'UJ4526001'
    assert result.evidence['faculty'] == 'Faculty of Civil Engineering Technology'
    assert result.evidence['campus'] == 'UMPSA Gambang Campus'
    [section] = record['entry_requirement_sections']
    assert section['route'] == 'SPM Holder'
    assert 'TIGA (3) KEPUJIAN (GRED C)' in section['text'] and 'Matematik' in section['text']


def test_umpsa_btech_routes_for_skills_diploma_holders():
    result = parse('technology/bvp', 'degree', 'umpsa-btech-facilities.html')
    assert result.issues == []
    assert result.record['duration_months'] == 42  # "( 3.5 Years )"
    routes = [s['route'] for s in result.record['entry_requirement_sections']]
    assert routes[0].startswith('Diploma Kemahiran Malaysia (DKM)')
    assert len(routes) == 3 and len(set(routes)) == 3


def test_umpsa_dual_degree_has_each_route_once():
    result = parse('dual-degree/bhe-dual-degree', 'degree', 'umpsa-dual-degree.html')
    assert result.issues == []
    assert result.record['duration_months'] == 54  # "( 4 Year 6 Months )"
    routes = [s['route'] for s in result.record['entry_requirement_sections']]
    assert routes[0] == 'STPM Holder'
    assert 'A LEVEL Holder' in routes and len(routes) == 5 and len(routes) == len(set(routes))


@pytest.mark.parametrize('text,months', [
    ('8 Semester ( 4 Year )', 48), ('7 Semester ( 3 1/2 Year )', 42), ('7 Semester ( 3.5 Years )', 42),
    ('6 Semester ( 2 Year 9 Month )', 33), ('5 Semester + 1 Short Semester ( 2 Years and 5 Months)', 29),
    ('9 Semester ( 4 Year 6 Months )', 54), ('8 Semester', None),
])
def test_umpsa_duration(text, months):
    from scraper.parsers.umpsa import duration_months_from
    assert duration_months_from(text) == months


@pytest.mark.parametrize('name,field', [
    ('Diploma in Occupational Safety And Health', 'Science'),
    ('Bachelor of Financial Technology with Honours', 'Business and Economics'),
    ('Bachelor of Technology in Building Construction with Honours', 'Built Environment'),
    ('Bachelor of Technology in Oil & Gas Facilities Maintenance with Honours', 'Engineering'),
])
def test_umpsa_field_mapping(name, field):
    from scraper.parsers.course_common import field_for_name
    assert field_for_name(name) == field
