"""UM official undergraduate index adapter. No model or admission inference."""
import hashlib
import json
import re
from urllib.parse import urljoin, urlsplit, urlunsplit
from bs4 import BeautifulSoup
from scraper.course_models import CourseCandidate
from scraper.sanitise import strip_invisible, collapse_whitespace, neutralise

ORIGIN = 'https://study.um.edu.my/'
# Inspected faculty index labels; explicit taxonomy mappings, not scraped rules.
FACULTIES = {
    'academy-of-islamic-studies-courses': 'Islamic Studies',
    'malay-studies-courses': 'Malay Studies',
    'faculty-arts-social-science-courses': 'Arts and Social Sciences',
    'faculty-of-built-environment': 'Built Environment',
    'faculty-of-business-and-economic': 'Business and Economics',
    'faculty-of-computer-science': 'Computer Science',
    'faculty-of-creative-arts': 'Creative Arts',
    'faculty-of-dentistry': 'Dentistry',
    'faculty-of-education': 'Education',
    'faculty-of-engineering': 'Engineering',
    'faculty-of-languages-and-linguistics': 'Languages and Linguistics',
    'faculty-of-law': 'Law',
    'faculty-of-medicine': 'Medicine',
    'faculty-of-nursing': 'Nursing',
    'faculty-of-pharmacy': 'Pharmacy',
    'faculty-of-science': 'Science',
    'faculty-of-sports-and-exercise-science': 'Sports and Exercise Sciences',
}

def canonical_url(raw, base=ORIGIN):
    parts = urlsplit(urljoin(base, raw))
    if parts.scheme != 'https' or parts.hostname != 'study.um.edu.my' or parts.username or parts.password or parts.port not in (None, 443):
        raise ValueError('Not a registered official UM source URL')
    if not re.fullmatch(r'/[A-Za-z0-9-]+/?', parts.path):
        raise ValueError('Not a registered official UM catalogue path')
    return urlunsplit(('https', 'study.um.edu.my', parts.path.rstrip('/'), '', ''))

def catalogue_kind(url):
    slug = urlsplit(canonical_url(url)).path.strip('/')
    if slug == 'undergraduate-faculties': return 'index'
    if slug in FACULTIES: return 'faculty'
    if re.fullmatch(r'bachelors?-[a-z0-9-]+', slug, re.I): return 'programme'
    raise ValueError('Not a registered official UM catalogue destination')

def _clean(text):
    value = collapse_whitespace(strip_invisible(text.replace('\ufffd', ' '))).strip()
    return neutralise(value)

def _soup(document):
    canonical_url(document.final_url)
    soup = BeautifulSoup(document.html, 'html.parser')
    for node in soup(['script','style','nav','header','footer','iframe']):
        node.decompose()
    return soup

def _heading(soup, label):
    return next((h for h in soup.find_all(['h4','h3','h2']) if h.get_text(' ',strip=True).casefold() == label.casefold()), None)

def _body(heading):
    return heading.find_next_sibling() if heading else None

def _following_text(heading):
    texts = []
    for sibling in heading.next_siblings:
        if getattr(sibling, 'name', None) in ('h4','h5','h6'): break
        text = sibling.get_text('\n',strip=True) if hasattr(sibling,'get_text') else str(sibling).strip()
        if text: texts.append(text)
    return '\n'.join(texts)

def _requirements(container, default_heading, issues):
    if container is None: return []
    buttons = container.select('button[data-tab]')
    sections = []
    if not buttons:
        # Older pages with only one unlabelled stream are ambiguous; preserve
        # evidence for attention rather than assuming it applies to everyone.
        issues.append('ambiguous_requirement_categories')
        return []
    for button in buttons:
        category = button.get_text(' ', strip=True)
        if category.casefold() not in ('local','international'):
            issues.append('ambiguous_requirement_categories')
        block = container.find(id=button.get('data-tab'))
        if not block:
            issues.append('ambiguous_requirement_categories'); continue
        headings = block.find_all(['h4','h5','h6'])
        if not headings:
            text, findings = _clean(block.get_text('\n', strip=True))
            issues.extend('suspicious_source_text' for _ in findings)
            if text: sections.append({'applicant_category':category,'route':default_heading,'heading':default_heading,'text':text})
            else: issues.append('empty_requirement_section')
        for heading in headings:
            label = heading.get_text(' ', strip=True).rstrip(':')
            text, findings = _clean(_following_text(heading))
            issues.extend('suspicious_source_text' for _ in findings)
            if text and label: sections.append({'applicant_category':category,'route':label,'heading':label,'text':text})
            else: issues.append('empty_requirement_section')
    return sections

