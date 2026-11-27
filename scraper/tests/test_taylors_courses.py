from pathlib import Path
import pytest
from scraper.public_http import FetchedDocument
from scraper.course_adapter import ProgrammeReference, SourceFailure

ROOT = Path('scraper/tests/fixtures/courses')
BASE = 'https://university.taylors.edu.my/en/study/explore-all-programmes/'


def parse(path, level, fixture):
    from scraper.parsers.taylors import TaylorsCourseAdapter
    slug = path.rsplit('/', 1)[-1].removesuffix('.html')
    reference = ProgrammeReference(f'{level}:{slug}', BASE + path, level, {})
    return TaylorsCourseAdapter().parse(reference, lambda url, kind='html': FetchedDocument(
        (ROOT / fixture).read_text(encoding='utf-8'), url))


def test_taylors_sitemap_keeps_undergraduate_bachelors_and_diplomas_only():
    from scraper.parsers.taylors import TaylorsCourseAdapter
    seen = []
    def fetch(url, kind='html'):
        seen.append(kind)
        return FetchedDocument((ROOT / 'taylors-sitemap.xml').read_text(encoding='utf-8'), url, 'application/xml')
    events = list(TaylorsCourseAdapter().discover(fetch))
    assert seen == ['xml']
    assert not [e for e in events if isinstance(e, SourceFailure)]
    levels = [e.pathway_type for e in events]
    assert (levels.count('degree'), levels.count('diploma')) == (46, 2)
    urls = ' '.join(e.source_url for e in events)
    for excluded in ('master-', 'phd-', 'advanced-diploma', 'american-degree-transfer', 'intensive-english', 'university-transfers'):
        assert excluded not in urls


def test_taylors_each_entry_pathway_is_its_own_route():
    result = parse('computer-science/undergraduate/bachelor-of-computer-science.html', 'degree', 'taylors-computer-science.html')
    record = result.record
    assert result.issues == []
    assert record['name'] == 'Bachelor of Computer Science (Honours)'
    assert record['field_of_study'] == 'Computer Science'
    assert record['duration_months'] == 36  # "3-year"
    assert result.evidence['faculty'] == 'School of Computer Science'
    routes = {s['route']: s for s in record['entry_requirement_sections']}
    assert routes['A Level']['text'] == 'Pass with min. DD'
    assert routes['AUSMAT (SACEi)']['text'] == 'Min. ATAR 55'
    assert 'Mathematics subject and ONE (1) Science / ICT subject' in routes['Sijil Tinggi Persekolahan Malaysia (STPM)']['text']
    assert routes['A Level']['heading'] == 'Entry Pathway'
    assert routes['SPM/O-Level with Diploma']['heading'] == 'Prerequisites'
    assert 'Software Engineer' in record['career_prospects']


def test_taylors_english_requirements_are_split_by_audience():
    result = parse('computer-science/undergraduate/bachelor-of-computer-science.html', 'degree', 'taylors-computer-science.html')
    english = [s for s in result.record['entry_requirement_sections'] if s['route'] == 'English requirements']
    assert [s['applicant_category'] for s in english] == ['Local', 'International']
    assert 'MUET/IELTS/TOEFL/UEC English:' in english[0]['text'] and 'Pass English' in english[0]['text']
    assert 'IELTS 5.0' in english[1]['text']
    assert not any('IELTS 5.0' in s['text'] for s in result.record['entry_requirement_sections'] if s['applicant_category'] == 'Local')


def test_taylors_mbbs_and_diploma():
    mbbs = parse('medicine/undergraduate/bachelor-of-medicine-bachelor-of-surgery.html', 'degree', 'taylors-mbbs.html')
    assert mbbs.issues == []
    assert mbbs.record['name'] == 'Bachelor of Medicine, Bachelor of Surgery (MBBS)'
    assert mbbs.record['field_of_study'] == 'Medicine' and mbbs.record['duration_months'] == 60
    assert any(s['heading'] == 'Health Requirements' for s in mbbs.record['entry_requirement_sections'])
    hotel = parse('taylors-culinary-institute/undergraduate/diploma-in-hotel-management.html', 'diploma', 'taylors-diploma-hotel.html')
    assert hotel.issues == []
    assert hotel.record['pathway_type'] == 'diploma' and hotel.record['duration_months'] == 24
    assert hotel.record['field_of_study'] == 'Business and Economics'


