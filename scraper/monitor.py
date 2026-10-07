"""Refresh only programmes selected by admins. Never publish new discoveries."""
from datetime import datetime,timezone
from .discovery import fetch_document
from .discovery_extract import extract_candidates
from .public_http import FetchError
from .db import redact

def run_monitoring(db,fetcher,stats,budget,max_pages):
    start=budget.pages_used
    for selected in db.selected_discoveries():
        if not budget.remaining or budget.pages_used-start>=max_pages: break
        url=selected.get('approved_source_url') or selected['canonical_url']
        try:
            document=fetch_document(fetcher,url,budget)
            if document is None: continue
            extracted=extract_candidates(document,None,datetime.now(timezone.utc))
            identities={selected['identity_key'],*selected.get('aliases',[])}
            candidate=next((item for item in extracted if item.identity_key in identities),None)
            if candidate is None:
                # Keep observed moved-source information in the selected staging row.
                moved=next((item for item in extracted if item.programme_key==selected.get('programme_key')),None)
                if moved is None and len(extracted)==1 and extracted[0].record.get('name')==selected.get('extracted_record',{}).get('name'):moved=extracted[0]
                if moved is None:raise FetchError(f'Programme identity changed at {document.final_url}; review official source')
                candidate=moved
                candidate.evidence['observed_identity_key']=candidate.identity_key
                candidate.evidence['observed_source_url']=document.final_url
                candidate.identity_key=selected['identity_key']
                candidate.review_reasons.append('Source or programme identity changed; review and approve the observed source')
                candidate.review_state='needs_review'
            result=db.monitor(selected['id'],candidate)
            stats.monitored+=1
            if result=='updated': stats.publications_updated+=1
            elif result=='unchanged': stats.unchanged+=1
            elif result=='skipped_manual': stats.skipped_manual+=1
        except Exception as error:
            message=redact(str(error)); stats.error(message)
            try: db.record_discovery_error(selected['id'],message)
            except Exception as write_error: stats.error(redact(f'Monitor log failed: {write_error}'))
