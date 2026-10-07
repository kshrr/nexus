import { describe, expect, it } from 'vitest';
import { extractGeminiChunk, isTransientGeminiStatus, splitSseEvents } from './gemini';

describe('extractGeminiChunk', () => {
  it('extracts visible answer text', () => {
    const result = extractGeminiChunk(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Hello ' }, { text: 'there.' }] }, finishReason: 'STOP' }],
    }));
    expect(result).toEqual({ text: 'Hello there.', finishReason: 'STOP' });
  });

  it('does not expose thought summaries', () => {
    const result = extractGeminiChunk(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'internal', thought: true }, { text: 'Answer' }] } }],
    }));
    expect(result.text).toBe('Answer');
  });

  it('handles signature-only chunks without inventing text', () => {
    const result = extractGeminiChunk(JSON.stringify({
      candidates: [{ content: { parts: [{ thoughtSignature: 'opaque' }] }, finishReason: 'MAX_TOKENS' }],
    }));
    expect(result).toEqual({ text: '', finishReason: 'MAX_TOKENS' });
  });
});

describe('splitSseEvents', () => {
  it('splits Gemini CRLF frames and keeps an incomplete trailing frame', () => {
    const result = splitSseEvents(
      'data: {"one":1}\r\n\r\ndata: {"two":2}\r\n\r\ndata: {"partial"'
    );
    expect(result.events).toEqual(['data: {"one":1}', 'data: {"two":2}']);
    expect(result.remainder).toBe('data: {"partial"');
  });

  it('also accepts LF-only frames emitted by Nexus', () => {
    expect(splitSseEvents('data: one\n\ndata: two\n\n')).toEqual({
      events: ['data: one', 'data: two'],
      remainder: '',
    });
  });
});

describe('isTransientGeminiStatus', () => {
  it.each([408, 429, 500, 503, 504])('retries transient status %i', (status) => {
    expect(isTransientGeminiStatus(status)).toBe(true);
  });

  it.each([400, 401, 403, 404])('does not retry request error %i', (status) => {
    expect(isTransientGeminiStatus(status)).toBe(false);
  });
});