@pytest.mark.parametrize('text,months', [
    ('3-year', 36), ('3 years', 36), ('3.5-year', 42), ('5-year', 60), ('3-month', None), (None, None),
])
def test_taylors_duration(text, months):
    from scraper.parsers.taylors import duration_months_from
    assert duration_months_from(text) == months


@pytest.mark.parametrize('name,field', [
    ('Bachelor of Social Science (Honours) in International Relations', 'Arts and Social Sciences'),
    ('Bachelor of Mass Communication (Honours) in Advertising and Brand Management', 'Communication and Media'),
    ('Bachelor of Actuarial Studies (Honours)', 'Business and Economics'),
    ('Bachelor of Performing Arts (Honours)', 'Creative Arts'),
    ('Diploma in Culinary Arts', 'Creative Arts'),
])
def test_taylors_field_mapping(name, field):
    from scraper.parsers.course_common import field_for_name
    assert field_for_name(name) == field


COLLEGE = 'https://college.taylors.edu.my/en/study/explore-all-programmes/'


def college_parse(path, level, fixture):
    from scraper.parsers.taylors import TaylorsCollegeCourseAdapter
    slug = path.rsplit('/', 1)[-1].removesuffix('.html')
    reference = ProgrammeReference(f'{level}:{slug}', COLLEGE + path, level, {})
    return TaylorsCollegeCourseAdapter().parse(reference, lambda url, kind='html': FetchedDocument(
        (ROOT / fixture).read_text(encoding='utf-8'), url))


def test_taylors_college_sitemap_keeps_foundations_and_diplomas():
    from scraper.parsers.taylors import TaylorsCollegeCourseAdapter
    events = list(TaylorsCollegeCourseAdapter().discover(lambda url, kind='html': FetchedDocument(
        (ROOT / 'taylors-college-sitemap.xml').read_text(encoding='utf-8'), url, 'application/xml')))
    assert not [e for e in events if isinstance(e, SourceFailure)]
    levels = [e.pathway_type for e in events]
    assert (levels.count('foundation'), levels.count('diploma')) == (7, 7)
    urls = ' '.join(e.source_url for e in events)
    for excluded in ('cambridge-a-level', 'australian-matriculation', 'acca', 'start-it-right', 'staff-directory'):
        assert excluded not in urls


def test_taylors_college_foundation_qualifications():
    result = college_parse('school-of-pre-university-studies/foundation/foundation-in-science.html', 'foundation',
                           'taylors-college-foundation-science.html')
    record = result.record
    assert result.issues == []
    assert record['name'] == 'Foundation in Science' and record['pathway_type'] == 'foundation'
    assert record['field_of_study'] == 'Science' and record['duration_months'] == 12
    routes = {s['route']: s for s in record['entry_requirement_sections']}
    spm = routes['SIJIL PELAJARAN MALAYSIA (SPM)']
    assert spm['text'] == 'Pass with minimum of 5 credits including Mathematics and 2 Science subjects'
    assert spm['heading'] == 'Qualifications'
    assert 'Overall Band 4.0' in routes['English requirements']['text']
    assert {s['applicant_category'] for s in record['entry_requirement_sections']} == {'Local'}


def test_taylors_college_and_or_condition_is_not_a_route():
    result = college_parse('school-of-diploma-studies/diploma/diploma-in-interior-design.html', 'diploma',
                           'taylors-college-diploma-interior.html')
    assert result.issues == []
    assert result.record['duration_months'] == 30  # "2.5 years"
    routes = [s['route'] for s in result.record['entry_requirement_sections']]
    assert not any(r.startswith(('AND', 'OR')) for r in routes)
    assert any('interview' in s['text'].lower() for s in result.record['entry_requirement_sections'])


@pytest.mark.parametrize('name,field', [
    ('Foundation in Arts', 'Arts and Social Sciences'),
    ('Foundation in Natural and Built Environments', 'Built Environment'),
])
def test_taylors_college_field_mapping(name, field):
    from scraper.parsers.course_common import field_for_name
    assert field_for_name(name) == field
