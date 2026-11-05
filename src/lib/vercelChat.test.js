import { describe, expect, it } from 'vitest';
import chat, { upstreamFailure } from '../../api/chat.ts';

const request = (message) =>
  new Request('https://nexus.example/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

describe('/api/chat', () => {
  it('rejects blank questions before contacting Supabase', async () => {
    const response = await chat.fetch(request('   '));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('EMPTY_MESSAGE');
  });

  it('enforces both the message and request limits', async () => {
    const messageResponse = await chat.fetch(request('a'.repeat(1001)));
    expect(messageResponse.status).toBe(400);
    expect((await messageResponse.json()).error.code).toBe('MESSAGE_TOO_LONG');

    const bodyResponse = await chat.fetch(request('a'.repeat(4096)));
    expect(bodyResponse.status).toBe(413);
    expect((await bodyResponse.json()).error.code).toBe('MESSAGE_TOO_LONG');
  });

  it('requires a signed-in caller', async () => {
    const response = await chat.fetch(request('What does my result mean?'));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('UNAUTHENTICATED');
  });

  it('shows a friendly message when Gemini returns 429', async () => {
    const response = upstreamFailure(429);
    expect(response.status).toBe(429);
    expect((await response.json()).error).toEqual({
      code: 'RATE_LIMITED',
      message: "You've reached the message limit for now. Try again in an hour.",
    });
  });
});
