"""Conservative shared extraction checks; no admission-rule generation."""
import hashlib
import json
import re
from bs4 import BeautifulSoup
from scraper.course_models import CourseCandidate
from scraper.sanitise import strip_invisible, collapse_whitespace, neutralise


def clean(text):
    return neutralise(collapse_whitespace(strip_invisible(text.replace('\ufffd',' '))).strip())[0]


def soup_for(document):
    soup=BeautifulSoup(document.html,'html.parser')
    for tag in soup(['script','style','nav','footer','iframe']): tag.decompose()
    return soup


def normalise_session(text):
    match=re.search(r'\b(20\d{2})\s*[/\-]\s*(20\d{2})\b',text)
    return f'{match[1]}/{match[2]}' if match else None


def session_issues(labels,expected):
    sessions={normalise_session(value) for value in labels if value}
    sessions.discard(None)
    issues=[]
    if len(sessions)>1: issues.append('conflicting_source_session')
    if any(session<expected for session in sessions): issues.append('historical_source_session')
    return issues


def duration_months(text):
    if re.search(r'(?:minimum|maximum|approximately|up to|at least|\d+\s*[-–]\s*\d+)\s*\d*\s*(?:years?|months?)',text,re.I): return None
    values={float(n)*(12 if unit.lower().startswith(('year','tahun')) else 1) for n,unit in re.findall(r'(\d+(?:\.\d+)?)\s*(years?|months?|tahun|bulan)\b',text,re.I)}
    if len(values)!=1:return None
    value=values.pop()
    return int(value) if value.is_integer() and 0<value<=240 else None


FIELD_RULES=[
 # A teaching degree is Education even when it names a subject (UUM "Bachelor of Education (Accounting)").
 # ... and so is a degree "with Education" (UTM "Bachelor of Technology with Education (Civil Engineering)").
 ('Education',r'\bbachelor of education\b|\bwith education\b'),
 # Named IT/AI degrees are computing even when the title also says business, media or science
 # (MMU "Bachelor of Information Technology (Honours) (Business Intelligence and Analytics)").
 ('Computer Science',r'\b(?:bachelor|diploma) (?:of|in) information technology\b|artificial intelligence|intelligent robotics|\bdigital technology\b|\bsoftware engineering\b'),
 ('Arts and Social Sciences',r'foundation.*social|tamhidi.*social|preparatory.*social|\bsocial science\b|\bfoundation in arts\b'),
 ('Built Environment',r'\bbuilt environments?\b|construction management'),
 ('Computer Science',r'information and communication technology|information communications? technology|\binformatics\b'),
 # Mass communication stays media even when it names advertising, PR or brand management (Taylor's).
 ('Communication and Media',r'mass communication'),
 ('Science',r'foundation.*(?:life|physical)|preparatory.*(?:medicine|physical)|tamhidi.*sains'),
 ('Islamic Studies',r'foundation.*islamic'),
 ('Computer Science',r'computer science|computing|information security|information systems'),
 ('Data Science',r'data science'), ('Engineering',r'engineering|kejuruteraan'),
 ('Nursing',r'nursing|kejururawatan'), ('Biomedical Science',r'biomedical|medical laboratory|radiography|physiotherapy'),
 ('Pharmacy',r'pharmacy'), ('Medicine',r'medicine|medical'), ('Dentistry',r'dental|dentistry'),
 ('Accounting',r'accounting|perakaunan'), ('Business and Economics',r'business|management|muamalat|marketing|finance|tourism'),
 ('Law',r'law|shari|syariah|fiqh'), ('Languages and Linguistics',r'arabic|english language'),
 ('Education',r'education'), ('Architecture',r'architecture'),
 ('Communication and Media',r'media|communication'), ('Counselling',r'counselling'),
 ('Islamic Studies',r'quran|sunnah|akidah|qiraat|da.wah'),
 ('Science',r'science|physics|mathematics|biotechnology|chemical technology|health industry'),
 # Added for UUM, UniSZA and UTeM programme names; only database-accepted fields.
 ('Accounting',r'accountancy'),
 ('Computer Science',r'information technology|artificial intelligence|games technology|cloud computing|internet of things|\biot\b|e-commerce'),
 ('Engineering',r'mechatronic|manufactur|welding|machining|automotive|electrical|electronic|telecommunication|air conditioning|refrigeration'),
 ('Business and Economics',r'economics|entrepreneurship|technopreneurship|banking|insurance|logistics|supply chain|hospitality|event|human resource|agribusiness|risk|international trade|golf'),
 ('Communication and Media',r'multimedia|creative industry'),
 ('Design',r'design'),
 ('Arts and Social Sciences',r'history|linguistic|literature|social work|anthropology|public management|international affairs|international relations|development management|philosophy|psychology'),
 ('Islamic Studies',r'usuluddin|dakwah|islamic|al-quran'),
 ('Science',r'agricult|agro|animal|plant|food|environment|biology|chemistry|marine|polymer|dietetic|nutrition'),
 ('Creative Arts',r'animation|visual effects|cinematic|cinematograph|\bfilm\b|creative audio|3d modelling|performing arts|culinary arts|patisserie'),
 ('Business and Economics',r'actuarial'),
 ('Creative Arts',r'\bmusic\b'),
 ('Communication and Media',r'creative content'),
 ('Engineering',r'electric vehicles?|oil (?:and|&) gas'),
 ('Science',r'occupational safety'),
 ('Business and Economics',r'financial technology'),
 ('Built Environment',r'building construction'),
 ('Built Environment',r'real estate|quantity surveying|urban and regional planning|town planning|harta tanah|ukur bahan|perancangan bandar'),
 # UTeM publishes official Malay programme names.
 ('Computer Science',r'sains komputer|teknologi maklumat|kepintaran buatan|keselamatan komputer|pengkomputeran'),
 ('Business and Economics',r'pengurusan|teknousahawan|e-dagang'),
 ('Engineering',r'elektrik|elektronik|mekanikal|pembuatan|automotif|telekomunikasi|pemesinan|kimpalan|penyejukan|penyelenggaraan'),
]


