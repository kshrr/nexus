"""Sunway College programme pages (Drupal). No admission inference.

Discovery: the XML sitemap; only diploma pages under /programmes/diploma-studies/
<area>/ and the Sunway foundations and Monash University Foundation Year under
/programmes/pre-university-foundation/ are admitted (A Level, AUSMAT, CIMP and
professional accounting are pre-university or professional, not foundation or
diploma). Some sitemap entries are empty placeholders for programmes now run by
Sunway University (their pages carry no title and no entry requirements; one's
canonical link points to the university's site): discovery fetches each page and
skips those, rather than reporting a programme that the page does not describe.

Each programme page has an "Entry Requirements" block holding a table: a header
row ("Pre-existing qualification" / "Academic Requirements"), then one cell per
route, a bold route name followed by its requirement lines, kept verbatim. Only
an "English Language Requirement" cell marked "For International Students only"
is stored as International; mixed cells (e.g. "Specific Requirements" that also
carry a local Mathematics note) stay Local with their wording intact.
"""
import re
from urllib.parse import urlsplit
from scraper.course_adapter import ProgrammeReference, SourceFailure
from scraper.course_sources import get_source
from scraper.public_http import FetchError
from .course_common import soup_for, clean, field_for_name, finalise_candidate

SITEMAP = 'https://sunwaycollege.edu.my/sitemap.xml'
LOCAL, INTERNATIONAL = 'Local', 'International'
INTERNATIONAL_ONLY = re.compile(r'For International Students only', re.I)
DURATION = re.compile(r'^(?:(\d+(?:\.5)?)\s*Years?)?\s*(?:(?:and\s*)?(\d+)\s*Months?)?$', re.I)


def level_for(path):
    return 'foundation' if '/pre-university-foundation/' in path else 'diploma'


def entry_block(soup):
    heading = soup.find(lambda t: t.name in ('h2', 'h3') and clean(t.get_text(' ', strip=True)) == 'Entry Requirements')
    return heading.find_parent(class_='paragraph') if heading is not None else None


def is_programme_page(soup):
    return soup.find('h1') is not None and entry_block(soup) is not None


def requirement_sections(soup, source_url):
    block = entry_block(soup)
    sections = []
    if block is None:
        return sections
    for cell in block.select('td'):
        label_el = cell.find(['strong', 'b'])
        if label_el is None:
            continue  # the header row ("Pre-existing qualification", "Academic Requirements")
        label = clean(label_el.get_text(' ', strip=True))
        lines = []
        for element in cell.find_all(['p', 'li']):
            if element.find(['p', 'li']):
                continue
            text = clean(element.get_text(' ', strip=True))
            if text and text != label:
                lines.append(text)
        if not label or not lines:
            continue
        english_only = label.lower().startswith('english language requirement') and INTERNATIONAL_ONLY.search(cell.get_text(' ', strip=True))
        sections.append({'applicant_category': INTERNATIONAL if english_only else LOCAL, 'route': label,
                         'heading': 'Entry Requirements', 'text': '\n'.join(lines), 'source_url': source_url})
    return sections


def fact(soup, label):
    """Value next to a facts-table label ("Duration" -> "2 Years")."""
    cell = soup.find(lambda t: t.name in ('td', 'th') and clean(t.get_text(' ', strip=True)) == label)
    following = cell.find_next_sibling(['td', 'th']) if cell is not None else None
    return clean(following.get_text(' ', strip=True)) if following is not None else None


def duration_months_from(text):
    """'2 Years', '2.5 Years', '12 months'. Anything else: unknown."""
    m = DURATION.match((text or '').strip())
    if not m or not (m.group(1) or m.group(2)):
        return None
    months = round(float(m.group(1) or 0) * 12) + int(m.group(2) or 0)
    return months if 0 < months <= 240 else None


class SunwayCollegeCourseAdapter:
    source = 'sunway_college'
    canonical_url = get_source('sunway_college').canonical_url

    def discover(self, fetch):
        doc = fetch(SITEMAP, 'xml')
        seen = set()
        for loc in re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', doc.html):
            try:
                url = self.canonical_url(loc, doc.final_url)
            except ValueError:
                continue  # news, pre-university, professional and other pages
            if url in seen:
                continue
            seen.add(url)
            try:
                page = soup_for(fetch(url))
            except FetchError:
                page = None  # unreachable now: let parse keep or report it
            if page is not None and not is_programme_page(page):
                continue  # an empty placeholder (programme moved to Sunway University)
            path = urlsplit(url).path
            level = level_for(path)
            yield ProgrammeReference(f"{level}:{path.rstrip('/').rsplit('/', 1)[-1]}", url, level, {})
        if not seen:
            yield SourceFailure(doc.final_url, 'No supported programme links found')

    def parse(self, reference, fetch):
        doc = fetch(reference.source_url)
        if self.canonical_url(doc.final_url) != reference.source_url:
            raise ValueError('Programme redirect changed identity')
        soup = soup_for(doc)
        heading = soup.find('h1')
        # The heading breaks before its abbreviation: "Monash University Foundation Year\n(MUFY)".
        name = re.sub(r'\(\s+', '(', re.sub(r'\s+', ' ', heading.get_text(' ', strip=True))).strip() if heading else ''
        description = soup.find('meta', attrs={'name': 'description'})
        overview = clean(description.get('content', '')) if description is not None else ''
        return finalise_candidate(
            reference,
            get_source('sunway_college'),
            {
                'name': name,
                'field_of_study': field_for_name(name),
                'duration_months': duration_months_from(fact(soup, 'Duration')),
                'programme_overview': overview or None,
                'career_prospects': [],
                'entry_requirement_sections': requirement_sections(soup, reference.source_url),
            },
            {
                'intakes': fact(soup, 'Intakes'),
                'applicant_category_basis': 'Sunway College routes apply to all applicants (Local); English rows marked '
                                            '"For International Students only" are International',
                'sessions': [],
            },
            [],
        )
