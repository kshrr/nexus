"""UTeM official entry-requirement documents (session-dated PDFs). No admission inference.

UTeM publishes its programmes and their requirements only as five PDFs on the
undergraduate page, one per applicant type (SPM, STPM, Matriculation/Asasi,
Diploma/equivalent, B.Tech). Each PDF opens with the university's general
requirements ("Syarat Am Universiti") and then a two-column table: programmes
(number, Malay name, UPU code, semesters) on the left, requirements on the right.

Each text piece in the PDF carries its x/y position and font size. Pieces are
grouped into lines by y; a piece belongs to the programme column when it directly
continues the previous programme-column piece or starts well left of the
requirement column's usual edge. Rows are grouped:
 - degree PDFs: a row starts at "FAKULTI ..." on the left. It opens its own
   requirement cell when "Memenuhi Syarat Am Universiti" heads its right column,
   or when its requirement text starts on the faculty heading's own line with a
   capital after the cell above finished. When the text above runs on into the row
   (it sits below the heading, starts lowercase or with ATAU/DAN, or the line above
   stops mid-sentence) the rows share one merged cell. A row with no requirement
   text, or an unclear boundary, is flagged ``ambiguous_requirement_table``; criteria
   are never borrowed from a separate cell.
 - the SPM (diploma) PDF: every numbered programme is its own row.
Programme names are UTeM's official Malay names; English names on the website
carry no codes and are not paired by guesswork.
"""
import re
from scraper.course_adapter import ProgrammeReference, SourceFailure
from scraper.course_sources import get_source
from scraper.public_http import FetchError
from .course_common import soup_for, clean, field_for_name, finalise_candidate, normalise_session

INDEX = 'https://www.utem.edu.my/en/undergraduate.html'
LOCAL = 'Local'
# PDF link slug fragment -> (route label shown to students, pathway level)
DOCUMENTS = {
    'lepasan-spm': ('Lepasan SPM', 'diploma'),
    'lepasan-stpm': ('Lepasan STPM', 'degree'),
    'lepasan-matrikulasi-asasi': ('Lepasan Matrikulasi / Asasi', 'degree'),
    'lepasan-diploma-setaraf': ('Lepasan Diploma / Setaraf', 'degree'),
    'btech': ('Lepasan Diploma Teknologi / DKM / DLKM (B.Tech)', 'degree'),
}
UPU = re.compile(r'\b(UC ?\d{7})\s*/\s*([A-Z][A-Z ]{1,6}[A-Z])\b')
SEMESTERS = re.compile(r'\b(\d{1,2})\s*semester\b', re.I)
SESSION = re.compile(r'SESI\s+AKADEMIK\s+(20\d{2}\s*/\s*20\d{2})', re.I)
# A programme number, with its name on the same line or (drawn slightly higher) alone.
ENTRY = re.compile(r'^\s*(\d{1,2})\.(?:\s+\S|\s*$)')
# A programme title at the start of a left-column line, after an optional number
# (with or without its full stop) or one stray letter drawn from the next column.
NAME_START = re.compile(r'^\s*(?:\d{1,2}\.?\s+|[A-Z]\s+)?((?:Ijazah\s+)?Sarjana\s+Muda|Diploma)\b')
HEADER_LINE = re.compile(
    r'PROGRAM\s+PENGAJIAN|KOD\s+UPU|TEMPOH\s+PENGAJIAN|KELAYAKAN\s+MINIMUM|UNIVERSITI\s+TEKNIKAL\s+MALAYSIA|'
    r'SYARAT\s*-\s*SYARAT\s+KEMASUKAN|^\s*\d+\s*/\s*\d+\s*$|^\s*BIDANG\s', re.I)
ROW_OPEN = re.compile(r'Memenuhi\s+Syarat\s+Am\s+Universiti', re.I)


def tidy(text):
    text = re.sub(r'\s+-\s*(?=kurangnya)', '-', text)
    text = re.sub(r'\(\s+', '(', re.sub(r'\s+\)', ')', text))
    return clean(re.sub(r'[ \t]{2,}', ' ', text))


def document_words(pages):
    """Whole words as the document's own layout text spells them."""
    return {w.casefold() for p in pages for w in re.findall(r'[A-Za-z]{2,}', p.text)}


