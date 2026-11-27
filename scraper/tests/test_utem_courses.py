"""UTeM requirement PDFs. Fixtures hold the already-extracted pages (layout text
plus positioned pieces), so these tests do not depend on the installed pypdf."""
import json
import re
import pytest
from pathlib import Path
from scraper.course_pdf import PdfPage, FetchedPdfDocument
from scraper.public_http import FetchedDocument
from scraper.course_adapter import ProgrammeReference, SourceFailure

ROOT = Path('scraper/tests/fixtures/courses')
REQUIREMENT_WORDS = re.compile(r'Mendapat|Lulus|sekurang|PNGK|Gred|peperiksaan|KEPERLUAN')


def pages(name):
    data = json.loads((ROOT / name).read_text(encoding='utf-8'))
    return [PdfPage(p['number'], p['text'], tuple(tuple(c) for c in p['chunks'])) for p in data]


def parse(name, key):
    from scraper.parsers.utem import parse_document, DOCUMENTS
    return parse_document(pages(name), *DOCUMENTS[key], 'https://www.utem.edu.my/en/x.html')


def test_utem_spm_document_reads_every_diploma_row():
    found = parse('utem-spm.pages.json', 'lepasan-spm')
    assert len(found) == 6
    assert not any(p['ambiguous'] for p in found.values())
    ecommerce = found['UC4340001']  # code drawn as "UC" + "4340001"
    assert ecommerce['name'] == 'Diploma E-Commerce'
    assert ecommerce['short'] == 'DEC' and ecommerce['semesters'] == 6
    assert all('semester' not in p['name'].lower() for p in found.values())
    assert all(p['level'] == 'diploma' for p in found.values())
    assert 'Matematik Tambahan' in found['UC4522001']['section']['text']


def test_utem_merged_cell_is_shared_and_a_new_cell_is_not_borrowed():
    found = parse('utem-matric.pages.json', 'lepasan-matrikulasi-asasi')
    assert len(found) == 33
    assert not any(p['ambiguous'] for p in found.values())
    belg = found['UC6522001']
    assert belg['name'] == 'Ijazah Sarjana Muda Kejuruteraan Elektrik Dengan Kepujian'
    assert belg['section']['route'] == 'Lepasan Matrikulasi / Asasi'
    assert 'LEPASAN MATRIKULASI KEJURUTERAAN KPM' in belg['section']['text']
    assert 'Ijazah Sarjana Muda' not in belg['section']['text']
    # The FTMK cell's text runs on past the FAIX heading mid-sentence: one merged cell.
    software, ai = found['UC6481001'], found['UC6481005']
    assert ai['faculty'].startswith('FAKULTI KECERDASAN BUATAN')
    assert ai['section']['text'] == software['section']['text']
    assert 'Matematik Tambahan' in ai['section']['text']
    # The next FTMK row restarts its routes on its own heading line: its own cell.
    games = found['UC6481007']
    assert games['section']['text'].startswith('LEPASAN MATRIKULASI KEJURUTERAAN KPM')
    assert 'Matematik Tambahan' not in games['section']['text']
    assert 'Memenuhi Syarat Am' not in games['section']['text']


def test_utem_names_never_absorb_requirement_text():
    for name, key in [('utem-matric.pages.json', 'lepasan-matrikulasi-asasi'),
                      ('utem-diploma.pages.json', 'lepasan-diploma-setaraf'),
                      ('utem-btech.pages.json', 'btech')]:
        for code, programme in parse(name, key).items():
            assert not REQUIREMENT_WORDS.search(programme['name']), (code, programme['name'])
            assert not re.search(r'\b(Tekno|Elekt|sem)\b', programme['name']), programme['name']


def test_utem_btech_merged_cells_are_shared_and_a_row_without_text_is_held():
    found = parse('utem-btech.pages.json', 'btech')
    assert len(found) == 9
    assert found['UC6481008']['name'] == 'Sarjana Muda Teknologi Internet of Things (IoT) dengan Kepujian'
    # The electrical cell continues ("... serta" / "mendapat ...") into the electronics row.
    assert found['UC6522006']['section']['text'] == found['UC6523009']['section']['text']
    assert 'kelulusan Senat Universiti' in found['UC6522006']['section']['text']
    # The last faculty row has no requirement text of its own: held, never borrowed.
    assert [c for c, p in found.items() if p['ambiguous']] == ['UC6481009']
    assert found['UC6481009']['section'] is None


