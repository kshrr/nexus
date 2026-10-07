"""Extract evidenced programme sections; incomplete pages stay reviewable leads."""
from __future__ import annotations
import hashlib
import json
import re
from datetime import datetime
from urllib.parse import urlsplit,urljoin
from bs4 import BeautifulSoup
from .discovery_models import DiscoveryCandidate,SearchLead
from .public_http import FetchedDocument
from .search import canonicalise_url
from .sources import parser_for_url
from .sanitise import clean_text,parse_date
from .parsers.keywords import match_levels,match_fields
from .db import identity_hash

PROGRAMME=re.compile(r'scholarship|biasiswa|sponsorship|bursary|penajaan',re.I)
OPEN=re.compile(r'applications? (?:are |is )?open|permohonan (?:kini |telah )?dibuka|rolling (?:applications?|intake)',re.I)
CLOSED=re.compile(r'applications? (?:are |is )?closed|permohonan (?:telah )?ditutup',re.I)

def _clean(text,field='description'):
    value,flags=clean_text(text,field)
    return value or '',flags

def _organisation(soup,url):
    def nodes(value,depth=0):
        if depth>5: return
        if isinstance(value,list):
            for child in value[:100]: yield from nodes(child,depth+1)
        elif isinstance(value,dict):
            yield value
            for key in ('@graph','publisher','author','provider'): yield from nodes(value.get(key),depth+1)
    for script in soup.select('script[type="application/ld+json"]'):
        try: data=json.loads(script.string or script.get_text())
        except (ValueError,TypeError): continue
        for node in nodes(data):
            types=node.get('@type',[]); types=[types] if isinstance(types,str) else types
            if any(t in ('Organization','EducationalOrganization','CollegeOrUniversity','GovernmentOrganization','Corporation','NGO') for t in types):
                name=node.get('name'); own=node.get('url')
                if isinstance(name,str) and isinstance(own,str) and urlsplit(own).hostname==urlsplit(url).hostname: return _clean(name,'provider')[0]
    return ''

def _heading_section(scope,label_pattern):
    output=[]
    for heading in scope.find_all(re.compile('^h[1-6]$')):
        if re.search(label_pattern,heading.get_text(' ',strip=True),re.I):
            for sibling in heading.next_siblings:
                if getattr(sibling,'name',None) and re.match('^h[1-6]$',sibling.name): break
                if hasattr(sibling,'get_text'): output.append(sibling.get_text(' ',strip=True))
    return '\n'.join(output)

def _generic(scope,url,organisation,now,lead):
    heading=scope.find(re.compile('^h[1-3]$'))
    name,flags=_clean(heading.get_text(' ',strip=True) if heading else '', 'name')
    text,findings=_clean(scope.get_text('\n',strip=True)); flags+=findings
    reasons=[]
    if not name or not PROGRAMME.search(name) or name.lower() in ('scholarships','our scholarships','scholarship opportunities'): reasons.append('Identify a distinct programme')
    provider_label=re.search(r'(?:provider|penaja|offered by)\s*:\s*([^\n]+)',text,re.I)
    provider=_clean(provider_label.group(1),'provider')[0] if provider_label else organisation
    official=bool(organisation and provider and provider.casefold()==organisation.casefold())
    if not provider: reasons.append('Confirm provider')
    if not official: reasons.append('Confirm official source')
    paragraphs=[p.get_text(' ',strip=True) for p in scope.find_all('p') if len(p.get_text(' ',strip=True))>=30]
    description=_clean('\n'.join(paragraphs))[0] or None
    if not description or len(description)<20: reasons.append('Add programme description')
    eligibility=_heading_section(scope,r'eligib|qualif|entry requirement|kelayakan|syarat')
    clauses=re.split(r'[.;\n]',eligibility)
    excluded=[clause for clause in clauses if re.search(r'not eligible|not accepted|exclude|except|tidak layak',clause,re.I)]
    excluded_levels=set(match_levels(' '.join(excluded)))
    levels=[level for level in match_levels(' '.join(clause for clause in clauses if clause not in excluded)) if level not in excluded_levels]
    if not levels: reasons.append('Confirm education levels')
    fields=match_fields(_heading_section(scope,r'study fields|fields of study|bidang'))
    deadline_evidence=re.findall(r'(?:closing date|application deadline|deadline|tarikh tutup)\s*:?\s*([^\n]+)',text,re.I)
    dates=[parse_date(value) for value in deadline_evidence]
    valid_dates=list(dict.fromkeys(d for d in dates if d))
    deadline=valid_dates[0] if len(valid_dates)==1 else None
    honest_unknown=all(re.fullmatch(r'rolling|unknown|not announced|to be announced|ongoing',value.strip(),re.I) for value in deadline_evidence)
    if deadline_evidence and not honest_unknown and (len(valid_dates)!=1 or any(d is None for d in dates)): reasons.append('Confirm closing date')
    status='expired' if CLOSED.search(text) or (deadline and deadline<now.date()) else ('active' if OPEN.search(text) else 'unknown')
    if status=='unknown': reasons.append('Confirm application status')
    funding=re.search(r'(?:funding|award value|jumlah tajaan)\s*:\s*([^\n]+)',text,re.I)
    application=None
    for link in scope.find_all('a',href=True):
        if re.search(r'apply|mohon|application portal',link.get_text(' ',strip=True),re.I):
            application=canonicalise_url(urljoin(url,link['href']))
            if application: break
    if application: reasons.append('Confirm application destination')
    if flags: reasons.extend(flags)
    key=scope.get('id') or re.sub(r'\s+',' ',name.strip().casefold()) or 'unresolved-page'
    identity=hashlib.sha256((url+'|'+key).encode()).hexdigest()
    record={'name':name,'provider':provider,'description':description,'funding_amount':funding.group(1).strip() if funding else None,'education_levels':levels,'field_of_study':fields,'deadline':deadline.isoformat() if deadline else None,'application_link':application,'status':status,'source_url':url}
    evidence={'official_source':official,'extracted_at':now.isoformat(),'source_url':url,'fields':{}}
    for field,value in [('name',name),('provider',provider),('education_levels',eligibility),('deadline','; '.join(deadline_evidence)),('status',text[:3000])]:
        evidence['fields'][field]={'text':value,'source_url':url}
    if lead: evidence['search_lead']={'title':lead.title,'snippet':lead.snippet,'query':lead.query,'freshness':lead.freshness}
    return DiscoveryCandidate(identity,url,key,record,[],evidence,list(dict.fromkeys(reasons)),'needs_review' if reasons else 'ready')