class UMCourseAdapter:
    source = 'um'
    index_url = ORIGIN + 'undergraduate-faculties'

    def __init__(self,levels=('degree','foundation','diploma')):
        self.levels=levels

    def canonical_url(self, raw, base=None):
        from scraper.course_sources import get_source
        return get_source('um').canonical_url(raw,base or ORIGIN)

    def discover(self, fetch):
        from scraper.course_adapter import ProgrammeReference, SourceFailure, BudgetExceeded
        if 'degree' in self.levels:
            try: yield from self._discover_degrees(fetch)
            except BudgetExceeded: raise
            except Exception as error: yield SourceFailure(self.index_url,str(error))
        for level,index in [('foundation','page-faculty-foundation'),('diploma','diploma-faculty-centre')]:
            if level not in self.levels:continue
            try:
                doc=fetch(ORIGIN+index)
                listing=[doc]
                if level=='diploma':
                    listing=[]
                    for anchor in _soup(doc).find_all('a',href=True):
                        slug=anchor['href'].strip('/')
                        if slug in ('dip-faculty-of-medicine','dip-faculty-of-nursing','universiti-malaya-centre-for-continuing-education'):
                            try:listing.append(fetch(ORIGIN+slug))
                            except BudgetExceeded:raise
                            except Exception as error:yield SourceFailure(ORIGIN+slug,str(error))
                count=0
                for page in listing:
                    for anchor in _soup(page).find_all('a',href=True):
                        try:url=self.canonical_url(anchor['href'],page.final_url)
                        except ValueError:continue
                        slug=urlsplit(url).path.strip('/')
                        if slug.startswith(level+'-') and slug!=index:
                            count+=1
                            yield ProgrammeReference(level+':'+slug,url,level,{})
                if not count:yield SourceFailure(ORIGIN+index,'No supported programme links found')
            except BudgetExceeded:raise
            except Exception as error:yield SourceFailure(ORIGIN+index,str(error))

    def _discover_degrees(self,fetch):
        from scraper.course_adapter import ProgrammeReference, SourceFailure, BudgetExceeded
        index = fetch(self.index_url)
        faculties = self.faculty_links(index)
        if not faculties:
            raise ValueError('No faculties found in the official catalogue index')
        for faculty in faculties:
            try:
                links = self.programme_links(fetch(faculty))
                if not links:
                    raise ValueError('No undergraduate programme links found on faculty page')
                for url in links:
                    yield ProgrammeReference(urlsplit(url).path.strip('/'), url, 'degree', {'faculty_url': faculty})
            except BudgetExceeded:
                raise
            except Exception as error:
                yield SourceFailure(faculty, str(error))

    def _links(self, document, faculty):
        soup = _soup(document)
        links = []
        for anchor in soup.find_all('a', href=True):
            try: url = canonical_url(anchor['href'], document.final_url)
            except ValueError: continue
            slug = urlsplit(url).path.strip('/')
            is_programme = slug.casefold().startswith(('bachelor-', 'bachelors-'))
            if (slug in FACULTIES if faculty else is_programme) and url not in links:
                links.append(url)
        return links

    def faculty_links(self, document):
        return self._links(document, True)

    def programme_links(self, document):
        return self._links(document, False)

    def parse(self, document, faculty_url):
        from scraper.course_adapter import ProgrammeReference
        if isinstance(document, ProgrammeReference):
            reference, fetch = document, faculty_url
            if reference.pathway_type!='degree':return self._parse_pathway(reference,fetch)
            result = self.parse(fetch(reference.source_url), reference.context['faculty_url'])
            if result.source_url != reference.source_url:
                raise ValueError('Programme redirect changed identity')
            return result
        url = canonical_url(document.final_url)
        if catalogue_kind(url) != 'programme': raise ValueError('Not an official UM degree programme destination')
        soup = _soup(document)
        issues = []
        headings = soup.find_all('h3') + soup.find_all('h2') + soup.find_all('h1')
        title = next((heading for heading in headings if re.match(r'^bachelor\b',heading.get_text(' ',strip=True),re.I)),headings[0] if headings else None)
        name, findings = _clean(title.get_text(' ', strip=True) if title else '')
        if not re.match(r'^bachelor\b',name,re.I): issues.append('missing_degree_name')
        if findings: issues.append('suspicious_source_text')
        if name.isupper():
            name = name.title()
            for word in ('Of','And','With','In','The'): name = name.replace(' '+word+' ', ' '+word.lower()+' ')
            name = name.replace('(Ai)','(AI)').replace('(Mbbs)','(MBBS)')
        slug = urlsplit(faculty_url).path.strip('/')
        field = FACULTIES.get(slug, '')
        if field == 'Built Environment' and 'architecture' in name.casefold(): field = 'Architecture'
        if field == 'Creative Arts' and 'design' in name.casefold(): field = 'Design'
        if field == 'Medicine' and 'biomedical' in name.casefold(): field = 'Biomedical Science'
        if field == 'Computer Science' and 'data science' in name.casefold(): field = 'Data Science'
        if not field: issues.append('unmapped_field')
        overview_block = _body(_heading(soup,'Programme Overview'))
        overview, findings = _clean(overview_block.get_text('\n',strip=True) if overview_block else '')
        if findings: issues.append('suspicious_source_text')
        durations = re.findall(r'(\d+(?:\.\d+)?)\s*(years?|months?)', overview, re.I)
        duration_values = {float(value)*(12 if unit.lower().startswith('year') else 1) for value,unit in durations}
        duration = next(iter(duration_values)) if len(duration_values) == 1 else None
        if re.search(r'(?:\d+(?:\.\d+)?\s*(?:[-–—]|to)\s*|(?:minimum|maximum|at least|up to|approximately|about)\s+)\d+(?:\.\d+)?\s*(?:years?|months?)', overview, re.I): duration = None
        duration = int(duration) if duration and duration.is_integer() and 0 < duration <= 240 else None
        entry = _body(_heading(soup, 'Entry Requirement'))
        if entry is None: entry = _body(_heading(soup, 'Entry Requirements'))
        sections = _requirements(entry, 'General entry requirements', issues)
        if not sections: issues.append('missing_entry_requirements')
        english = _body(_heading(soup,'English Language Requirements'))
        if english is not None: sections += _requirements(english, 'English language requirements', issues)
        requirements = '\n\n'.join(f"{s['applicant_category']} / {s['heading']}\n{s['text']}" for s in sections)
        career_block = _body(_heading(soup,'Career Prospects'))
        career_text, findings = _clean(career_block.get_text(' ',strip=True) if career_block else '')
        if findings: issues.append('suspicious_source_text')
        careers = [value.strip().rstrip('.') for value in re.split(r'[,;\n]',career_text) if value.strip()]
        record = {'name':name,'field_of_study':field,'university_name':'Universiti Malaya','university_state':'Kuala Lumpur','pathway_type':'degree',
                  'duration_months':duration,'entry_requirements':requirements,'entry_requirement_sections':sections,
                  'programme_overview':overview or None,'career_prospects':careers,'required_subject_codes':[]}
        if len(requirements) > 64000 or len(name) > 500 or len(overview) > 12000 or len(sections) > 100: issues.append('overlong_source_record')
        record['source_content_hash'] = hashlib.sha256(json.dumps(record,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        return CourseCandidate('um',urlsplit(url).path.strip('/'),url,record,
            {'faculty_url':faculty_url,'faculty_label':FACULTIES.get(slug),'programme_heading':title.get_text(' ',strip=True) if title else '',
             'entry_categories':list(dict.fromkeys(s['applicant_category'] for s in sections))},list(dict.fromkeys(issues)))

    def _parse_pathway(self,reference,fetch):
        from scraper.course_sources import get_source
        from .course_common import finalise_candidate,field_for_name,duration_months,normalise_session
        document=fetch(reference.source_url)
        if self.canonical_url(document.final_url)!=reference.source_url:raise ValueError('Programme redirect changed identity')
        soup=_soup(document);issues=[]
        title=next((h for h in soup.find_all(['h1','h2','h3']) if h.get_text(' ',strip=True).lower().startswith(reference.pathway_type)),None)
        name=_clean(title.get_text(' ',strip=True) if title else '')[0]
        if name.isupper():name=name.title()
        overview_block=_body(_heading(soup,'Programme Overview'))
        overview=_clean(overview_block.get_text(' ',strip=True) if overview_block else '')[0]
        entry=_body(_heading(soup,'Entry Requirement')) or _body(_heading(soup,'Entry Requirements'))
        sections=_requirements(entry,'General entry requirements',issues)
        labels=[normalise_session(m.group(0)) for m in re.finditer(r'(?:academic\s+session|sesi\s+akademik)\s*20\d{2}\s*[/\-]\s*20\d{2}',soup.get_text(' ',strip=True),re.I)]
        return finalise_candidate(reference,get_source('um'),{'name':name,'field_of_study':field_for_name(name),'duration_months':duration_months(overview),'programme_overview':overview or None,'entry_requirement_sections':sections},{'sessions':list(dict.fromkeys(labels))},issues)
