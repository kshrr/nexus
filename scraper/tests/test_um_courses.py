from pathlib import Path
from dataclasses import replace
import pytest
from scraper.public_http import FetchedDocument

FIXTURES = Path(__file__).parent / 'fixtures' / 'courses'
HOST = 'https://study.um.edu.my/'

def document(name, slug):
    return FetchedDocument((FIXTURES / (name + '.html')).read_text(encoding='utf-8'), HOST + slug, 'text/html')

def adapter():
    from scraper.parsers.um import UMCourseAdapter
    return UMCourseAdapter()

def computing():
    return document('um-information-systems', 'bachelor-of-computer-science-information-system')

def test_enumerates_all_faculties():
    links = adapter().faculty_links(document('um-index', 'undergraduate-faculties'))
    assert len(links) == 17
    assert HOST + 'faculty-of-computer-science' in links
    assert HOST + 'faculty-of-pharmacy' in links
    assert all(link.startswith(HOST) for link in links)

def test_enumerates_every_degree_link_once_and_ignores_other_links():
    doc = document('um-computing', 'faculty-of-computer-science')
    doc.html += '<a href="/bachelor-of-computer-science-information-system?utm_source=test#entry">Duplicate</a><a href="https://maya.um.edu.my/">Apply</a><a href="/module-database">Database</a>'
    links = adapter().programme_links(doc)
    assert len(links) == 6
    assert HOST + 'bachelor-of-computer-science-information-system' in links
    assert not any('maya.' in link or 'module-database' in link or '?' in link or '#' in link for link in links)

def test_extracts_real_programme_with_separate_requirement_routes():
    result = adapter().parse(computing(), HOST + 'faculty-of-computer-science')
    assert result.issues == []
    assert result.record['name'] == 'Bachelor of Computer Science (Information Systems)'
    assert result.record['field_of_study'] == 'Computer Science'
    assert result.record['duration_months'] == 42
    assert result.record['pathway_type'] == 'degree'
    sections = result.record['entry_requirement_sections']
    assert any(s['applicant_category'] == 'Local' and s['heading'] == 'STPM' and '3.00' in s['text'] for s in sections)
    assert any(s['applicant_category'] == 'International' and 'Senior High School' in s['heading'] for s in sections)
    assert any(s['applicant_category'] == 'Local' and 'Diploma' in s['heading'] for s in sections)
    assert 'Local / STPM' in result.record['entry_requirements']
    assert 'Data Analyst' in result.record['career_prospects']

def test_changed_content_keeps_stable_programme_identity():
    doc = computing()
    first = adapter().parse(doc, HOST + 'faculty-of-computer-science')
    changed = replace(doc, html=doc.html.replace('3.5 Years', '4.5 Years'))
    second = adapter().parse(changed, HOST + 'faculty-of-computer-science')
    assert second.programme_key == first.programme_key
    assert second.record['source_content_hash'] != first.record['source_content_hash']
    assert second.record['duration_months'] == 54

def test_pharmacy_has_its_own_field_and_duration():
    result = adapter().parse(document('um-pharmacy-degree', 'bachelor-of-pharmacy-with-honours'), HOST + 'faculty-of-pharmacy')
    assert result.issues == []
    assert result.record['field_of_study'] == 'Pharmacy'
    assert result.record['duration_months'] == 48

def test_missing_requirements_is_flagged_and_missing_duration_is_not_guessed():
    doc = computing()
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(doc.html, 'html.parser')
    entry = next(h for h in soup.find_all('h4') if h.get_text(strip=True) == 'Entry Requirement')
    entry.find_next_sibling().decompose()
    entry.decompose()
    result = adapter().parse(replace(doc, html=str(soup)), HOST + 'faculty-of-computer-science')
    assert 'missing_entry_requirements' in result.issues
    result = adapter().parse(replace(doc, html=doc.html.replace('3.5 Years', 'Duration varies')), HOST + 'faculty-of-computer-science')
    assert result.record['duration_months'] is None

def test_unknown_faculty_and_unlabelled_requirement_tabs_are_flagged():
    doc = computing()
    result = adapter().parse(doc, HOST + 'faculty-unregistered')
    assert 'unmapped_field' in result.issues
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(doc.html, 'html.parser')
    soup.select_one('button[data-tab="info1"]').string = 'Unknown'
    result = adapter().parse(replace(doc, html=str(soup)), HOST + 'faculty-of-computer-science')
    assert 'ambiguous_requirement_categories' in result.issues

def test_official_origin_and_degree_identity_are_enforced():
    with pytest.raises(ValueError, match='official'):
        adapter().parse(replace(computing(), final_url='https://example.org/bachelor-degree'), HOST + 'faculty-of-computer-science')
    result = adapter().parse(replace(computing(), html='<h3>Database module</h3>'), HOST + 'faculty-of-computer-science')
    assert 'missing_degree_name' in result.issues

@pytest.mark.parametrize('name,slug,count',[
    ('um-law','faculty-of-law',1),('um-medicine','faculty-of-medicine',2),('um-nursing','faculty-of-nursing',1),
])
def test_official_capitalized_programme_urls_are_preserved(name,slug,count):
    links=adapter().programme_links(document(name,slug))
    assert len(links)==count
    assert all('/Bachelor-' in url for url in links)

def test_degree_name_can_come_from_page_title_when_inner_heading_is_shortened():
    from bs4 import BeautifulSoup
    doc=computing();soup=BeautifulSoup(doc.html,'html.parser')
    soup.find('h3').string='Information Systems'
    soup.insert(0,BeautifulSoup('<h2>BACHELOR OF COMPUTER SCIENCE (INFORMATION SYSTEMS)</h2>','html.parser'))
    result=adapter().parse(replace(doc,html=str(soup)),HOST+'faculty-of-computer-science')
    assert result.record['name']=='Bachelor of Computer Science (Information Systems)'
    assert 'missing_degree_name' not in result.issues

@pytest.mark.parametrize('selector', ['#info1', '#info1 > h5'])
def test_empty_advertised_applicant_tab_or_route_is_incomplete(selector):
    from bs4 import BeautifulSoup
    doc = computing()
    soup = BeautifulSoup(doc.html, 'html.parser')
    block = soup.select_one(selector)
    assert block is not None
    if selector == '#info1':
        block.clear()
    else:
        for sibling in list(block.next_siblings):
            if getattr(sibling, 'name', None) in ('h4', 'h5', 'h6'): break
            sibling.extract()
    result = adapter().parse(replace(doc, html=str(soup)), HOST + 'faculty-of-computer-science')
    assert 'empty_requirement_section' in result.issues

@pytest.mark.parametrize('duration', ['3-4 Years', '3 to 4 Years', 'Minimum 3 Years', 'Approximately 3 Years'])
def test_ambiguous_duration_is_not_presented_as_an_exact_duration(duration):
    doc = computing()
    result = adapter().parse(replace(doc, html=doc.html.replace('3.5 Years', duration)), HOST + 'faculty-of-computer-science')
    assert result.record['duration_months'] is None
