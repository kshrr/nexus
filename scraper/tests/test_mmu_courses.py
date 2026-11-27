from pathlib import Path
import pytest
from scraper.public_http import FetchedDocument
from scraper.course_adapter import ProgrammeReference, SourceFailure

ROOT = Path('scraper/tests/fixtures/courses')
FCI = 'https://www.mmu.edu.my/programmes-by-faculty-all/programmes-by-faculty-fci/'
ODL = 'https://www.mmu.edu.my/programmes-by-faculty-all/programmes-by-faculty-odl/'
NEW = 'https://www.mmu.edu.my/pogrammes-all/programmes-new/'


def page(name):
    return lambda url, kind='html': FetchedDocument((ROOT / name).read_text(encoding='utf-8'), url)


def parse(url, level, fixture):
    from scraper.parsers.mmu import MMUCourseAdapter
    slug = url.rstrip('/').rsplit('/', 1)[-1]
    return MMUCourseAdapter().parse(ProgrammeReference(f'{level}:{slug}', url, level, {}), page(fixture))


def test_mmu_sitemap_keeps_registered_undergraduate_pages_only():
    from scraper.parsers.mmu import MMUCourseAdapter
    seen = []
    def fetch(url, kind='html'):
        seen.append(kind)
        return FetchedDocument((ROOT / 'mmu-courses-sitemap.xml').read_text(encoding='utf-8'), url, 'text/xml')
    events = list(MMUCourseAdapter().discover(fetch))
    assert seen == ['xml']
    assert not [e for e in events if isinstance(e, SourceFailure)]
    levels = [e.pathway_type for e in events]
    assert len(events) == 57
    assert (levels.count('foundation'), levels.count('diploma'), levels.count('degree')) == (8, 14, 35)
    urls = [e.source_url for e in events]
    assert not any(word in u for u in urls for word in ('master-', 'doctor-', '%academic%', 'icaew'))
    # Same-named programmes on two campuses keep separate identities.
    assert {'diploma:diploma-in-information-technology', 'diploma:diploma-in-information-technology-2'} <= {e.programme_key for e in events}


def test_mmu_degree_record_keeps_requirements_verbatim():
    result = parse(FCI + 'bachelor-of-computer-science-hons', 'degree', 'mmu-computer-science.html')
    record = result.record
    assert result.issues == []
    assert record['name'] == 'Bachelor of Computer Science (Honours)'
    assert record['field_of_study'] == 'Computer Science'
    assert record['duration_months'] == 36  # "This three-year programme"
    assert result.evidence['faculty'] == 'Faculty of Computing and Informatics (FCI)'
    assert 'MQA/FA16430' in result.evidence['accreditation']
    assert record['programme_overview'].startswith('This three-year programme')
    assert 'ENQUIRE NOW' not in record['programme_overview']
    [section] = record['entry_requirement_sections']
    assert (section['applicant_category'], section['route'], section['heading']) == ('Local', 'All qualifications', 'Entry Requirements')
    assert 'Pass UEC with a minimum of Grade B in at least FIVE (5) subjects' in section['text']
    assert 'Mathematics and any one of the Science, Technology or Engineering subjects' in section['text']
    assert 'Researcher' in record['career_prospects'] and 'Security Engineer' in record['career_prospects']
    assert not any(c.lower().startswith('career prospects') for c in record['career_prospects'])


def test_mmu_separate_international_section_is_labelled():
    result = parse(ODL + 'bachelor-in-management', 'degree', 'mmu-management-odl.html')
    assert result.issues == []
    sections = result.record['entry_requirement_sections']
    assert [(s['applicant_category'], s['route']) for s in sections] == [
        ('Local', 'All qualifications'), ('International', 'Entry Requirements (International)')]
    # The English-waiver note mentions international students but is not separate criteria.
    assert 'does not apply to international students' in sections[0]['text']


def test_mmu_foundation_and_half_year_diploma():
    foundation = parse(NEW + 'foundation-in-communication', 'foundation', 'mmu-foundation-communication.html')
    assert foundation.issues == []
    assert foundation.record['field_of_study'] == 'Communication and Media'
    assert 'Pass UEC with a minimum of three (3) Bs including English.' in foundation.record['entry_requirement_sections'][0]['text']
    animation = parse('https://www.mmu.edu.my/programmes-by-faculty-all/programmes-by-faculty-fcm/diploma-in-3d-modelling-animation',
                      'diploma', 'mmu-diploma-3d-animation.html')
    assert animation.issues == []
    assert animation.record['field_of_study'] == 'Creative Arts'
    assert animation.record['duration_months'] == 30  # "two-and-a-half-year programme"


def test_mmu_descriptive_career_text_stays_whole():
    result = parse('https://www.mmu.edu.my/programmes-by-faculty-all/programmes-by-faculty-fom/bachelor-of-accounting-hons',
                   'degree', 'mmu-accounting.html')
    assert result.record['duration_months'] == 36
    [career] = result.record['career_prospects']
    assert career.startswith('Professional accountants that may specialise in taxation')


@pytest.mark.parametrize('text,months', [
    ('This three-year programme equips students', 36),
    ('a two-and-a-half-year programme', 30),
    ('The one-year foundation programme', 12),
    ('a one-year course before a three-year degree', None),
    ('a 3-year degree with a 4-year option', 36),
    ('This three-year programme ... a four-year programme', None),
    ('Pioneer in online learning in Malaysia for 25 years.', None),
    ('qualify within seven years of experience', None),
])
def test_mmu_duration_wording(text, months):
    from scraper.parsers.mmu import duration_months_from
    assert duration_months_from(text) == months


@pytest.mark.parametrize('name,field', [
    ('Bachelor of Information Technology (Honours) (Business Intelligence and Analytics)', 'Computer Science'),
    ('Bachelor of Information Technology (Honours) (Data Communications and Networking)', 'Computer Science'),
    ('Bachelor of Science (Honours) in Applied Artificial Intelligence', 'Computer Science'),
    ('Bachelor in Visual Effects (Honours)', 'Creative Arts'),
    ('Diploma in Creative Audio', 'Creative Arts'),
    ('Bachelor of Business Administration (Hons) (International Business)', 'Business and Economics'),
])
def test_mmu_field_mapping(name, field):
    from scraper.parsers.course_common import field_for_name
    assert field_for_name(name) == field
