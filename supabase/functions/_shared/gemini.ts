/** Extract only user-visible answer text from a Gemini GenerateContent chunk. */
export function extractGeminiChunk(raw: string): { text: string; finishReason: string | null } {
  const parsed = JSON.parse(raw);
  const candidate = parsed?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts
    .filter((part: { thought?: boolean }) => !part.thought)
    .map((part: { text?: string }) => part.text ?? '')
    .join('');
  return { text, finishReason: candidate?.finishReason ?? null };
}

/** Split complete SSE events while retaining an incomplete trailing frame. */
export function splitSseEvents(buffer: string): { events: string[]; remainder: string } {
  const frames = buffer.split(/\r?\n\r?\n/);
  return { events: frames.slice(0, -1), remainder: frames.at(-1) ?? '' };
}

/** Only provider/network failures are safe to retry; 4xx request errors are not. */
export function isTransientGeminiStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}
