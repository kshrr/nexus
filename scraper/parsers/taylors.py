"""Taylor's University official programme pages (Adobe AEM). No admission inference.

Discovery: the site's XML sitemap lists every programme page under
/en/study/explore-all-programmes/<field>/undergraduate/. The allow-list admits only
bachelor and diploma pages there, so postgraduate, advanced-diploma, transfer and
information pages are never fetched. Foundation and pre-university programmes are
run by Taylor's College on a separate site and are not part of this source.

Each programme page has accordions titled "Prerequisites", "Entry Pathway" (or
"Entry Requirement(s)"), "English Requirements" and sometimes "Health Requirements".
Inside an accordion a fully bold paragraph names a route ("A Level", "Sijil Tinggi
Persekolahan Malaysia (STPM)", "Foundation" ...) and the lines after it are that
route's requirement, kept verbatim. Entry pathways apply to every applicant and are
stored as Local; the English requirements are split by the page itself into LOCAL
STUDENTS and INTERNATIONAL STUDENTS.
"""
import re
from urllib.parse import urlsplit
from scraper.course_adapter import ProgrammeReference, SourceFailure
from scraper.course_sources import get_source
from .course_common import soup_for, clean, field_for_name, finalise_candidate

SITEMAP = 'https://university.taylors.edu.my/en.sitemap.xml'
LEVELS = (('bachelor-', 'degree'), ('diploma-', 'diploma'))
LOCAL, INTERNATIONAL = 'Local', 'International'
# Taylor's College pages title the academic requirements "Qualifications" (and "Prerequisite").
REQUIREMENT_ACCORDION = re.compile(r'^(Prerequisites?|Qualifications|Entry (?:Pathway|Requirements?)|English Requirements|Health Requirements)$', re.I)
AUDIENCE = re.compile(r'^(LOCAL|INTERNATIONAL)\s+STUDENTS?$', re.I)
NOTE_LABEL = re.compile(r'^Notes?\s*:?$', re.I)
DURATION = re.compile(r'^(\d+(?:\.5)?)[- ]years?$', re.I)


def level_for(slug, levels=LEVELS):
    return next((level for prefix, level in levels if slug.startswith(prefix)), None)


def duration_months_from(text):
    """'3-year', '3 years', '3.5-year'. Anything else: unknown."""
    m = DURATION.match((text or '').strip())
    if not m:
        return None
    months = round(float(m.group(1)) * 12)
    return months if 0 < months <= 240 else None


def accordion_title(item):
    title = item.select_one('.accordion-title')
    if title is None:
        return ''
    # The title is rendered twice (mobile and desktop); keep one copy.
    return re.sub(r'^(.+?) \1$', r'\1', clean(title.get_text(' ', strip=True)))


def is_label(element):
    """A fully bold paragraph is a route label ("A Level", "LOCAL STUDENTS")."""
    if element.name != 'p':
        return False
    text = clean(element.get_text(' ', strip=True))
    bold = clean(' '.join(b.get_text(' ', strip=True) for b in element.find_all(['b', 'strong'])))
    return bool(text) and text.rstrip(' :') == bold.rstrip(' :') and len(text) <= 120


def accordion_groups(item):
    """[(label or None, [lines])] in page order; leaf <p>/<li> only."""
    groups = [(None, [])]
    for element in item.find_all(['p', 'li']):
        if element.find(['p', 'li']):
            continue
        text = clean(element.get_text(' ', strip=True))
        if not text:
            continue
        # A bold "AND Pass an interview ..." is a further condition, not a new route.
        if is_label(element) and not re.match(r'^(AND|OR)\b', text):
            groups.append((text.rstrip(' :'), []))
        else:
            groups[-1][1].append(text)
    return [(label, lines) for label, lines in groups if lines or label]


