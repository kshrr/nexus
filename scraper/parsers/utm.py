"""Universiti Teknologi Malaysia (UTM) undergraduate programmes. No admission inference.

Sources, both official:
 - The session requirement book (PDF, "BUKU SYARAT KEMASUKAN UG LOCAL") linked from
   the "Entry Requirements UG Malaysian" page. Its programme list (UPU code + Malay
   name) is the authority on which programmes are offered; its per-faculty tables
   give each programme's special requirements for up to seven routes (STPM,
   Matriculation/Asasi, STAM, Diploma, A Level/IB/AUSMAT, DVM, APEL.A).
 - The programme web pages (WordPress "programmes" sitemap): English name, faculty,
   overview, career prospects and the general Malaysian/international requirements,
   matched to the book by the UPU code printed on the page. A book programme without
   a matching page keeps its official Malay name; a page whose code is not in the
   book is not an offered programme and is ignored.

Reading the tables (positioned text pieces):
 - Each table page names its route columns in a "LEPASAN ..." header band; a
   column's left edge is where its lines start.
 - A faculty block is a "Memenuhi Syarat Am Universiti" header band and the
   programme rows ("Sarjana Muda ...") that follow. Its requirement text is one
   merged cell per route, shared by every programme in the block: in this book a
   later row's text always continues the cell above ("dan", "atau", a bullet or
   mid-sentence) rather than opening its own.
 - A page that does not open with a header band continues the previous page's last
   block when both pages have the same columns. Inside a column, a short upper-case
   "LEPASAN ..." line starts another route (DVM "TIDAK DITAWARKAN", then APEL.A).
 - A row's printed code is accepted only when the row's name matches the programme
   list entry for that code; otherwise the name is looked up in the list (the book
   prints Industrial Design's code UT6214001 under the AI degree, UT6481007).
"""
import re
from difflib import SequenceMatcher
from urllib.parse import urlsplit
from scraper.course_adapter import ProgrammeReference, SourceFailure
from scraper.course_sources import get_source
from scraper.public_http import FetchError
from .course_common import soup_for, clean, field_for_name, finalise_candidate, normalise_session
from .utem import join_pieces, mend_words, document_words, tidy

SITEMAP = 'https://admission.utm.my/wp-sitemap-posts-programmes-1.xml'
REQUIREMENTS_PAGE = 'https://admission.utm.my/entry-requirements-ug-malaysian'
BOOK_LINK = re.compile(r'SYARAT-KEMASUKAN-UG-LOCAL[^/]*\.pdf$', re.I)
LOCAL = 'Local'
CODE = re.compile(r'\bUT\s?(\d(?:\s?\d){6})\b')
SESSION = re.compile(r'SESI\s+(?:AKADEMIK|KEMASUKAN)\s+(20\d{2}\s*/\s*20\d{2})', re.I)
TABLE_PAGE = re.compile(r'SYARAT\s+KHAS\s+KEMASUKAN\s+MENGIKUT\s+PROGRAM', re.I)
LIST_PAGE = re.compile(r'SENARAI\s+PENAWARAN\s+PROGRAM', re.I)
ROW_START = re.compile(r'^\s*Sarjana\s+Muda\b', re.I)
SEMESTERS = re.compile(r'\b(\d{1,2})\s*Semester\b', re.I)
HEADER_WORDS = re.compile(r'Memenuhi\s+Syarat\s+Am|^\s*(?:serta|KEPERLUAN\s+KHAS\s+PROGRAM)\s*$', re.I)
FACULTY_LEFT = re.compile(r'^(?:FAKULTI|SEKOLAH|INSTITUT|KAMPUS)\b|^[A-Z][A-Z &,()/-]+$')
OPENS_BLOCK = re.compile(r'Memenuhi\s+Syarat\s+Am', re.I)
NOT_OFFERED = re.compile(r'^\s*TIDAK\s+DITAWARKAN\b', re.I)
GENERAL_ROUTE = 'General entry requirements (all UTM programmes)'

# Route column headings, matched with spaces removed (the book draws some headings
# in pieces: "LEPASA N STPM", "S TPM", "DIPLOM A").
ROUTES = (
    ('VOKASIONAL', 'Lepasan Diploma Vokasional Malaysia (DVM)'),
    ('KELAYAKANSETARAF', 'Lepasan Kelayakan Setaraf (A Level / IB / AUSMAT)'),
    ('MATRIKULASI', 'Lepasan Matrikulasi / Asasi'),
    ('APEL', 'Lepasan APEL.A'),
    ('STPM', 'Lepasan STPM'),
    ('STAM', 'Lepasan STAM'),
    ('DIPLOMA', 'Lepasan Diploma'),
)


