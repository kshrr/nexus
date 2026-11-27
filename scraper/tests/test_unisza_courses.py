from pathlib import Path
import pytest
from scraper.public_http import FetchedDocument
from scraper.course_adapter import ProgrammeReference

ROOT = Path('scraper/tests/fixtures/courses')
BASE = 'https://www.unisza.edu.my/our-faculties/'


def page(name):
    return lambda url, kind='html': FetchedDocument((ROOT / name).read_text(encoding='utf-8'), url)


def parse(slug, level, fixture):
    from scraper.parsers.unisza import UniSZACourseAdapter
    return UniSZACourseAdapter().parse(ProgrammeReference(f'{level}:{slug}', BASE + slug, level, {}), page(fixture))


def test_unisza_sitemap_discovery_keeps_undergraduate_levels_only():
    from scraper.parsers.unisza import UniSZACourseAdapter
    seen = []
    def fetch(url, kind='html'):
        seen.append(kind)
        return FetchedDocument((ROOT / 'unisza-sitemap.xml').read_text(encoding='utf-8'), url, 'application/xml')
    refs = list(UniSZACourseAdapter().discover(fetch))
    assert seen == ['xml']
    levels = [r.pathway_type for r in refs]
    assert levels.count('foundation') == 1
    assert levels.count('diploma') == 24
    assert levels.count('degree') == 39
    assert not any('master-' in r.source_url or 'doctor-' in r.source_url for r in refs)


def test_unisza_degree_routes_and_stated_duration():
    result = parse('bachelor-of-medicine-and-bachelor-of-surgery-mbbs', 'degree', 'unisza-mbbs.html')
    record = result.record
    assert result.issues == []
    assert record['name'] == 'Bachelor of Medicine and Bachelor of Surgery (MBBS)'
    assert record['field_of_study'] == 'Medicine'
    assert record['duration_months'] == 60  # "Duration of study: 5 years", not the 2-year housemanship
    routes = [s['route'] for s in record['entry_requirement_sections']]
    assert routes[0] == 'STPM'
    assert 'Matriculation / Fundamental Category' in routes
    stpm = record['entry_requirement_sections'][0]
    assert 'PNGK 3.60' in stpm['text'] and 'Pass the Interview.' in stpm['text']


def test_unisza_connectors_stay_in_text_and_international_is_labelled():
    result = parse('bachelor-of-medical-imaging-hons', 'degree', 'unisza-medical-imaging.html')
    sections = result.record['entry_requirement_sections']
    assert not any(s['heading'] in ('AND', 'OR', 'University Requirement') for s in sections)
    international = [s for s in sections if s['applicant_category'] == 'International']
    assert international and any('IELTS' in s['text'] for s in international)
    assert not any('IELTS' in s['text'] for s in sections if s['applicant_category'] == 'Local')
    assert 'ambiguous_requirement_categories' not in result.issues


def test_unisza_foundation_keeps_eligibility_wording_verbatim():
    result = parse('foundation-in-science-and-medicine', 'foundation', 'unisza-foundation.html')
    record = result.record
    assert result.issues == []
    assert record['pathway_type'] == 'foundation'
    assert record['duration_months'] == 12
    text = record['entry_requirement_sections'][0]['text']
    assert 'Open to Malay, Pribumi Sabah, Pribumi Sarawak and Orang Asli Semenanjung candidates only.' in text


def test_unisza_unlabelled_international_criteria_are_held_for_review():
    result = parse('bachelor-of-science-hons-aquatic-science', 'degree', 'unisza-aquatic-science.html')
    assert 'ambiguous_requirement_categories' in result.issues


@pytest.mark.parametrize('text,months', [
    ('Duration of study: 4 years', 48),
    ('Duration of study:\xa03½ years', 42),
    ('Duration of study:\xa0 3 and half year', 42),
    ('Duration of study: 1 year', 12),
    ('Duration of study: 4 years ... Duration of study: 3 years', None),
    ('The programme duration is three and a half year', None),
])
def test_unisza_duration_wording(text, months):
    from scraper.parsers.unisza import duration_months_from
    assert duration_months_from(text) == months


def test_unisza_route_label_keeps_acronyms():
    from scraper.parsers.unisza import tidy_label
    assert tidy_label('STPM CATEGORY') == 'STPM Category'
    assert tidy_label('MATRICULATION / FUNDAMENTAL CATEGORY') == 'Matriculation / Fundamental Category'
    assert tidy_label('DIPLOMA (Category E, F and G)') == 'DIPLOMA (Category E, F and G)'
