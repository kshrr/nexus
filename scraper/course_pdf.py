"""Bound PDF decoding in a disposable worker; preserve page and table layout."""
from dataclasses import dataclass
import io
import json
import math
import subprocess
import sys
import time
from .public_http import FetchError

MAX_PDF_BYTES = 10_000_000
MAX_TEXT = 2_000_000
MAX_CHUNKS_PER_PAGE = 20_000
# UTM's 151-page requirement book takes ~21 s to read locally; runners can be slower.
MAX_PDF_PAGES = 200
PDF_PARSE_SECONDS = 90


@dataclass(frozen=True)
class PdfPage:
    number: int
    text: str
    # Positioned text pieces [x, y, text, font size] in PDF points, for table-column parsing.
    chunks: tuple = ()


@dataclass(frozen=True)
class FetchedPdfDocument:
    final_url: str
    pages: list[PdfPage]
    content_type: str = 'application/pdf'


def _decode(data, max_pages):
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        raise ValueError('Unsupported encrypted PDF')
    if len(reader.pages) > max_pages:
        raise ValueError('PDF page limit exceeded')
    pages=[]; total=0
    for index, page in enumerate(reader.pages):
        text=page.extract_text(extraction_mode='layout') if page.get_contents() is not None else ''
        total+=len(text)
        if total > MAX_TEXT:
            raise ValueError('PDF text limit exceeded')
        chunks=[]
        def visit(piece, cm, tm, _font, size):
            if piece.strip() and len(chunks) < MAX_CHUNKS_PER_PAGE:
                x=tm[4]*cm[0]+tm[5]*cm[2]+cm[4]
                y=tm[4]*cm[1]+tm[5]*cm[3]+cm[5]
                scale=math.hypot(tm[0],tm[1])*math.hypot(cm[0],cm[1])
                chunks.append([round(x,1),round(y,1),piece,round((size or 0)*scale,2)])
        if page.get_contents() is not None:
            page.extract_text(visitor_text=visit)
        total+=sum(len(c[2]) for c in chunks)
        if total > MAX_TEXT:
            raise ValueError('PDF text limit exceeded')
        pages.append({'number':index+1,'text':text,'chunks':chunks})
    if not any(page['text'].strip() for page in pages):
        raise ValueError('Unsupported PDF without extractable text')
    return pages


def extract_pdf_pages(data, *, deadline, max_pages=MAX_PDF_PAGES):
    if len(data)>MAX_PDF_BYTES:
        raise FetchError('PDF size limit exceeded')
    if not data.startswith(b'%PDF-'):
        raise FetchError('Invalid PDF signature')
    remaining=min(PDF_PARSE_SECONDS,deadline-time.monotonic())
    if remaining<=0:
        raise FetchError('PDF parsing time budget exhausted')
    try:
        result=subprocess.run([sys.executable,'-m','scraper.course_pdf',str(max_pages)],input=data,capture_output=True,timeout=remaining,check=False)
        if len(result.stdout)>MAX_TEXT*8:
            raise FetchError('PDF output limit exceeded')
        payload=json.loads(result.stdout)
        if result.returncode or 'error' in payload:
            raise FetchError(payload.get('error','PDF extraction failed'))
        return [PdfPage(page['number'], page['text'], tuple(tuple(c) for c in page.get('chunks', ())))
                for page in payload['pages']]
    except subprocess.TimeoutExpired as error:
        raise FetchError('PDF extraction timeout; worker terminated') from error
    except (ValueError, OSError, KeyError, TypeError) as error:
        raise FetchError('Unsupported or corrupt PDF') from error


if __name__=='__main__':
    try:
        print(json.dumps({'pages':_decode(sys.stdin.buffer.read(MAX_PDF_BYTES+1),int(sys.argv[1]))}))
    except Exception as error:
        print(json.dumps({'error':str(error)[:1000]}))
        sys.exit(1)
