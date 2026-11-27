"""INTI International University & Colleges programme pages (WordPress/WooCommerce).
No admission inference.

Discovery: the "product" sitemap lists every programme page under /programme/. The
allow-list admits only slugs starting with foundation, diploma or bachelor, so
master's, doctoral, A Level, transfer, partner-only and short-course pages are never
fetched.

Each page has an "entry_requirements" tab: optional bold group headings (e.g.
"Engineering Pathway", "English Requirements"), each followed by a two-column table
of entry level -> requirement, and notes. Every table row becomes one route kept
verbatim, under its group heading. The page's own note says international
applicants are assessed against equivalent qualifications, so these routes are
stored as Local. Duration is read only from the structure tab's sentence
"Programme can be completed in ...".
"""
import re
from urllib.parse import urlsplit
from scraper.course_adapter import ProgrammeReference, SourceFailure
from scraper.course_sources import get_source
from .course_common import soup_for, clean, field_for_name, finalise_candidate

SITEMAP = 'https://newinti.edu.my/wp-sitemap-posts-product-1.xml'
LEVELS = (('foundation', 'foundation'), ('diploma', 'diploma'), ('bachelor', 'degree'))
LOCAL = 'Local'
DEFAULT_HEADING = 'Entry Requirements'
COMPLETION = re.compile(r'Programme can be completed in\s+(?:Minimum\s+)?(\d+(?:\.\d+)?)\s*Years?'
                        r'(?:\s*(?:and\s*)?(\d+)\s*Months?)?', re.I)


def level_for(slug):
    return next((level for prefix, level in LEVELS if slug.startswith(prefix)), None)


def duration_months_from(text):
    """'Programme can be completed in Minimum 2 Years.' / '... 2 Years 6 Months'. Else unknown."""
    found = {round(float(m.group(1)) * 12) + int(m.group(2) or 0) for m in COMPLETION.finditer(text or '')}
    if len(found) != 1:
        return None
    months = found.pop()
    return months if 0 < months <= 240 else None


def requirement_sections(tab, source_url):
    """[{route, heading, text}] from the entry requirements tab, in page order."""
    sections, heading, english = [], DEFAULT_HEADING, []
    seen_tables = set()
    for element in tab.find_all(['strong', 'b', 'table', 'p']):
        if element.find_parent('table') is not None:
            continue
        text = clean(element.get_text(' ', strip=True))
        if element.name in ('strong', 'b'):
            if text and not re.match(r'^Notes?\s*:?$', text, re.I):
                heading = text.rstrip(':')
            continue
        if element.name == 'table':
            if id(element) in seen_tables:
                continue
            seen_tables.add(id(element))
            for row in element.find_all('tr'):
                cells = [clean(c.get_text(' ', strip=True)) for c in row.find_all(['td', 'th'])]
                if len(cells) < 2:
                    continue
                if cells[0].lower().rstrip(':') in ('entry level', 'qualification', 'qualifications'):
                    # A header row, sometimes repeated mid-tab; "Entry Level | English ..." starts
                    # the English requirements.
                    if 'english' in cells[1].lower():
                        heading = 'English Requirements'
                    continue
                level, requirement = cells[0].lstrip('*').strip(), ' '.join(cells[1:]).strip()
                if not level or not requirement:
                    continue
                if heading.lower().startswith('english'):
                    english.append(f'{level}: {requirement}')
                else:
                    sections.append({'applicant_category': LOCAL, 'route': level, 'heading': heading,
                                     'text': requirement, 'source_url': source_url})
            continue
        # Paragraphs: notes belong to the group above; headings repeated as <p> are skipped.
        if not text or text.rstrip(':') == heading or text.startswith('Requirements depend on'):
            continue
        if re.match(r'^\*?\s*Notes?\b', text, re.I) or text.startswith(('Students', 'International students')):
            target = next((s for s in reversed(sections) if s['heading'] == heading and s['route'] == 'Notes'), None)
            if heading.lower().startswith('english') and english:
                english.append(text)
            elif target is not None:
                target['text'] += '\n' + text
            else:
                sections.append({'applicant_category': LOCAL, 'route': 'Notes', 'heading': heading,
                                 'text': text, 'source_url': source_url})
    if english:
        sections.append({'applicant_category': LOCAL, 'route': 'English requirements',
                         'heading': 'English Requirements', 'text': '\n'.join(english), 'source_url': source_url})
    return sections


def career_list(tab):
    if tab is None:
        return []
    items = [clean(li.get_text(' ', strip=True)).rstrip('.') for li in tab.find_all('li')]
    return list(dict.fromkeys(i for i in items if i and len(i.split()) <= 8))[:40]


class INTICourseAdapter:
    source = 'inti'
    canonical_url = get_source('inti').canonical_url

    def discover(self, fetch):
        doc = fetch(SITEMAP, 'xml')
        seen = set()
        for loc in re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', doc.html):
            try:
                url = self.canonical_url(loc, doc.final_url)
            except ValueError:
                continue  # postgraduate, pre-university, transfer and short-course pages
            slug = urlsplit(url).path.rstrip('/').rsplit('/', 1)[-1]
            level = level_for(slug)
            if not level or slug in seen:
                continue
            seen.add(slug)
            yield ProgrammeReference(f'{level}:{slug}', url, level, {})
        if not seen:
            yield SourceFailure(doc.final_url, 'No supported programme links found')

    def parse(self, reference, fetch):
        doc = fetch(reference.source_url)
        if self.canonical_url(doc.final_url) != reference.source_url:
            raise ValueError('Programme redirect changed identity')
        soup = soup_for(doc)
        heading = soup.find('h1')
        name = clean(heading.get_text(' ', strip=True)) if heading else ''
        tab = soup.select_one('div.entry_requirements')
        sections = requirement_sections(tab, reference.source_url) if tab is not None else []
        structure = soup.select_one('div.structure')
        campus = soup.select_one('div.campus_intake')
        offered = re.search(r'Offered at ([^.]+)\.', campus.get_text(' ', strip=True)) if campus is not None else None
        description = soup.find('meta', attrs={'name': 'description'})
        overview = clean(description.get('content', '')) if description is not None else ''
        return finalise_candidate(
            reference,
            get_source('inti'),
            {
                'name': name,
                'field_of_study': field_for_name(name),
                'duration_months': duration_months_from(structure.get_text(' ', strip=True) if structure else ''),
                'programme_overview': overview or None,
                'career_prospects': career_list(soup.select_one('div.career-path')),
                'entry_requirement_sections': sections,
            },
            {
                'campuses': clean(offered.group(1)) if offered else None,
                'applicant_category_basis': "INTI's entry levels are stated for all applicants; the page notes "
                                            'international applicants are assessed on equivalent qualifications',
                'sessions': [],
            },
            [],
        )
