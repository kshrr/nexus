from pathlib import Path
import pytest
from scraper.public_http import FetchedDocument
from scraper.course_adapter import ProgrammeReference, SourceFailure

ROOT = Path('scraper/tests/fixtures/courses')
BASE = 'https://sunwaycollege.edu.my/programmes/'
ACCOUNTING = BASE + 'diploma-studies/business-accounting-finance/diploma-in-accounting'
MUFY = BASE + 'pre-university-foundation/monash-university-foundation-year'
MUSIC = BASE + 'diploma-studies/communication-creative-arts/diploma-in-music'


def page(url, kind='html'):
    if kind == 'xml':
        return FetchedDocument((ROOT / 'sunway-college-sitemap.xml').read_text(encoding='utf-8'), url, 'application/xml')
    fixture = {ACCOUNTING: 'sunway-college-diploma-accounting.html', MUFY: 'sunway-college-mufy.html',
               MUSIC: 'sunway-college-placeholder.html'}.get(url, 'sunway-college-diploma-accounting.html')
    return FetchedDocument((ROOT / fixture).read_text(encoding='utf-8'), url)


def parse(url, level):
    from scraper.parsers.sunway_college import SunwayCollegeCourseAdapter
    slug = url.rsplit('/', 1)[-1]
    return SunwayCollegeCourseAdapter().parse(ProgrammeReference(f'{level}:{slug}', url, level, {}), page)


def test_sunway_college_discovery_keeps_diplomas_and_foundations_and_skips_placeholders():
    from scraper.parsers.sunway_college import SunwayCollegeCourseAdapter
    events = list(SunwayCollegeCourseAdapter().discover(page))
    assert not [e for e in events if isinstance(e, SourceFailure)]
    urls = {e.source_url for e in events}
    assert MUSIC not in urls  # an empty placeholder page (programme moved to Sunway University)
    assert ACCOUNTING in urls and MUFY in urls
    levels = [e.pathway_type for e in events]
    assert levels.count('foundation') == 3 and levels.count('diploma') == 19
    for excluded in ('cambridge-gce-advanced-level', 'australian-matriculation', 'acca', 'news-events'):
        assert not any(excluded in u for u in urls)


def test_sunway_college_routes_and_mixed_specific_requirements():
    result = parse(ACCOUNTING, 'diploma')
    record = result.record
    assert result.issues == []
    assert record['name'] == 'Diploma in Accounting' and record['duration_months'] == 24
    routes = {s['route']: s for s in record['entry_requirement_sections']}
    assert routes['SPM / O-Level']['text'] == 'Pass with min. 3 credits (including Mathematics and a pass in English)'
    assert routes['LCCI Level 3 Diploma']['text'] == 'Pass'
    assert 'Pre-existing qualification' not in routes
    specific = routes['Specific Requirements']
    # Mixes an international-only English rule with a local Mathematics note: kept Local, verbatim.
    assert specific['applicant_category'] == 'Local'
    assert 'For International Students only' in specific['text'] and 'reinforcement Mathematics' in specific['text']


def test_sunway_college_mufy_is_held_for_its_field_only():
    result = parse(MUFY, 'foundation')
    record = result.record
    assert record['name'] == 'Monash University Foundation Year (MUFY)'
    assert record['duration_months'] == 12  # "12 months"
    assert result.issues == ['unmapped_field']  # multi-stream foundation: an admin chooses the field
    english = next(s for s in record['entry_requirement_sections'] if s['route'].startswith('English'))
    assert english['applicant_category'] == 'Local'  # "for students without a credit in English", not international-only


@pytest.mark.parametrize('text,months', [('2 Years', 24), ('2.5 Years', 30), ('12 months', 12), ('', None), (None, None)])
def test_sunway_college_duration(text, months):
    from scraper.parsers.sunway_college import duration_months_from
    assert duration_months_from(text) == months


@pytest.mark.parametrize('name,field', [
    ('Sunway Foundation In Arts (FIA)', 'Arts and Social Sciences'),
    ('Diploma in Digital Creative Content', 'Communication and Media'),
])
def test_sunway_college_field_mapping(name, field):
    from scraper.parsers.course_common import field_for_name
    assert field_for_name(name) == field