def route_for(heading):
    squeezed = re.sub(r'[^A-Z]', '', heading.upper())
    return next((label for key, label in ROUTES if key in squeezed), None)


def is_sub_route(text):
    """A route heading inside a column: a short upper-case line naming a route
    ("LEPASAN APEL. A", or "APEL. A" when "LEPASAN" was drawn apart)."""
    text = text.strip()
    named = re.match(r'^LE\s*PAS', text) or re.fullmatch(r'APEL\.?\s*A', text)
    return bool(named) and len(text) <= 60 and text.upper() == text and route_for(text) is not None


def norm(text):
    words = re.sub(r'[^a-z0-9]+', ' ', (text or '').lower()).split()
    return [w for w in words if w not in ('dengan', 'kepujian', 'sarjana', 'muda')]


def code_in(text):
    m = CODE.search(text or '')
    return 'UT' + re.sub(r'\s', '', m.group(1)) if m else None


def columns(page):
    """[(left edge, route)] requirement columns of one table page, or None.

    Headings are the "LEPASAN ..." groups in the band between the "FAKULTI/" and
    "SEMESTER" labels. A column's left edge is the earliest x at which at least
    three text pieces start (the first column), or the most common start near the
    midpoint between two headings (later columns)."""
    chunks = [c for c in page.chunks if str(c[2]).strip()]
    top = [c[1] for c in chunks if re.search(r'FAKULTI/|^\s*(?:i|v)\.\s*$', c[2])]
    bottom = [c[1] for c in chunks if re.search(r'SEMESTER', c[2])]
    if not top or not bottom:
        return None
    band = sorted([c for c in chunks if min(bottom) - 2 <= c[1] <= max(top) + 8 and 120 < c[0] < 590],
                  key=lambda c: c[0])
    groups = []
    for c in band:
        end = c[0] + len(c[2]) * 4.6
        if groups and c[0] - groups[-1]['end'] < 35:
            groups[-1]['items'].append(c)
            groups[-1]['end'] = max(groups[-1]['end'], end)
        else:
            groups.append({'items': [c], 'end': end, 'x': c[0]})
    headings = []
    for group in groups:
        text = ' '.join(c[2] for c in sorted(group['items'], key=lambda c: (-round(c[1]), c[0])))
        route = route_for(text) if re.search(r'LE\s*PAS', text.upper()) else None
        if route:
            headings.append((group['x'], route))
    if not headings:
        return None
    starts = sorted(round(c[0]) for c in chunks if c[1] < min(bottom) - 4)

    def dense(x):
        return sum(1 for s in starts if x <= s <= x + 3)

    edges = []
    for i, (x, route) in enumerate(headings):
        if i == 0:
            window = range(120, int(x) + 11)
            edge = next((s for s in window if dense(s) >= 3), None)
        else:
            mid = (headings[i - 1][0] + x) / 2 + 25
            window = range(int(mid - 45), int(mid + 50))
            edge = max(window, key=lambda s: (dense(s), -s)) if any(dense(s) >= 3 for s in window) else None
        if edge is None:
            # A continuation page whose column holds a line or two ("TIDAK DITAWARKAN",
            # a note): the earliest start in the window, else just left of the heading.
            # Later columns search only near their own heading, so line endings of the
            # column to the left are not mistaken for this column's edge.
            near = window if i == 0 else range(int(x) - 40, int(x) + 11)
            edge = next((s for s in near if dense(s)), int(x) - (80 if i == 0 else 30))
        edges.append((edge, route))
    return edges


def page_lines(page, cols):
    """[(y, left, [column texts])] table lines below the column headers of one page."""
    chunks = [c for c in page.chunks if str(c[2]).strip()]
    bottom = min(c[1] for c in chunks if re.search(r'SEMESTER', c[2]))
    body = [c for c in chunks if 40 < c[1] < bottom - 4]
    lines = []
    for chunk in sorted(body, key=lambda c: -c[1]):
        if lines and abs(lines[-1][0] - chunk[1]) <= 2.5:
            lines[-1][1].append(chunk)
        else:
            lines.append([chunk[1], [chunk]])
    edges = [edge for edge, _ in cols]
    out = []
    for y, pieces in lines:
        left = join_pieces([p for p in pieces if p[0] < edges[0] - 4])
        texts = []
        for i, edge in enumerate(edges):
            nxt = edges[i + 1] - 4 if i + 1 < len(edges) else 10_000
            texts.append(join_pieces([p for p in pieces if edge - 4 <= p[0] < nxt]))
        out.append((y, left, texts))
    return out