def field_for_name(name):
    return next((field for field,pattern in FIELD_RULES if re.search(pattern,name,re.I)),'')


def finalise_candidate(reference,source,record,evidence,issues):
    issues=list(issues)
    record={**record,'university_name':source.name,'university_state':source.state,'pathway_type':reference.pathway_type}
    if not record.get('name'):issues.append('missing_programme_name')
    if reference.pathway_type not in source.levels:issues.append('unsupported_pathway')
    if not record.get('field_of_study'):issues.append('unmapped_field')
    sections=record.get('entry_requirement_sections',[])
    if not sections:issues.append('missing_entry_requirements')
    for section in sections:
        if not section.get('text','').strip():issues.append('empty_requirement_section')
        section.setdefault('source_url',reference.source_url)
    record['entry_requirements']='\n\n'.join(f"{s.get('applicant_category','')} / {s.get('route','')} / {s.get('heading','')}\n{s.get('text','')}" for s in sections)
    record.setdefault('duration_months',None)
    record.setdefault('programme_overview',None)
    record.setdefault('career_prospects',[])
    record.setdefault('required_subject_codes',[])
    labels=evidence.get('sessions',[])
    issues+=session_issues(labels,source.session)
    record['source_academic_session']=normalise_session(labels[0]) if labels else None
    record['source_evidence']=evidence
    text=' '.join(str(record.get(k,'')) for k in ('name','programme_overview','entry_requirements'))
    if neutralise(text)[1]:issues.append('suspicious_source_text')
    if len(record['entry_requirements'])>64000 or len(record.get('name',''))>500 or len(str(record.get('programme_overview') or ''))>12000 or len(sections)>100:
        issues.append('overlong_source_record')
    record['source_content_hash']=hashlib.sha256(json.dumps(record,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
    return CourseCandidate(source.key,reference.programme_key,reference.source_url,record,evidence,list(dict.fromkeys(issues)))
