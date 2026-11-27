"""Multimedia University (MMU) official programme pages (WordPress). No admission inference.

Discovery: MMU's Yoast "courses" sitemap lists every programme page; only
foundation, diploma and bachelor slugs under the registered programme paths are
kept, so master's, doctoral and professional programmes are never fetched. A
sitemap entry outside the registered paths (e.g. a broken ``%academic%``
permalink) is skipped, never guessed into a different address.

Each programme page has a ``ul.course-dropdown`` whose items are sections: a
link with the section title, then the content. "Entry Requirements" lists
Malaysian qualifications (SPM, STPM, Matriculation, Diploma, UEC ...) and is
stored as Local; a separate "Entry Requirements (International)" section is
stored as International. Requirement text is kept verbatim, line by line.

Duration is read only from an explicit "N-year programme" phrase in the
programme overview, and only when the overview states one value.
"""
import re
from urllib.parse import urlsplit
from scraper.course_adapter import ProgrammeReference, SourceFailure
from scraper.course_sources import get_source
from .course_common import soup_for, clean, field_for_name, finalise_candidate

SITEMAP = 'https://www.mmu.edu.my/courses-sitemap.xml'
LEVELS = (('bachelor-', 'degree'), ('diploma-', 'diploma'), ('foundation-', 'foundation'))
LOCAL_ROUTE = 'All qualifications'
MQA_LINE = re.compile(r'\bMQA\b|\(R\d?/\d{3,4}/', re.I)
BUTTON_LINE = re.compile(r'ENQUIRE NOW|HOW TO APPLY|DOWNLOAD BROCHURE', re.I)
INTERNATIONAL_TEXT = re.compile(r'\b(IELTS|TOEFL|Senior High School|Senior Secondary School)\b', re.I)
NUMBERS = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6}
DURATION = re.compile(
    r'\b(one|two|three|four|five|six|[1-6])(-and-a-half|[- ]and[- ]a[- ]half)?[- ]years?'
    r'(?=[- ](?:full[- ]time\s+)?(?:programme|program|degree|diploma|course|foundation)\b)', re.I)


def level_for(slug):
    return next((level for prefix, level in LEVELS if slug.startswith(prefix)), None)


def duration_months_from(overview):
    """'This three-year programme', 'a two-and-a-half-year programme'. Several values: unknown."""
    found = set()
    for m in DURATION.finditer(overview or ''):
        word = m.group(1).lower()
        years = NUMBERS.get(word) or int(word)
        found.add(years * 12 + (6 if m.group(2) else 0))
    return found.pop() if len(found) == 1 else None


def section_lines(content):
    """Verbatim lines of one dropdown section: each innermost list item or paragraph."""
    lines = []
    for el in content.find_all(['li', 'p']):
        if el.find(['li', 'p']):
            own = clean(' '.join(t.strip() for t in el.find_all(string=True, recursive=False) if t.strip()))
            if own:
                lines.append(own)
            continue
        text = clean(el.get_text(' ', strip=True))
        if text:
            lines.append(text)
    if not lines:
        text = clean(content.get_text(' ', strip=True))
        if text:
            lines.append(text)
    return lines


def dropdown_sections(soup):
    """{section title: content element} from ul.course-dropdown."""
    menu = soup.find('ul', class_='course-dropdown')
    sections = {}
    if menu is None:
        return sections
    for item in menu.find_all('li', recursive=False):
        title = item.find('a', recursive=False)
        content = item.find(['ul', 'ol', 'div'], recursive=False)
        if title is not None and content is not None:
            sections.setdefault(clean(title.get_text(' ', strip=True)), content)
    return sections


def career_list(content):
    """Comma-separated job titles become a list; a descriptive sentence stays whole."""
    items = []
    for line in section_lines(content):
        line = re.sub(r'^\s*Career Prospects\s*:\s*', '', line, flags=re.I).strip()
        parts = [p.strip().rstrip('.') for p in re.split(r'[,;]', line) if p.strip()]
        if parts and all(len(p.split()) <= 6 for p in parts):
            items += parts
        elif line:
            items.append(line.rstrip('.'))
    return list(dict.fromkeys(i for i in items if i))[:40]


class MMUCourseAdapter:
    source = 'mmu'
    canonical_url = get_source('mmu').canonical_url

    def discover(self, fetch):
        doc = fetch(SITEMAP, 'xml')
        seen = set()
        for loc in re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', doc.html):
            try:
                url = self.canonical_url(loc, doc.final_url)
            except ValueError:
                continue  # postgraduate/professional programmes and broken permalinks
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
        heading = soup.find('h1')
        name = clean(heading.get_text(' ', strip=True)) if heading else ''
        header = heading.parent if heading else None
        faculty_el = header.find(class_='course-faculty') if header else None
        faculty = clean(faculty_el.get_text(' ', strip=True)) if faculty_el else None
        paragraphs = [clean(p.get_text(' ', strip=True)) for p in header.find_all('p')] if header else []
        accreditation = next((p for p in paragraphs if MQA_LINE.search(p)), None)
        overview = '\n\n'.join(p for p in paragraphs if p and p != accreditation and not BUTTON_LINE.search(p)) or None

        sections = []
        found = dropdown_sections(soup)
        for title, content in found.items():
            if not title.lower().startswith('entry requirement'):
                continue
            international = 'international' in title.lower()
            text = '\n'.join(section_lines(content))
            if not text:
                continue
            sections.append({'applicant_category': 'International' if international else 'Local',
                             'route': title if international else LOCAL_ROUTE,
                             'heading': title, 'text': text, 'source_url': reference.source_url})
        if any(s['applicant_category'] == 'Local' and INTERNATIONAL_TEXT.search(s['text']) for s in sections):
            # International qualifications under the Malaysian heading: hold for review.
            issues.append('ambiguous_requirement_categories')
        careers = next((career_list(c) for t, c in found.items() if t.lower().startswith('career prospect')), [])

        return finalise_candidate(
            reference,
            get_source('mmu'),
            {
                'name': name,
                'field_of_study': field_for_name(name),
                'duration_months': duration_months_from(overview),
                'programme_overview': overview,
                'career_prospects': careers,
                'entry_requirement_sections': sections,
            },
            {
                'faculty': faculty,
                'accreditation': accreditation,
                'applicant_category_basis': 'MMU "Entry Requirements" lists Malaysian qualifications; '
                                            '"Entry Requirements (International)" is stored separately',
                'sessions': [],
            },
            issues,
        )