def faculty_blocks(pages):
    """Faculty blocks of the requirement tables, in book order (see module notes).

    Returns (blocks, unread page numbers). Each block:
    {'faculty': [...], 'programmes': [[left lines], ...], 'columns': [[(route, [lines])]], 'pages': [...]}"""
    blocks, unread, previous_routes = [], [], None
    for page in pages:
        if not TABLE_PAGE.search(page.text):
            continue
        cols = columns(page)
        if cols is None:
            unread.append(page.number)
            previous_routes = None
            continue
        routes = tuple(route for _, route in cols)

        def new_block():
            blocks.append({'faculty': [], 'programmes': [], 'pages': [page.number],
                           'columns': [[(route, [])] for route in routes]})
            return blocks[-1]

        block = blocks[-1] if blocks and previous_routes == routes else None
        if block is not None and page.number not in block['pages']:
            block['pages'].append(page.number)
        last_line = ['' for _ in routes]
        for _, left, texts in page_lines(page, cols):
            opener = any(OPENS_BLOCK.search(t) and not is_sub_route(last_line[i].replace('LEPASAN ', '', 1))
                         and not last_line[i].startswith('LEPASAN ')
                         for i, t in enumerate(texts) if t)
            if opener or block is None:
                if block is None or block['programmes'] or any(lines for col in block['columns'] for _, lines in col):
                    block = new_block()
            if left:
                if ROW_START.match(left):
                    block['programmes'].append([left])
                elif block['programmes']:
                    block['programmes'][-1].append(left)
                elif FACULTY_LEFT.match(left):
                    block['faculty'].append(left)
            for i, text in enumerate(texts):
                # A faculty label drawn on the same line ("TIDAK DITAWARKAN FAKULTI PENGURUSAN (FM)").
                text = re.sub(r'\s+FAKULTI\s+[A-Z][A-Z &,()-]*$', '', text) if text else text
                if not text:
                    continue
                if is_sub_route(text):
                    block['columns'][i].append((route_for(text), []))
                    text = 'LEPASAN ' + text  # the "Memenuhi ..." band after it is not a new block
                elif re.match(r'^\s*FAKULTI\b', text) and text.upper() == text:
                    pass  # a faculty label drawn across the column edge
                elif not HEADER_WORDS.search(text):
                    block['columns'][i][-1][1].append(text)
                last_line[i] = text
        previous_routes = routes
    # A block with no programme of its own continues the block before it.
    merged = []
    for block in blocks:
        if not block['programmes'] and merged:
            for column, extra in zip(merged[-1]['columns'], block['columns']):
                for route, lines in extra:
                    if lines and column[-1][0] != route:
                        column.append((route, list(lines)))
                    elif lines:
                        column[-1][1].extend(lines)
            merged[-1]['pages'] += [p for p in block['pages'] if p not in merged[-1]['pages']]
        elif block['programmes']:
            merged.append(block)
    return merged, unread


def programme_list(pages):
    """{code: Malay name} from the 'SENARAI PENAWARAN PROGRAM' pages (layout text)."""
    found, active = {}, False
    for page in pages:
        if LIST_PAGE.search(page.text):
            active = True
        elif active and (TABLE_PAGE.search(page.text) or not CODE.search(page.text)):
            if found:
                break
            continue
        if not active:
            continue
        lines = page.text.split('\n')
        for i, line in enumerate(lines):
            code = code_in(line)
            if not code:
                continue
            m = CODE.search(line)
            parts = [line[m.end():]]
            above = lines[i - 1] if i else ''
            if not re.search(r'SARJANA', parts[0]) and re.search(r'SARJANA', above) and not code_in(above):
                parts.insert(0, above)
            for nxt in lines[i + 1:i + 3]:
                if code_in(nxt) or re.search(r'SARJANA|FAKULTI|SEKOLAH|KAMPUS|INSTITUT', nxt) or not nxt.strip():
                    break
                parts.append(nxt)
            text = ' '.join(re.split(r'\s{3,}[-/]', part)[0] for part in parts)
            text = re.sub(r'^\s*\d{1,3}\s+', '', re.sub(r'\s+', ' ', text)).strip(' #')
            text = re.sub(r'(?:\s+[-/]+)+\s*$', '', text).strip(' #')
            found.setdefault(code, text)
    return found