def mend_words(text, words):
    """Join a word drawn in two pieces ('Tekno logi' -> 'Teknologi') only when the
    joined word occurs in the same document and a fragment is not a word itself."""
    def join(match):
        a, b = match.group(1), match.group(2)
        whole = (a + b).casefold()
        if whole in words and (a.casefold() not in words or b.casefold() not in words):
            return a + b
        return match.group(0)
    previous = None
    while previous != text:
        previous, text = text, re.sub(r'\b([A-Za-z]+) ([a-z]+)\b', join, text)
    return text


# Approximate Arial advance widths (fraction of the font size). UTeM's documents
# use ArialMT; only spacing decisions depend on this, never which text is kept.
NARROW = set('iljtfrI.,;:!|\' ')
WIDE = set('mwMW')


def text_width(text, size):
    em = 0.0
    for ch in text:
        if ch in NARROW:
            em += 0.28
        elif ch in WIDE:
            em += 0.83
        elif ch.isupper():
            em += 0.67
        elif ch.isdigit():
            em += 0.56
        elif ch in '()-/':
            em += 0.33
        else:
            em += 0.5
    return em * (size or 8)


def piece_end(piece):
    return piece[0] + text_width(piece[2], piece[3] if len(piece) > 3 else 8)


def join_pieces(pieces):
    """Rejoin one column's pieces in x order. A space is added only where the next
    piece starts clearly after the previous one ends, so a word drawn in parts
    ('UC' '4340001', 'Elekt' 'ronik', 'sekurang' '-' 'kurangnya') stays whole."""
    out, previous = '', None
    for piece in sorted(pieces, key=lambda p: p[0]):
        text = piece[2]
        if previous is None or out.endswith(' ') or text.startswith(' '):
            out += text
        else:
            size = piece[3] if len(piece) > 3 and piece[3] else 8
            out += text if piece[0] - piece_end(previous) < 0.15 * size else ' ' + text
        previous = piece
    return re.sub(r'\s+', ' ', out).strip()


def split_line(pieces, right_start):
    """Left/right pieces of one table line. A piece directly continuing the previous
    left piece stays left (justified names end near the requirement column);
    otherwise it is left only when it starts well before the requirement column."""
    left, right = [], []
    for piece in sorted(pieces, key=lambda p: p[0]):
        size = piece[3] if len(piece) > 3 and piece[3] else 8
        if right:
            right.append(piece)
        elif left and piece[0] < right_start - 3 and piece[0] - piece_end(left[-1]) <= size:
            left.append(piece)
        elif piece[0] < right_start - 30:
            left.append(piece)
        else:
            right.append(piece)
    return left, right


def table_lines(pages):
    """(left, right) text per table line across pages, from positioned pieces.

    Each piece belongs to the column its own x-position falls in, so a long
    programme name never leaks into the requirement text or the reverse."""
    pairs = []
    for page in pages:
        chunks = [c for c in page.chunks if str(c[2]).strip()]
        header = [c for c in chunks if re.search(r'KELAYAKAN\s+MINIMUM', c[2], re.I)]
        if not header:
            continue
        top = min(c[1] for c in header)
        body = [c for c in chunks if c[1] < top - 4]
        # The requirement column's left edge: the leftmost piece start (past the
        # programme column) used at least three times on the page. Bullets and
        # centred connectors start further right and are not the edge.
        starts = [round(c[0]) for c in body if c[0] >= 150]
        frequent = sorted(x for x in set(starts) if starts.count(x) >= 3)
        if not frequent:
            continue
        right_start = frequent[0]
        lines = []
        for chunk in sorted(body, key=lambda c: -c[1]):
            if lines and abs(lines[-1][0] - chunk[1]) <= 2.5:
                lines[-1][1].append(chunk)
            else:
                lines.append([chunk[1], [chunk]])
        for _, pieces in lines:
            left_pieces, right_pieces = split_line(pieces, right_start)
            left = join_pieces(left_pieces)
            right = join_pieces(right_pieces)
            if HEADER_LINE.search(f'{left} {right}'):
                continue
            if left or right:
                pairs.append((left, right))
    return pairs


def general_requirements(pages):
    """The 'Syarat Am Universiti' block at the start of each document."""
    lines, active = [], False
    for page in pages:
        for line in page.text.split('\n'):
            if re.search(r'SYARAT\s+AM\s+UNIVERSITI', line, re.I) and not active:
                active = True
                continue
            if active and (HEADER_LINE.search(line) or re.search(r'KELAYAKAN|PROGRAM PENGAJIAN', line)):
                return tidy('\n'.join(lines))
            if active and line.strip():
                lines.append(line.strip())
    return tidy('\n'.join(lines))


