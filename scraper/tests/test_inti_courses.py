from pathlib import Path
import pytest
from scraper.public_http import FetchedDocument
from scraper.course_adapter import ProgrammeReference, SourceFailure

ROOT = Path('scraper/tests/fixtures/courses')
BASE = 'https://newinti.edu.my/programme/'


def parse(slug, level, fixture):
    from scraper.parsers.inti import INTICourseAdapter
    reference = ProgrammeReference(f'{level}:{slug}', BASE + slug, level, {})
    return INTICourseAdapter().parse(reference, lambda url, kind='html': FetchedDocument(
        (ROOT / fixture).read_text(encoding='utf-8'), url))


def test_inti_sitemap_keeps_foundation_diploma_and_bachelor_pages():
    from scraper.parsers.inti import INTICourseAdapter
    seen = []
    def fetch(url, kind='html'):
        seen.append(kind)
        return FetchedDocument((ROOT / 'inti-programmes-sitemap.xml').read_text(encoding='utf-8'), url, 'application/xml')
    events = list(INTICourseAdapter().discover(fetch))
    assert seen == ['xml']
    assert not [e for e in events if isinstance(e, SourceFailure)]
    levels = [e.pathway_type for e in events]
    assert (levels.count('foundation'), levels.count('diploma'), levels.count('degree')) == (5, 26, 46)
    assert 'foundation:foundationinbusiness2' in {e.programme_key for e in events}
    urls = ' '.join(e.source_url for e in events)
    for excluded in ('master-', 'cambridge-a-level', 'american-university', 'ielts', 'ba-hons-', 'micro-credential'):
        assert excluded not in urls


def test_inti_foundation_pathways_keep_their_own_routes():
    result = parse('foundation-in-science', 'foundation', 'inti-foundation-science.html')
    record = result.record
    assert result.issues == []
    assert record['name'] == 'Foundation in Science' and record['duration_months'] == 12
    engineering = [s for s in record['entry_requirement_sections'] if s['heading'] == 'Engineering Pathway']
    assert [(s['route'], s['text']) for s in engineering[:2]] == [
        ('SPM / O Level / Equivalent', '5 credits including Mathematics and Physics'),
        ('UEC / Equivalent', '3Bs including Mathematics and Physics')]
    bio = [s for s in record['entry_requirement_sections'] if s['heading'].startswith('Biological Science')]
    assert bio[0]['route'] == 'SPM / O Level / Equivalent'  # leading "*" footnote marker removed
    assert any(s['route'] == 'Notes' and 'Quantity Surveying' in s['text'] for s in engineering)
    assert 'INTI International College Subang' in result.evidence['campuses']


def test_inti_diploma_english_requirements_are_one_section():
    result = parse('diploma-in-computer-science', 'diploma', 'inti-diploma-computer-science.html')
    record = result.record
    assert result.issues == []
    assert record['duration_months'] == 24  # "Programme can be completed in Minimum 2 Years."
    routes = [s['route'] for s in record['entry_requirement_sections']]
    assert routes[:3] == ['SPM / O-Level / Equivalent', 'UEC', 'Certificate']
    english = next(s for s in record['entry_requirement_sections'] if s['route'] == 'English requirements')
    assert 'IELTS: Band 4.0' in english['text'] and 'MUET: Band 3' in english['text']
    assert 'IELTS' not in routes


def test_inti_repeated_header_rows_are_not_routes():
    result = parse('bachelor-of-computer-science-30-in-collaboration-with-swinburne-university-of-technology-australia',
                   'degree', 'inti-bachelor-computer-science-swinburne.html')
    assert result.issues == []
    assert result.record['field_of_study'] == 'Computer Science'
    routes = [s['route'] for s in result.record['entry_requirement_sections']]
    assert 'Entry Level' not in routes and 'INTI Foundation' in routes


@pytest.mark.parametrize('text,months', [
    ('Programme can be completed in Minimum 2 Years.', 24),
    ('Programme can be completed in 1 Year.', 12),
    ('Programme can be completed in 2 Years 6 Months.', 30),
    ('Programme can be completed in 3 Years. ... Programme can be completed in 4 Years.', None),
    ('Full-time: 2 Years 6 Months', None),
])
def test_inti_duration(text, months):
    from scraper.parsers.inti import duration_months_from
    assert duration_months_from(text) == months


@pytest.mark.parametrize('name,field', [
    ('Diploma In Financial Informatics', 'Computer Science'),
    ('Bachelor in Music Production and Audio Technology (Honours)', 'Creative Arts'),
    ('Diploma in Electric Vehicles Technology', 'Engineering'),
    ('Bachelor of Information and Communication Technology 3+0', 'Computer Science'),
    ('Bachelor of Technology in Digital Construction Management', 'Built Environment'),
])
def test_inti_field_mapping(name, field):
    from scraper.parsers.course_common import field_for_name
    assert field_for_name(name) == field
