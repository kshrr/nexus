"""UTM requirement book + programme pages. The book fixture holds 13 already-extracted
pages (layout text plus positioned pieces) of the 2026/2027 book, so these tests do
not depend on the installed pypdf: the programme list (pp. 14-15), FKE's merged cell
with DVM/APEL.A (pp. 28-30), Real Estate over three pages (pp. 76-78), Management's
STAM page (pp. 89-90) and the AI degree printed with Industrial Design's code
(pp. 141-143)."""
import json
from pathlib import Path
import pytest
from scraper.course_pdf import PdfPage, FetchedPdfDocument
from scraper.public_http import FetchedDocument, FetchError
from scraper.course_adapter import ProgrammeReference, SourceFailure

ROOT = Path('scraper/tests/fixtures/courses')
BOOK = ('https://admission.utm.my/wp-content/uploads/sites/461/2026/08/'
        '28072026-BUKU-SYARAT-KEMASUKAN-UG-LOCAL-20262027.pdf')
PAGE = 'https://admission.utm.my/programmes/'


def book_pages():
    data = json.loads((ROOT / 'utm-book.pages.json').read_text(encoding='utf-8'))
    return [PdfPage(p['number'], p['text'], tuple(tuple(c) for c in p['chunks'])) for p in data]


def fetcher(missing=()):
    pages = {'bachelor-in-artificial-intelligence-with-honours': 'utm-artificial-intelligence.html',
             'bachelor-of-electrical-engineering-with-honours': 'utm-electrical-engineering.html',
             'bachelor-of-real-estate-with-honours': 'utm-real-estate.html'}
    def fetch(url, kind='html'):
        if kind == 'pdf':
            return FetchedPdfDocument(url, book_pages())
        if kind == 'xml':
            return FetchedDocument((ROOT / 'utm-programmes-sitemap.xml').read_text(encoding='utf-8'), url, 'application/xml')
        if url.endswith('entry-requirements-ug-malaysian'):
            return FetchedDocument((ROOT / 'utm-entry-requirements.html').read_text(encoding='utf-8'), url)
        slug = url.rstrip('/').rsplit('/', 1)[-1]
        if slug in missing:
            raise FetchError('HTTPS request failed')
        if slug not in pages:
            return FetchedDocument('<html><main class="utm-single-programme"><h1>Other</h1></main></html>', url)
        return FetchedDocument((ROOT / pages[slug]).read_text(encoding='utf-8'), url)
    return fetch


def test_utm_programme_list_is_the_book_authority():
    from scraper.parsers.utm import programme_list
    listing = programme_list(book_pages())
    assert len(listing) == 56
    assert listing['UT6481007'] == 'SARJANA MUDA KECERDASAN BUATAN DENGAN KEPUJIAN'
    assert listing['UT6214001'] == 'SARJANA MUDA SAINS DENGAN KEPUJIAN (REKABENTUK INDUSTRI)'
    assert not any(name[:1].isdigit() for name in listing.values())


def test_utm_merged_faculty_cell_is_shared_and_routes_inside_a_column_split():
    from scraper.parsers.utm import book_programmes
    found, unread = book_programmes(book_pages())
    assert unread == []
    fke = ['UT6522002', 'UT6523001', 'UT6523002', 'UT6523003']
    stpm = {found[c]['sections'][0] for c in fke}
    assert len(stpm) == 1  # one merged cell, not four slices of it
    route, text = stpm.pop()
    assert route == 'Lepasan STPM'
    assert text.startswith('Mendapat sekurang-kurangnya PNGK 2.80') and text.rstrip().endswith('dikeluarkan.')
    routes = dict(found['UT6522002']['sections'])
    assert routes['Lepasan Diploma Vokasional Malaysia (DVM)'] == 'TIDAK DITAWARKAN'
    assert routes['Lepasan APEL.A'].startswith('Memiliki Sijil Perakuan APEL.A')
    assert all(found[c]['issues'] == [] for c in fke)


def test_utm_book_code_typo_is_resolved_by_the_programme_list():
    from scraper.parsers.utm import book_programmes
    found, _ = book_programmes(book_pages())
    ai = dict(found['UT6481007']['sections'])
    assert found['UT6481007']['semesters'] == 6
    assert 'Lepasan STPM' in ai and 'Lepasan APEL.A' in ai
    assert found['UT6481007']['issues'] == []


def test_utm_wrapped_route_name_is_not_a_new_route_and_continuation_pages_join():
    from scraper.parsers.utm import book_programmes
    found, _ = book_programmes(book_pages())
    management = [route for route, _ in found['UT6345003']['sections']]
    assert management.count('Lepasan STAM') == 1  # "(STAM)" wrapped onto its own line
    assert 'Pangkat Jayyid Jiddan' in dict(found['UT6345003']['sections'])['Lepasan STAM']
    estate = dict(found['UT6341003']['sections'])
    assert estate['Lepasan Kelayakan Setaraf (A Level / IB / AUSMAT)'] == 'TIDAK DITAWARKAN'
    assert estate['Lepasan Diploma'].startswith('Memiliki Diploma Penilaian/ Diploma Harta Tanah')
    assert estate['Lepasan Diploma Vokasional Malaysia (DVM)'] == 'TIDAK DITAWARKAN'
    assert estate['Lepasan APEL.A'].startswith('Memiliki Sijil Perakuan APEL.A')