def _programmes(left_lines, words=frozenset()):
    """Numbered entries in a row's left column -> [{code, short, name, semesters}].

    The documents occasionally drop a number's full stop ("14 Ijazah ...") or the
    number itself; a programme title that starts after the previous entry already
    has its UPU code is still a new entry, never a continuation of that name."""
    entries, current = [], None
    for line in left_lines:
        title = NAME_START.match(line)
        if ENTRY.match(line) or (title and (current is None or UPU.search(' '.join(current)))):
            current = [line[title.start(1):] if title else re.sub(r'^\s*\d{1,2}\.\s*', '', line)]
            entries.append(current)
        elif current is not None:
            current.append(line)
    out = []
    for chunk in entries:
        # Mend split words first so "(6 sem ester)" is read as a duration, not a name.
        text = mend_words(' '.join(part.strip() for part in chunk), words)
        code = UPU.search(text)
        if not code:
            continue
        semesters = {int(n) for n in SEMESTERS.findall(text)}
        name = text[:code.start()]
        name = SEMESTERS.sub('', name).replace('()', '')
        name = tidy(mend_words(re.sub(r'[•\s]+', ' ', name).strip(' ,;'), words))
        out.append({'code': code.group(1).replace(' ', ''), 'short': code.group(2).replace(' ', ''), 'name': name,
                    'semesters': semesters.pop() if len(semesters) == 1 else None})
    return out


def parse_document(pages, route, level, source_url):
    """{upu_code: {...programme, section | None, ambiguous}} for one PDF."""
    pairs = table_lines(pages)
    words = document_words(pages)
    has_faculties = any(left.strip().upper().startswith('FAKULTI') for left, _ in pairs)
    starts = [i for i, (left, _) in enumerate(pairs)
              if (left.strip().upper().startswith('FAKULTI') if has_faculties else ENTRY.match(left))]
    # A faculty heading wraps over several lines; only its first line opens a row.
    if has_faculties:
        starts = [i for n, i in enumerate(starts) if n == 0 or i - 1 != starts[n - 1]
                  or not pairs[i - 1][0].strip().upper().startswith('FAKULTI')]
    rows = []
    for n, start in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(pairs)
        block = pairs[start:end]
        right = [r for _, r in block if r]
        previous_right = next((r for _, r in reversed(pairs[:start]) if r), '')
        boundary = 'new' if not has_faculties else row_boundary(pairs[start][1], right, previous_right)
        faculty = ' '.join(l.strip() for l, _ in block if l.strip() and not ENTRY.match(l)
                           and not UPU.search(l) and l.strip().upper() == l.strip()) if has_faculties else None
        rows.append({'programmes': _programmes([l for l, _ in block if l], words),
                     'right': right, 'boundary': boundary, 'faculty': faculty})
    # Rows whose requirement text continues across the faculty boundary share one
    # merged cell: every programme in the group gets the whole cell's text.
    groups = []
    for row in rows:
        if row['boundary'] == 'continue' and groups:
            groups[-1].append(row)
        else:
            groups.append([row])
    found = {}
    for group in groups:
        clean = group[0]['boundary'] == 'new' and all(row['right'] for row in group)
        text = mend_words(tidy('\n'.join(r for row in group for r in row['right'])), words)
        for row in group:
            for programme in row['programmes']:
                section = None
                if clean and text:
                    section = {'applicant_category': LOCAL, 'route': route, 'heading': 'Keperluan khas program',
                               'text': text, 'source_url': source_url}
                found[programme['code']] = {**programme, 'level': level, 'faculty': row['faculty'],
                                            'section': section, 'ambiguous': not clean}
    return found


CONNECTOR = re.compile(r'^(?:atau|dan|serta)$', re.I)
UNFINISHED_END = re.compile(r'(?:\b(?:atau|dan|serta|dengan|di|dari|yang|dalam|pada)|[,;/\-])\s*$', re.I)
BULLET = re.compile(r'^\s*[•�\-]|^\s*[a-z]\)\s')