def extract_candidates(document: FetchedDocument,lead: SearchLead | None,now: datetime):
    url=canonicalise_url(document.final_url) or document.final_url
    parser=parser_for_url(url)
    if parser and 'html' in document.content_type.lower():
        records=parser.parse(document.html,url)
        if records:
            output=[]
            for record in records:
                row=record.to_row(); row['source_url']=record.source_url
                reasons=list(record.flags)
                if not record.education_levels: reasons.append('Confirm education levels')
                if not record.description: reasons.append('Add programme description')
                evidence={'official_source':True,'trusted_application':True,'source_url':record.source_url,'extracted_at':now.isoformat(),'parser':parser.source_id,'fields':{'description':{'text':record.description,'source_url':record.source_url}}}
                crit=[{k:v for k,v in c.to_row('').items() if k!='scholarship_id'} for c in record.criteria]
                output.append(DiscoveryCandidate(identity_hash(record),record.source_url,record.name,row,crit,evidence,reasons,'needs_review' if reasons else 'ready'))
            return output
    soup=BeautifulSoup(document.html,'html.parser')
    organisation=_organisation(soup,url)
    for element in soup.select('script,style,nav,header,footer,noscript'): element.decompose()
    main=soup.find('main') or soup.find('article') or soup
    sections=[section for section in main.select('[data-scholarship],article,section') if section.find(re.compile('^h[1-3]$')) and PROGRAMME.search(section.find(re.compile('^h[1-3]$')).get_text())]
    # A collection ancestor must not become another copy of its first programme.
    sections=[section for section in sections if not any(other is not section and any(parent is section for parent in other.parents) for other in sections)]
    if len(sections)<2: sections=[main]
    items=[];seen=set()
    for section in sections:
        item=_generic(section,url,organisation,now,lead)
        natural=json.dumps({'record':item.record,'criteria':item.criteria},sort_keys=True)
        if natural not in seen:seen.add(natural);items.append(item)
    if 'html' not in document.content_type.lower():
        for item in items: item.review_reasons.append('Unsupported format; review official source'); item.review_state='needs_review'
    return items

def programme_links(document):
    soup=BeautifulSoup(document.html,'html.parser'); output=[]
    for link in soup.select('main a[href],article a[href]'):
        if PROGRAMME.search(link.get_text(' ',strip=True)+' '+link['href']):
            url=canonicalise_url(urljoin(document.final_url,link['href']))
            if url and url not in output and url!=canonicalise_url(document.final_url): output.append(url)
    parser=parser_for_url(document.final_url)
    if parser:
        output=list(dict.fromkeys(parser.discover(document.html)+output))
    return output[:100]