@pytest.mark.parametrize('text,expected', [
    ('LEPASAN APEL. A', True), ('APEL. A', True), ('LEPASAN STAM', True),
    ('(STAM)', False), ('TIDAK DITAWARKAN', False),
    ('Lepasan Diploma selain dari yang dinyatakan di atas', False),
])
def test_utm_sub_route_headings(text, expected):
    from scraper.parsers.utm import is_sub_route
    assert is_sub_route(text) is expected


def test_utm_row_code_needs_a_matching_name():
    from scraper.parsers.utm import resolve_code
    listing = {'UT6214001': 'SARJANA MUDA SAINS DENGAN KEPUJIAN (REKABENTUK INDUSTRI)',
               'UT6481007': 'SARJANA MUDA KECERDASAN BUATAN DENGAN KEPUJIAN',
               'UT6520001': 'SARJANA MUDA SAINS GEOINFORMATIK DENGAN KEPUJIAN'}
    assert resolve_code('Sarjana Muda Kecerdasan Buatan dengan Kepujian UT 6214001 6 Semester', listing) == 'UT6481007'
    assert resolve_code('Sarjana Muda Sains dengan Kepujian (Rekabentuk Industri) # UT6214001', listing) == 'UT6214001'
    assert resolve_code('Sarjana Muda Sains Geoinfomatik dengan Kepujian UT6520001', listing) == 'UT6520001'
    assert resolve_code('Sarjana Muda Sesuatu Yang Lain UT6214001', listing) is None


def test_utm_programme_page_details():
    from bs4 import BeautifulSoup
    from scraper.parsers.utm import page_details, GENERAL_ROUTE
    soup = BeautifulSoup((ROOT / 'utm-artificial-intelligence.html').read_text(encoding='utf-8'), 'html.parser')
    details = page_details(soup)
    assert details['code'] == 'UT6481007'
    assert details['name'] == 'Bachelor in Artificial Intelligence with Honours'
    assert details['faculty'] == 'Faculty of Artificial Intelligence'
    assert [(g['applicant_category'], g['route']) for g in details['general']] == [
        ('Local', GENERAL_ROUTE), ('Local', 'Programme conditions'), ('International', 'International applicants')]
    assert 'Band 5.5 in IELTS' in details['general'][2]['text']


def test_utm_discovery_and_records():
    from scraper.parsers.utm import UTMCourseAdapter
    adapter = UTMCourseAdapter()
    fetch = fetcher()
    events = list(adapter.discover(fetch))
    assert not [e for e in events if isinstance(e, SourceFailure)]
    refs = {e.programme_key: e for e in events}
    assert len(refs) == 56
    assert refs['degree:UT6481007'].source_url == PAGE + 'bachelor-in-artificial-intelligence-with-honours'
    assert refs['degree:UT6345003'].source_url == BOOK  # no page carries this code: book only
    ai = adapter.parse(refs['degree:UT6481007'], fetch)
    assert ai.issues == []
    record = ai.record
    assert record['name'] == 'Bachelor in Artificial Intelligence with Honours'
    assert record['field_of_study'] == 'Computer Science'
    assert record['duration_months'] == 36
    assert record['source_academic_session'] == '2026/2027'
    assert ai.evidence['malay_name'] == 'SARJANA MUDA KECERDASAN BUATAN DENGAN KEPUJIAN'
    sections = record['entry_requirement_sections']
    assert {s['source_url'] for s in sections if s['heading'] == 'Keperluan khas program'} == {BOOK}
    assert any(s['applicant_category'] == 'International' for s in sections)
    management = adapter.parse(refs['degree:UT6345003'], fetch)
    assert management.record['name'] == 'Sarjana Muda Pengurusan dengan Kepujian'
    assert management.record['field_of_study'] == 'Business and Economics'
    assert management.issues == []
    estate = adapter.parse(refs['degree:UT6341003'], fetch)
    assert estate.record['field_of_study'] == 'Built Environment' and estate.issues == []


def test_utm_unreachable_programme_page_keeps_the_published_course():
    from scraper.parsers.utm import UTMCourseAdapter
    adapter = UTMCourseAdapter()
    fetch = fetcher(missing={'bachelor-in-artificial-intelligence-with-honours'})
    refs = {e.programme_key: e for e in adapter.discover(fetch)}
    with pytest.raises(FetchError):
        adapter.parse(refs['degree:UT6481007'], fetch)