def row_boundary(first_right, right, previous_right):
    """How a faculty row's requirement column relates to the row above.

    'new'      the row opens its own requirement cell: "Memenuhi Syarat Am
               Universiti", or text that starts on the faculty heading's own line
               with a capital after the cell above ended (a full stop or a list item).
    'continue' the cell above runs on into this row (a merged cell): the text sits
               below the heading, starts lowercase or with ATAU/DAN, or the line
               above stops mid-sentence.
    'unclear'  anything else; its programmes are held for review."""
    if any(ROW_OPEN.search(r) for r in right[:3]):
        return 'new'
    if not right:
        return 'unclear'
    previous = previous_right.strip()
    finished = previous.endswith('.') or (BULLET.match(previous) and not UNFINISHED_END.search(previous))
    first = first_right.strip()
    if first and first[0].isupper() and not CONNECTOR.match(first) and finished:
        return 'new'
    if not first or first[0].islower() or CONNECTOR.match(first) or not finished:
        return 'continue'
    return 'unclear'


class UTeMCourseAdapter:
    source = 'utem'
    canonical_url = get_source('utem').canonical_url

    def discover(self, fetch):
        doc = fetch(INDEX)
        soup = soup_for(doc)
        documents = {}
        for anchor in soup.find_all('a', href=True):
            try:
                url = self.canonical_url(anchor['href'], doc.final_url)
            except ValueError:
                continue
            key = next((k for k in DOCUMENTS if f'-{k}-syarat' in url), None)
            if key and key not in documents:
                documents[key] = url
        for key in DOCUMENTS:
            if key not in documents:
                yield SourceFailure(INDEX, f'Requirement document not found: {key}')
        programmes = {}
        for key, url in documents.items():
            route, level = DOCUMENTS[key]
            try:
                pdf = fetch(url, 'pdf')
            except FetchError as error:
                yield SourceFailure(url, str(error))
                continue
            source_url = self.canonical_url(pdf.final_url)
            general = general_requirements(pdf.pages)
            sessions = [normalise_session(m) for p in pdf.pages for m in SESSION.findall(p.text)]
            parsed = parse_document(pdf.pages, route, level, source_url)
            # Safety net: a programme listed in this document but not read from its
            # table must not look complete with one route silently missing.
            listed = {c.replace(' ', '') for p in pdf.pages for c in re.findall(r'\bUC ?\d{7}\b', p.text)}
            for code in sorted(listed - set(parsed)):
                missed = programmes.setdefault(code, {'name': '', 'level': level, 'semesters': None, 'short': None,
                                                      'faculty': None, 'sections': [], 'issues': [], 'sessions': [],
                                                      'documents': []})
                missed['issues'].append('ambiguous_requirement_table')
                missed['documents'].append(source_url)
            for code, item in parsed.items():
                entry = programmes.setdefault(code, {'name': item['name'], 'level': item['level'], 'semesters': item['semesters'],
                                                     'short': item['short'], 'faculty': item['faculty'], 'sections': [],
                                                     'issues': [], 'sessions': [], 'documents': []})
                # A word lost to the column split only shortens a name: keep the longest variant.
                if len(item['name']) > len(entry['name']):
                    entry['name'] = item['name']
                entry['documents'].append(source_url)
                entry['sessions'] += [s for s in sessions if s]
                if item['ambiguous'] or item['section'] is None:
                    entry['issues'].append('ambiguous_requirement_table')
                    continue
                entry['sections'].append(item['section'])
                if general:
                    entry['sections'].append({'applicant_category': LOCAL, 'route': route, 'heading': 'Syarat am universiti',
                                              'text': general, 'source_url': source_url})
        if not programmes:
            yield SourceFailure(INDEX, 'No supported programmes found in the requirement documents')
        for code, entry in programmes.items():
            yield ProgrammeReference(f"{entry['level']}:{code}", INDEX, entry['level'], {'code': code, **entry})

    def parse(self, reference, fetch):
        context = reference.context
        name = context['name']
        duration = context['semesters'] * 6 if context.get('semesters') and 0 < context['semesters'] <= 16 else None
        return finalise_candidate(
            reference,
            get_source('utem'),
            {
                'name': name,
                'field_of_study': field_for_name(name),
                'duration_months': duration,
                'entry_requirement_sections': list(context['sections']),
            },
            {
                'upu_code': context['code'],
                'utem_code': context['short'],
                'faculty': context.get('faculty'),
                'requirement_documents': list(dict.fromkeys(context['documents'])),
                'applicant_category_basis': 'UTeM local entry-requirement documents (SPM/STPM/Matriculation/Diploma)',
                'name_language': 'ms',
                'sessions': list(dict.fromkeys(context['sessions'])),
            },
            list(dict.fromkeys(context['issues'])),
        )
