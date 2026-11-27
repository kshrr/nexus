"""Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA) admission site (Joomla /
SP Page Builder). No admission inference.

Discovery: the "ug-programme" index links every undergraduate programme page under
/undergraduate-study/<category>/<programme>; diploma and bachelor programmes are
told apart by the programme's own name. A programme's identity is its page path:
the printed UPU code is kept only as evidence because the site reuses some codes
(UJ6523002 for two Mechatronics pages, UJ6521002 for Machining and Welding).

Each page has a facts table (College, Durations, Campus, UPU Code, UMPSA code) and,
under "Entry Requirements", one button per route ("STPM Holder", "Diploma Holder",
"DKM / DLKM Holder" ...) that opens a pop-up holding that route's requirements.
Button and pop-up are paired by id; the text is kept verbatim, including the general
"MEMENUHI SYARAT AM UNIVERSITI ... SERTA KEPERLUAN KHAS PROGRAM" wording.
"""
import re
from urllib.parse import urlsplit
from bs4 import BeautifulSoup
from scraper.course_adapter import ProgrammeReference, SourceFailure
from scraper.course_sources import get_source
from .course_common import soup_for, clean, field_for_name, finalise_candidate

INDEX = 'https://admission.umpsa.edu.my/ug-programme'
LOCAL = 'Local'
YEARS = re.compile(r'\(\s*(\d+)(?:\s*(1/2|\.5))?\s*Years?(?:\s*(?:and\s*)?(\d+)\s*Months?)?\s*\)', re.I)


def duration_months_from(text):
    """'8 Semester ( 4 Year )', '( 3 1/2 Year )', '( 2 Year 9 Month )', '( 2 Years and 5 Months)'."""
    found = set()
    for m in YEARS.finditer(text or ''):
        found.add(int(m.group(1)) * 12 + (6 if m.group(2) else 0) + int(m.group(3) or 0))
    if len(found) != 1:
        return None
    months = found.pop()
    return months if 0 < months <= 240 else None


def facts(soup):
    """{label: value} from the programme info table ("UPU Code | : | UJ6525003")."""
    found = {}
    for row in soup.select('table tr'):
        cells = [clean(td.get_text(' ', strip=True)) for td in row.find_all('td')]
        cells = [c for c in cells if c and c != ':']
        if len(cells) >= 2 and len(cells[0]) <= 30:
            found.setdefault(cells[0], clean(' '.join(cells[1:]).lstrip(': ')))
    return found


def modal_text(modal):
    lines = []
    for element in modal.find_all(['p', 'li', 'h3', 'h4', 'h5', 'td']):
        if element.find(['p', 'li', 'td']):
            continue
        text = clean(element.get_text(' ', strip=True))
        if text and (not lines or lines[-1] != text):
            lines.append(text)
    return '\n'.join(lines) or clean(modal.get_text(' ', strip=True))


def requirement_sections(soup, source_url):
    sections = []
    for button in soup.select('a.sppb-btn[id$="-selector"]'):
        route = clean(button.get_text(' ', strip=True))
        modal = soup.find(id=button['id'][:-len('-selector')])
        if not route or modal is None:
            continue
        text = modal_text(modal)
        if text and not any(s['route'] == route for s in sections):
            sections.append({'applicant_category': LOCAL, 'route': route, 'heading': 'Entry Requirements',
                             'text': text, 'source_url': source_url})
    return sections


def tab_pane(soup, title):
    link = next((a for a in soup.select('ul.sppb-nav-tabs a') if clean(a.get_text(' ', strip=True)) == title), None)
    target = link.get('aria-controls') or (link.get('href') or '').lstrip('#') if link is not None else None
    return soup.find(id=target) if target else None


def career_list(soup):
    pane = tab_pane(soup, 'Career Path')
    if pane is None:
        return []
    items = [clean(li.get_text(' ', strip=True)).rstrip('.') for li in pane.find_all('li')]
    return list(dict.fromkeys(i for i in items if i and len(i.split()) <= 10))[:40]


class UMPSACourseAdapter:
    source = 'umpsa'
    canonical_url = get_source('umpsa').canonical_url

    def discover(self, fetch):
        doc = fetch(INDEX)
        seen = set()
        for anchor in soup_for(doc).find_all('a', href=True):
            try:
                url = self.canonical_url(anchor['href'], doc.final_url)
            except ValueError:
                continue
            path = urlsplit(url).path
            if not path.startswith('/undergraduate-study/') or url in seen:
                continue
            seen.add(url)
            # Every diploma sits in a category folder naming it ("diploma-engineering",
            # "applied-science-diploma", and the site's own typo "dipoma-computer-2").
            category = path.split('/')[2]
            level = 'diploma' if re.search(r'dip(?:l)?oma', category) else 'degree'
            yield ProgrammeReference(f"{level}:{path.strip('/').split('/', 1)[1]}", url, level, {})
        if not seen:
            yield SourceFailure(doc.final_url, 'No supported programme links found')

    def parse(self, reference, fetch):
        doc = fetch(reference.source_url)
        if self.canonical_url(doc.final_url) != reference.source_url:
            raise ValueError('Programme redirect changed identity')
        soup = soup_for(doc)
        title = soup.title.get_text(' ', strip=True) if soup.title else ''
        name = clean(re.sub(r'^\s*UMPSA Admission\s*-\s*', '', title))
        # The programme info table sits inside a <nav> element, which soup_for removes.
        info = facts(BeautifulSoup(doc.html, 'html.parser'))
        description = soup.find('meta', attrs={'name': 'description'})
        overview = clean(description.get('content', '')) if description is not None else ''
        return finalise_candidate(
            reference,
            get_source('umpsa'),
            {
                'name': name,
                'field_of_study': field_for_name(name),
                'duration_months': duration_months_from(info.get('Durations')),
                'programme_overview': overview or None,
                'career_prospects': career_list(soup),
                'entry_requirement_sections': requirement_sections(soup, reference.source_url),
            },
            {
                'upu_code': info.get('UPU Code'),
                'umpsa_code': info.get('UMPSA code'),
                'faculty': info.get('College'),
                'campus': info.get('Campus'),
                'applicant_category_basis': 'UMPSA "Malaysian Student" admission pages (local routes)',
                'sessions': [],
            },
            [],
        )
