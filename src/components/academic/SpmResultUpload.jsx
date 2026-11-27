import { useId, useRef, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { parseSpmSlip } from '@/lib/spmSlip';

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Read an SPM result slip photo on this device (tesseract.js, loaded only when
 * used). The image is never uploaded or stored: OCR runs in the browser, and
 * only the subject grades it finds are handed to the grade table for the
 * student to check before saving.
 */
async function recogniseInBrowser(file, onProgress) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') onProgress(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text ?? '';
  } finally {
    await worker.terminate();
  }
}

/**
 * @param {{
 *   subjects: { code: string, name: string }[],
 *   onDetected: (results: { code: string, grade: string }[]) => void,
 *   recognise?: (file: File, onProgress: (p: number) => void) => Promise<string>,
 * }} props
 */
export function SpmResultUpload({ subjects, onDetected, recognise = recogniseInBrowser }) {
  const inputId = useId();
  const input = useRef(null);
  const [state, setState] = useState({ status: 'idle', progress: 0, found: 0, unread: [] });

  async function read(file) {
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setState({
        status: 'error',
        message: 'Choose a JPG, PNG or WebP photo of your result slip.',
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState({ status: 'error', message: 'That photo is larger than 10 MB. Try a smaller one.' });
      return;
    }
    setState({ status: 'reading', progress: 0 });
    try {
      const text = await recognise(file, (progress) =>
        setState((s) => (s.status === 'reading' ? { ...s, progress } : s))
      );
      const { results, unread } = parseSpmSlip(text, subjects);
      if (results.length) onDetected(results);
      setState({ status: 'done', found: results.length, unread });
    } catch {
      setState({
        status: 'error',
        message: 'We couldn’t read that photo. You can still enter your grades below.',
      });
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="rounded-card border border-dashed border-ink-200 bg-paper p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={TYPES.join(',')}
          className="sr-only"
          onChange={(event) => read(event.target.files?.[0])}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={state.status === 'reading'}
          onClick={() => input.current?.click()}
        >
          {state.status === 'reading'
            ? 'Reading your slip…'
            : 'Fill from a photo of my result slip'}
        </Button>
        <label htmlFor={inputId} className="text-body-sm text-ink-500">
          Optional. The photo is read on this device and is not uploaded or stored. Only your
          subject grades are kept; your name and IC number on the slip are ignored.
        </label>
      </div>
      {state.status === 'reading' && (
        <p role="status" className="mt-3 text-body-sm text-ink-700">
          Reading… {Math.round((state.progress ?? 0) * 100)}%
        </p>
      )}
      {state.status === 'done' && (
        <p role="status" className="mt-3 text-body-sm text-ink-700">
          {state.found
            ? `Found ${state.found} ${state.found === 1 ? 'subject' : 'subjects'} and filled in your SPM grades below. Check every grade before saving.`
            : 'We couldn’t find any subject grades in that photo. Try a clearer, straight-on photo, or enter your grades below.'}
          {state.found > 0 &&
            state.unread?.length > 0 &&
            ` ${state.unread.length} more ${state.unread.length === 1 ? 'line' : 'lines'} couldn’t be read — add those yourself.`}
        </p>
      )}
      {state.status === 'error' && (
        <Alert variant="error" className="mt-3">
          {state.message}
        </Alert>
      )}
    </div>
  );
}

export default SpmResultUpload;
