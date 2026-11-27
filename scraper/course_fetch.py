"""Course-only retry and XML-sitemap extensions over the shared Fetcher (which owns PDF fetching)."""
import time
from .fetch import Fetcher, MAX_BYTES
from .public_http import FetchError, FetchedDocument

XML_TYPES=('application/xml','text/xml')
# Connection-level failures worth one more attempt; HTTP statuses, robots refusals,
# content-type and size errors are final.
TRANSIENT_ERRORS=('HTTPS request failed','request timeout')
# Pauses before the 2nd and 3rd attempts. Some university sites intermittently
# drop connections from GitHub's US runners; a short wait usually clears it.
RETRY_PAUSES=(5,15)


class CourseFetcher(Fetcher):
    def _retry_transient(self,operation,url):
        for pause in (*RETRY_PAUSES,None):
            try:
                return operation(url)
            except FetchError as error:
                if str(error) not in TRANSIENT_ERRORS or pause is None: raise
                if self.deadline is not None and time.monotonic()+pause>=self.deadline: raise
                time.sleep(pause)

    def get_document(self,url):
        return self._retry_transient(super().get_document,url)

    def get_xml_document(self,url):
        return self._retry_transient(self._get_xml_once,url)

    def get_pdf_document(self,url):
        return self._retry_transient(super().get_pdf_document,url)

    def _get_xml_once(self,url):
        """An official XML sitemap. Same robots, delay, redirect and size rules as HTML."""
        if not url.startswith('https://'): raise FetchError('refusing a non-https URL')
        self._before_request(url)
        first=[True]
        def guard(destination):
            if first[0]: first[0]=False
            else:
                if self.on_redirect: self.on_redirect(destination)
                self._before_request(destination)
        result=self._session.get(url,max_bytes=MAX_BYTES,timeout=self._timeout(),accept='application/xml,text/xml',before_request=guard)
        if result.status!=200: raise FetchError(f'HTTP {result.status}')
        content_type=result.headers.get('content-type','')
        if content_type.split(';')[0].lower().strip() not in XML_TYPES:
            raise FetchError(f'expected XML, got {content_type or "unknown format"}')
        return FetchedDocument(result.body.decode('utf-8',errors='replace'),result.final_url or url,content_type)