def resolve_code(left_text, listing):
    """The row's code when its name agrees with the programme list; else the list
    entry whose name matches the row's name; else None."""
    printed = code_in(left_text)
    name = ' '.join(norm(re.split(r'\bUT\s?\d', left_text)[0]))

    def similarity(code):
        return SequenceMatcher(None, name, ' '.join(norm(listing.get(code, '')))).ratio()

    # A near-identical spelling still agrees ("Geoinfomatik" in a table, "GEOINFORMATIK" in the list).
    if printed in listing and similarity(printed) >= 0.85:
        return printed
    scored = sorted(((similarity(code), code) for code in listing), reverse=True)
    if scored and scored[0][0] >= 0.9 and (len(scored) == 1 or scored[1][0] < scored[0][0] - 0.05):
        return scored[0][1]
    return None


def book_programmes(pages):
    """{code: {'name', 'semesters', 'faculty', 'sections', 'issues'}} from the book."""
    listing = programme_list(pages)
    blocks, unread = faculty_blocks(pages)
    words = document_words(pages)
    found = {code: {'name': name, 'semesters': None, 'faculty': None, 'sections': [], 'issues': []}
             for code, name in listing.items()}
    for block in blocks:
        sections = []
        for column in block['columns']:
            for route, lines in column:
                text = mend_words(tidy('\n'.join(lines)), words)
                if text and route:
                    sections.append((route, text))
        for left_lines in block['programmes']:
            left = mend_words(' '.join(left_lines), words)
            code = resolve_code(left, listing)
            if code is None:
                continue
            entry = found[code]
            semesters = SEMESTERS.search(left)
            if semesters and entry['semesters'] is None:
                entry['semesters'] = int(semesters.group(1))
            entry['faculty'] = entry['faculty'] or clean(' '.join(block['faculty'])) or None
            for route, text in sections:
                if any(r == route for r, _ in entry['sections']):
                    entry['issues'].append('ambiguous_requirement_table')
                    continue
                entry['sections'].append((route, text))
    for entry in found.values():
        if not entry['sections']:
            entry['issues'].append('missing_entry_requirements')
    return found, unread


def career_list(text):
    """Comma- or line-separated job titles become a list; a descriptive sentence stays whole."""
    items = []
    for line in [l.strip() for l in text.split('\n') if l.strip()]:
        parts = [p.strip().rstrip('.') for p in re.split(r'[,;]', line) if p.strip()]
        if parts and all(len(p.split()) <= 6 for p in parts):
            items += parts
        else:
            items.append(line.rstrip('.'))
    return list(dict.fromkeys(i for i in items if i))[:40]


def page_details(soup):
    """English name, UPU code, faculty, overview, careers and general requirement sections."""
    name = clean(soup.find('h1').get_text(' ', strip=True)) if soup.find('h1') else ''
    code_label = soup.find(string=re.compile(r'^\s*UPU Code\s*$'))
    code = None
    if code_label is not None:
        holder = code_label.find_parent(class_='utm-code-item') or code_label.parent.parent
        code = code_in(holder.get_text(' ', strip=True))
    faculty = None
    for card in soup.select('.utm-info-card'):
        label = card.select_one('.utm-info-label')
        if label and label.get_text(strip=True) == 'Faculty':
            faculty = clean(card.get_text(' ', strip=True).replace('Faculty', '', 1))
    accordions = {}
    for item in soup.select('.utm-accordion-item'):
        header = item.select_one('.utm-accordion-header')
        body = item.select_one('.utm-accordion-body')
        if header is not None and body is not None:
            accordions[clean(header.get_text(' ', strip=True)).rstrip('+').strip()] = body
    overview_el = accordions.get('About the Programme')
    overview = clean(overview_el.get_text(' ', strip=True)) if overview_el is not None else None
    careers_el = accordions.get('Career Prospects')
    careers = career_list(careers_el.get_text('\n', strip=True)) if careers_el is not None else []
    general = []
    entry = accordions.get('Entry Requirements')
    if entry is not None:
        category, heading, lines = None, None, []

        def flush():
            if category and heading and lines:
                route = ('International applicants' if category != LOCAL
                         else GENERAL_ROUTE if heading.startswith('General') else 'Programme conditions')
                general.append({'applicant_category': category, 'route': route,
                                'heading': heading, 'text': '\n'.join(lines)})

        # Headings and requirements are <br>-separated lines inside <p> elements.
        for raw in entry.get_text('\n').split('\n'):
            text = clean(raw)
            if not text or set(text) <= set('"\'“”'):
                continue
            if re.fullmatch(r'For (Malaysian|International) Students', text):
                flush()
                category, heading, lines = (LOCAL if 'Malaysian' in text else 'International'), None, []
            elif re.fullmatch(r'General Entry Requirements|Special Requirements for the Program(me)?', text):
                flush()
                heading, lines = text, []
            elif category and heading:
                lines.append(text)
        flush()
    return {'name': name, 'code': code, 'faculty': faculty, 'overview': overview,
            'careers': careers, 'general': general}