def requirement_sections(soup, source_url):
    sections = []
    for item in soup.select('div.accordion-item'):
        title = accordion_title(item)
        if not REQUIREMENT_ACCORDION.match(title):
            continue
        english = title.lower().startswith('english')
        category = LOCAL
        for label, lines in accordion_groups(item):
            if label and AUDIENCE.match(label):
                category = INTERNATIONAL if label.upper().startswith('INTERNATIONAL') else LOCAL
                if lines:
                    sections.append({'applicant_category': category, 'route': 'English requirements',
                                     'heading': title, 'text': '\n'.join(lines), 'source_url': source_url})
                continue
            if english:
                # Inside each audience block, bold sub-labels ("Taylor's EET") are part of the text.
                text = '\n'.join(([f'{label}:'] if label else []) + lines)
                same = [s for s in sections if s['heading'] == title and s['applicant_category'] == category]
                if same:
                    same[-1]['text'] = (same[-1]['text'] + '\n' + text).strip()
                elif text:
                    sections.append({'applicant_category': category, 'route': 'English requirements',
                                     'heading': title, 'text': text, 'source_url': source_url})
                continue
            if not lines:
                continue
            route = title if label is None else ('Notes' if NOTE_LABEL.match(label) else label)
            sections.append({'applicant_category': LOCAL, 'route': route, 'heading': title,
                             'text': '\n'.join(lines), 'source_url': source_url})
    return sections


def fact(soup, label):
    """The value printed under a facts label ("Duration" -> "3-year")."""
    node = soup.find(string=re.compile(rf'^\s*{re.escape(label)}\s*$'))
    if node is None:
        return None
    component = node.find_parent(class_='text-component')
    if component is None:
        return None
    values = [clean(t) for t in component.stripped_strings if clean(t) and clean(t) != label]
    return values[0] if values else None


def career_list(soup):
    """Job titles listed after the "Careers for ..." heading, when they are a short list."""
    heading = soup.find(['h2', 'h3'], string=re.compile(r'Careers? for', re.I))
    if heading is None:
        heading = next((h for h in soup.find_all(['h2', 'h3']) if re.search(r'Careers? for', h.get_text(' ', strip=True), re.I)), None)
    if heading is None:
        return []
    column = heading.find_parent(class_=re.compile(r'aem-GridColumn'))
    following = column.find_next_sibling() if column is not None else None
    if following is None:
        return []
    items = [clean(t) for t in following.stripped_strings]
    items = [i.rstrip('.') for i in items if i and len(i.split()) <= 8]
    return list(dict.fromkeys(items))[:40]


class TaylorsCourseAdapter:
    source = 'taylors'
    canonical_url = get_source('taylors').canonical_url
    sitemap = SITEMAP
    levels = LEVELS
    category_basis = ("Taylor's entry pathways apply to all applicants (stored as Local); "
                      'English requirements are split into local and international by the page')

    def discover(self, fetch):
        doc = fetch(self.sitemap, 'xml')
        seen = set()
        for loc in re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', doc.html):
            try:
                url = self.canonical_url(loc, doc.final_url)
            except ValueError:
                continue  # postgraduate, advanced-diploma, transfer and information pages
            slug = urlsplit(url).path.rsplit('/', 1)[-1].removesuffix('.html')
            level = level_for(slug, self.levels)
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
        title = soup.title.get_text(' ', strip=True) if soup.title else ''
        name = clean(re.sub(r"\s*\|\s*Taylor.*$", '', title))
        description = soup.find('meta', attrs={'name': 'description'})
        overview = clean(description.get('content', '')) if description is not None else None
        sections = requirement_sections(soup, reference.source_url)
        return finalise_candidate(
            reference,
            get_source(self.source),
            {
                'name': name,
                'field_of_study': field_for_name(name),
                'duration_months': duration_months_from(fact(soup, 'Duration')),
                'programme_overview': overview or None,
                'career_prospects': career_list(soup),
                'entry_requirement_sections': sections,
            },
            {
                'faculty': fact(soup, 'Offered by'),
                'intakes': fact(soup, 'Intake Month'),
                'applicant_category_basis': self.category_basis,
                'sessions': [],
            },
            [],
        )


class TaylorsCollegeCourseAdapter(TaylorsCourseAdapter):
    """Taylor's College (college.taylors.edu.my): foundation and diploma programmes on
    the same AEM platform. Academic requirements sit in a "Qualifications" accordion;
    its English requirements are not split by audience and are stored as Local."""
    source = 'taylors_college'
    canonical_url = get_source('taylors_college').canonical_url
    sitemap = 'https://college.taylors.edu.my/en.sitemap.xml'
    levels = (('foundation-', 'foundation'), ('diploma-', 'diploma'))
    category_basis = ("Taylor's College qualifications and English requirements apply to all applicants "
                      'and are not split by the page; stored as Local')
