"""UniSZA official programme pages (WordPress). No admission inference.

Discovery: the official XML sitemap of the "our-faculties" post type lists
every programme; the allow-list admits only bachelor, B.Tech, diploma and
foundation slugs, so master's and doctoral posts are never fetched.
Each programme page has an Elementor tab titled "Entry Requirement" whose
bold paragraphs (STPM, MATRICULATION / FUNDAMENTAL CATEGORY, SPM ...) label
the routes that follow.
"""
import re
from urllib.parse import urlsplit
from scraper.course_adapter import ProgrammeReference, SourceFailure
from scraper.course_sources import get_source
from .course_common import soup_for, clean, field_for_name, finalise_candidate

SITEMAP = 'https://www.unisza.edu.my/wp-sitemap-posts-our-faculties-1.xml'
LOCAL = 'Local'
DEFAULT_ROUTE = 'General entry requirements'
LEVELS = (('bachelor-', 'degree'), ('b-tech-', 'degree'), ('diploma-', 'diploma'), ('foundation-', 'foundation'))


def level_for(slug):
    return next((level for prefix, level in LEVELS if slug.startswith(prefix)), None)


# Bold text starts a new route only when it names a qualification route.
# Connectors ("AND", "OR") and sub-labels ("University Requirement") stay in the text.
ROUTE_WORDS = re.compile(r'\b(STPM|MATRIC\w*|FOUNDATION|FUNDAMENTAL|ASASI|DIPLOMA|SPM|STAM|DVM|INTERNATIONAL|ANTARABANGSA|LOCAL|TEMPATAN)\b', re.I)
INTERNATIONAL_HEADING = re.compile(r'\b(INTERNATIONAL|ANTARABANGSA)\b', re.I)
INTERNATIONAL_TEXT = re.compile(r'\b(IELTS|TOEFL|A-?\s?Level|GCE|Senior High School|Senior Secondary School)\b', re.I)


def _is_bold_paragraph(element):
    if element.name != 'p':
        return False
    text = element.get_text(' ', strip=True)
    bold = ' '.join(b.get_text(' ', strip=True) for b in element.find_all(['strong', 'b']))
    return bool(text) and text == bold and len(text) <= 120


ACRONYMS = re.compile(r'\b(Stpm|Spm|Stam|Dvm|Kpm|Muet|Ipts|Ilka|Uitm|Ukm|Um)\b')


def tidy_label(label):
    """'STPM CATEGORY' -> 'STPM Category'; mixed-case source labels are kept."""
    if not label.isupper():
        return label
    return ACRONYMS.sub(lambda m: m.group(1).upper(), label.title())


def _is_route_heading(element):
    """A bold paragraph naming a route, e.g. <p><strong>STPM</strong></p>."""
    return _is_bold_paragraph(element) and bool(ROUTE_WORDS.search(element.get_text(' ', strip=True)))


def _block_text(element):
    items = element.find_all('li')
    if items:
        lines = []
        for li in items:
            # Nested lists repeat their text in the parent <li>; keep the innermost.
            if li.find(['ul', 'ol']):
                own = ''.join(t for t in li.find_all(string=True, recursive=False)).strip()
                if own:
                    lines.append(clean(own))
                continue
            lines.append(clean(li.get_text(' ', strip=True)))
        return '\n'.join(line for line in lines if line)
    return clean(element.get_text(' ', strip=True))


def requirement_sections(content, source_url):
    """Returns (sections, issues). Never labels international criteria as local."""
    sections, current, issues = [], None, []
    for child in content.find_all(recursive=False):
        text = child.get_text(' ', strip=True)
        if not text:
            continue
        if _is_route_heading(child):
            label = clean(text).rstrip(':')
            category = 'International' if INTERNATIONAL_HEADING.search(label) else LOCAL
            current = {'applicant_category': category, 'route': tidy_label(label),
                       'heading': label, 'text': '', 'source_url': source_url}
            sections.append(current)
            continue
        if current is None:
            current = {'applicant_category': LOCAL, 'route': DEFAULT_ROUTE, 'heading': DEFAULT_ROUTE,
                       'text': '', 'source_url': source_url}
            sections.append(current)
        block = _block_text(child)
        if block:
            current['text'] = (current['text'] + '\n' + block).strip()
    sections = [s for s in sections if s['text']]
    if any(s['applicant_category'] == LOCAL and INTERNATIONAL_TEXT.search(s['text']) for s in sections):
        # International criteria sit under no international heading: hold for review.
        issues.append('ambiguous_requirement_categories')
    return sections, issues


def duration_months_from(text):
    """'Duration of study: 4 years', '3½ years', '3 and half year'. Anything else: unknown."""
    found = set()
    for m in re.finditer(r'Duration of study\s*:\s*(\d{1,2})\s*(½|and (?:a )?half)?\s*(years?|months?)\b', text, re.I):
        value = int(m.group(1))
        if m.group(3).lower().startswith('year'):
            value = value * 12 + (6 if m.group(2) else 0)
        found.add(value)
    if len(found) != 1:
        return None
    months = found.pop()
    return months if 0 < months <= 240 else None


class UniSZACourseAdapter:
    source = 'unisza'
    canonical_url = get_source('unisza').canonical_url
    # UniSZA intermittently drops connections from GitHub's US runners when pages
    # are requested every 2 s; 5 s between requests (about 3 extra minutes per run).
    crawl_delay = 5

    def discover(self, fetch):
        doc = fetch(SITEMAP, 'xml')
        seen = set()
        for loc in re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', doc.html):
            try:
                url = self.canonical_url(loc, doc.final_url)
            except ValueError:
                continue  # master's, doctoral and other posts are outside the allow-list
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
        issues = []
        raw_title = soup.title.get_text(' ', strip=True) if soup.title else ''
        name = clean(re.sub(r'\s*[–-]\s*UniSZA\s*$', '', raw_title))
        tab = next((t for t in soup.select('.elementor-tab-title') if t.get_text(' ', strip=True).casefold() == 'entry requirement'), None)
        content = soup.find(id=tab.get('aria-controls')) if tab is not None and tab.get('aria-controls') else None
        sections, section_issues = requirement_sections(content, reference.source_url) if content is not None else ([], [])
        issues += section_issues
        duration = duration_months_from(soup.get_text(' ', strip=True))
        faculty = next((h.get_text(' ', strip=True) for h in soup.find_all('h2') if h.get_text(strip=True)), None)
        return finalise_candidate(
            reference,
            get_source('unisza'),
            {
                'name': name,
                'field_of_study': field_for_name(name),
                'duration_months': duration,
                'entry_requirement_sections': sections,
            },
            {
                'faculty': clean(faculty) if faculty else None,
                'applicant_category_basis': 'Routes are Malaysian qualifications (SPM, STPM, Matriculation, Diploma)',
                'sessions': [],
            },
            issues,
        )