class UTMCourseAdapter:
    source = 'utm'
    canonical_url = get_source('utm').canonical_url

    def discover(self, fetch):
        index = fetch(REQUIREMENTS_PAGE)
        books = []
        for anchor in soup_for(index).find_all('a', href=True):
            try:
                url = self.canonical_url(anchor['href'], index.final_url)
            except ValueError:
                continue
            if BOOK_LINK.search(urlsplit(url).path):
                books.append(url)
        if not books:
            yield SourceFailure(index.final_url, 'Requirement book link not found')
            return
        book_url = sorted(set(books))[-1]
        try:
            pdf = fetch(book_url, 'pdf')
        except FetchError as error:
            yield SourceFailure(book_url, str(error))
            return
        book_url = self.canonical_url(pdf.final_url)
        programmes, unread = book_programmes(pdf.pages)
        for page_number in unread:
            yield SourceFailure(book_url, f'Requirement table page {page_number} could not be read')
        sessions = list(dict.fromkeys(normalise_session(m) for p in pdf.pages for m in SESSION.findall(p.text)))
        if not programmes:
            yield SourceFailure(book_url, 'No programmes found in the requirement book')
            return

        # Match programme pages to the book by the UPU code printed on each page.
        pages_by_code, lookup_failed = {}, False
        try:
            sitemap = fetch(SITEMAP, 'xml')
            locs = re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', sitemap.html)
        except FetchError:
            locs, lookup_failed = [], True
        for loc in locs:
            try:
                url = self.canonical_url(loc)
            except ValueError:
                continue  # postgraduate programmes are outside the allow-list
            try:
                details = page_details(soup_for(fetch(url)))
            except FetchError:
                lookup_failed = True
                continue
            if details['code'] in programmes and details['code'] not in pages_by_code:
                pages_by_code[details['code']] = url
        for code, entry in programmes.items():
            yield ProgrammeReference(f'degree:{code}', pages_by_code.get(code, book_url), 'degree',
                                     {'code': code, 'book_url': book_url, 'sessions': sessions,
                                      'page_lookup_failed': lookup_failed and code not in pages_by_code, **entry})

    def parse(self, reference, fetch):
        context = reference.context
        if context.get('page_lookup_failed'):
            # Without its page the programme would lose its English name; keep the
            # published version rather than switch languages for one run.
            raise FetchError('Programme page lookup failed')
        details = None
        if reference.source_url != context['book_url']:
            doc = fetch(reference.source_url)
            details = page_details(soup_for(doc))
            if details['code'] != context['code']:
                raise ValueError('Programme page code changed')
        name = (details or {}).get('name') or context['name'].title().replace(' Dengan ', ' dengan ')
        semesters = context.get('semesters')
        sections = [{'applicant_category': LOCAL, 'route': route, 'heading': 'Keperluan khas program',
                     'text': text, 'source_url': context['book_url']} for route, text in context['sections']]
        for section in (details or {}).get('general', []):
            sections.append({**section, 'source_url': reference.source_url})
        return finalise_candidate(
            reference,
            get_source('utm'),
            {
                'name': name,
                'field_of_study': field_for_name(name) or field_for_name(context['name']),
                'duration_months': semesters * 6 if semesters and 0 < semesters <= 16 else None,
                'programme_overview': (details or {}).get('overview'),
                'career_prospects': (details or {}).get('careers', []),
                'entry_requirement_sections': sections,
            },
            {
                'upu_code': context['code'],
                'malay_name': context['name'],
                'faculty': (details or {}).get('faculty') or context.get('faculty'),
                'requirement_book': context['book_url'],
                'applicant_category_basis': 'UTM local requirement book; international criteria from the programme page',
                'sessions': context.get('sessions', []),
            },
            list(context.get('issues', [])),
        )