@pytest.mark.parametrize('first,right,previous,expected', [
    ('Memenuhi Syarat Am Universiti', ['Memenuhi Syarat Am Universiti'], 'x.', 'new'),
    ('LEPASAN MATRIKULASI KEJURUTERAAN KPM', ['LEPASAN MATRIKULASI KEJURUTERAAN KPM'], 'b) Matematik dan Sains.', 'new'),
    ('Lulus Diploma dalam bidang', ['Lulus Diploma dalam bidang'], '� Fizik / Kimia / Geography', 'new'),
    ('', ['pelajaran berikut:'], 'Mendapat Gred C dalam mata', 'continue'),
    ('mendapat kelulusan Senat Universiti;', ['mendapat kelulusan Senat Universiti;'], 'yang diiktiraf serta', 'continue'),
    ('Kemahiran Malaysia (DLKM)', ['Kemahiran Malaysia (DLKM)'], 'Lulus Diploma Kemahiran Malaysia (DKM) / Diploma Lanjutan', 'continue'),
    ('ATAU', ['ATAU'], 'kelulusan Senat Universiti.', 'continue'),
    ('', [], 'kredit.', 'unclear'),
])
def test_utem_row_boundary(first, right, previous, expected):
    from scraper.parsers.utem import row_boundary
    assert row_boundary(first, right, previous) == expected


def test_utem_entries_survive_a_missing_number_or_full_stop():
    from scraper.parsers.utem import _programmes
    found = _programmes(['13. Ijazah Sarjana Muda Sains Komputer', '(Kepintaran Buatan) Dengan', 'Kepujian',
                         'UC6481005 / BAXI', '7 semester', '14 Ijazah Sarjana Muda Sains Komputer',
                         '(Keselamatan Komputer) Dengan', 'Kepujian', 'UC6481006 / BAXZ', '7 semester',
                         'P Ijazah Sarjana Muda', 'Teknousahawanan Dengan Kepujian', 'UC6345002 / BTEC', '8 semester'])
    assert [(p['code'], p['name']) for p in found] == [
        ('UC6481005', 'Ijazah Sarjana Muda Sains Komputer (Kepintaran Buatan) Dengan Kepujian'),
        ('UC6481006', 'Ijazah Sarjana Muda Sains Komputer (Keselamatan Komputer) Dengan Kepujian'),
        ('UC6345002', 'Ijazah Sarjana Muda Teknousahawanan Dengan Kepujian')]
    assert [p['semesters'] for p in found] == [7, 7, 8]


def test_utem_discovery_reads_every_listed_programme():
    from scraper.parsers.utem import UTeMCourseAdapter
    documents = {'lepasan-spm': 'utem-spm.pages.json', 'lepasan-stpm': 'utem-matric.pages.json',
                 'lepasan-matrikulasi-asasi': 'utem-matric.pages.json',
                 'lepasan-diploma-setaraf': 'utem-diploma.pages.json', 'btech': 'utem-btech.pages.json'}
    def fetch(url, kind='html'):
        if kind == 'html':
            return FetchedDocument((ROOT / 'utem-undergraduate.html').read_text(encoding='utf-8'), url)
        key = next(k for k in documents if f'-{k}-syarat' in url)
        return FetchedPdfDocument(url, pages(documents[key]))
    adapter = UTeMCourseAdapter()
    events = list(adapter.discover(fetch))
    assert not [e for e in events if isinstance(e, SourceFailure)]
    refs = {e.programme_key: e for e in events if isinstance(e, ProgrammeReference)}
    assert len(refs) == 48
    held = sorted(k for k, r in refs.items() if r.context['issues'])
    assert held == ['degree:UC6481009']
    # Missing full stop / number in the diploma-leaver table: still read, all routes kept.
    for key in ('degree:UC6345002', 'degree:UC6481006'):
        assert len({s['route'] for s in refs[key].context['sections']}) == 3
    belg = adapter.parse(refs['degree:UC6522001'], fetch)
    assert belg.issues == []
    assert belg.record['duration_months'] == 48
    assert belg.record['source_academic_session'] == '2026/2027'
    assert belg.record['field_of_study'] == 'Engineering'
    assert {s['heading'] for s in belg.record['entry_requirement_sections']} == {'Keperluan khas program', 'Syarat am universiti'}


def test_utem_word_mending_uses_the_documents_own_words():
    from scraper.parsers.utem import mend_words
    words = {'teknologi', 'elektronik', 'kejuruteraan', 'lain', 'yang'}
    assert mend_words('Tekno logi Elekt ronik', words) == 'Teknologi Elektronik'
    assert mend_words('lain yang', words) == 'lain yang'
    assert mend_words('Kejuruteraan Elektronik', words) == 'Kejuruteraan Elektronik'


def test_utem_piece_joining_keeps_split_words_whole():
    from scraper.parsers.utem import join_pieces
    assert join_pieces([(75.0, 0, 'UC', 8.04), (86.5, 0, '4340001', 8.04)]) == 'UC4340001'
    assert join_pieces([(117.6, 0, '/ D', 8.04), (127.9, 0, 'EC', 8.04)]) == '/ DEC'
    assert join_pieces([(77.3, 0, 'Ijazah Sarjana Muda Sains ', 8.04), (190.0, 0, 'Komputer', 8.04)]) == 'Ijazah Sarjana Muda Sains Komputer'
