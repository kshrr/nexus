/**
 * Vercel /api/chat — architecture.md §12, §15.
 *
 *   POST { message: string <= 1000 }  + Authorization: Bearer <JWT>
 *   -> text/event-stream of { delta } events, then { done } or { error }
 *
 * The Gemini key is read from the Vercel server environment inside this function
 * (NFR01c / AC-34). It is never sent to the browser, never stored in the
 * database, and never appears in a client bundle. The browser talks to this
 * function; this function talks to Gemini.
 *
 * The `service_role` key is NEVER used here. Every database query runs under
 * the caller's JWT (FR-SEC-05), so a flaw in user_id handling cannot expose
 * another student's data — that is vulnerability V-02.
 */
import { createClient } from '@supabase/supabase-js';
import { corsHeaders, fail, preflight } from '../supabase/functions/_shared/http.ts';
import {
  HISTORY_TURNS,
  RATE_LIMIT_PER_HOUR,
  TOP_RECOMMENDATIONS,
  assertBounded,
  buildStudentContext,
  filterOutput,
  validateMessage,
  type ChatTurn,
} from '../supabase/functions/_shared/chat-context.ts';
import { buildContents, buildSystemPrompt } from '../supabase/functions/chat/system-prompt.ts';
import {
  extractGeminiChunk,
  isTransientGeminiStatus,
  splitSseEvents,
} from '../supabase/functions/_shared/gemini.ts';

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-3.5-flash-lite';
const MAX_REQUEST_BYTES = 4096;

/** Verbatim from architecture.md §12.5 — do not reword. */
const MSG_UNAVAILABLE = 'The assistant is temporarily unavailable. Please try again shortly.';
const MSG_RATE_LIMITED = "You've reached the message limit for now. Try again in an hour.";
const MSG_EMPTY = "I couldn't generate a response. Try rephrasing your question.";

const sse = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;

export default { async fetch(req: Request) {
  if (req.method === 'OPTIONS') return preflight(req);

  try {
    if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Unsupported request.');

    // Bound the entire request before parsing it, including malformed JSON.
    if (Number(req.headers.get('content-length')) > MAX_REQUEST_BYTES) {
      return fail(413, 'MESSAGE_TOO_LONG', 'Keep your question under 1000 characters.');
    }
    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch {
      return fail(400, 'INVALID_MESSAGE', 'Send a question as text.');
    }
    if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
      return fail(413, 'MESSAGE_TOO_LONG', 'Keep your question under 1000 characters.');
    }
    let body: { message?: unknown };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail(400, 'INVALID_MESSAGE', 'Send a question as text.');
    }
    const validation = validateMessage(body?.message);
    if (!validation.ok) return fail(400, validation.code, validation.message);
    const message = validation.message;

    // ---- 1. authenticate -------------------------------------------------
    const caller = await getCaller(req);
    if (!caller) return fail(401, 'UNAUTHENTICATED', 'Sign in to use the assistant.');
    const { client, userId } = caller;

    // ---- 2. rate limit (FR-SEC-04) --------------------------------------
    // Counted through a SECURITY DEFINER function: rate_limit_events is not
    // reachable by the caller's role (§4.8), and the identifier is taken from
    // auth.uid() inside the function so it cannot be forged.
    const { data: limit, error: limitError } = await client.rpc('consume_rate_limit', {
      p_endpoint: 'chat',
      p_limit: RATE_LIMIT_PER_HOUR,
      p_window_seconds: 3600,
    });
    if (limitError) throw limitError;
    if (limit && limit.allowed === false) {
      return fail(429, 'RATE_LIMITED', MSG_RATE_LIMITED);
    }

    if (!process.env.GEMINI_API_KEY) return fail(503, 'AI_UNAVAILABLE', MSG_UNAVAILABLE);

    // ---- 4. bounded context, caller-scoped (§12.2) -----------------------
    const [profileRes, riasecRes, recsRes, strengthsRes, historyRes, savedRes] = await Promise.all([
      client
        .from('profiles')
        .select('full_name, education_level, career_goal, target_industry')
        .eq('id', userId)
        .maybeSingle(),
      client.from('riasec_results').select('*').eq('user_id', userId).maybeSingle(),
      client
        .from('recommendations')
        .select('target_id, rec_type, match_score, rank')
        .eq('user_id', userId)
        .order('rank', { ascending: true })
        .limit(TOP_RECOMMENDATIONS),
      client
        .from('subject_strengths')
        .select('strength, subjects(name)')
        .eq('user_id', userId)
        .eq('strength', 'strong'),
      client
        .from('chat_messages')
        .select('sender, message')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(HISTORY_TURNS),
      client
        .from('saved_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    // Resolve recommendation names. Only the NAME and SCORE may be sent (§12.2)
    // — never the reasons, and never anything from the rule base.
    const recRows = recsRes.data ?? [];
    const careerIds = recRows.filter((r) => r.rec_type === 'career').map((r) => r.target_id);
    const courseIds = recRows.filter((r) => r.rec_type === 'course').map((r) => r.target_id);
    const [careerNames, courseNames] = await Promise.all([
      careerIds.length
        ? client.from('careers').select('id, name').in('id', careerIds)
        : Promise.resolve({ data: [] }),
      courseIds.length
        ? client.from('courses').select('id, name').in('id', courseIds)
        : Promise.resolve({ data: [] }),
    ]);
    const nameById = new Map<string, string>();
    for (const row of careerNames.data ?? []) nameById.set(row.id, row.name);
    for (const row of courseNames.data ?? []) nameById.set(row.id, row.name);

    const context = buildStudentContext({
      profile: profileRes.data,
      riasec: riasecRes.data,
      recommendations: recRows
        .filter((r) => nameById.has(r.target_id))
        .map((r) => ({ name: nameById.get(r.target_id) as string, match_score: r.match_score })),
      strengths: (strengthsRes.data ?? []).map((s) => ({
        subject_name: s.subjects?.name ?? '',
        strength: s.strength,
      })),
      savedCount: savedRes.count ?? 0,
    });

    // Fail closed rather than leak: a field outside the allowlist stops the request.
    assertBounded(context as unknown as Record<string, unknown>);

    const history: ChatTurn[] = (historyRes.data ?? [])
      .slice()
      .reverse()
      .map((m) => ({ sender: m.sender, message: m.message }));

    // ---- 5. persist the student's message --------------------------------
    const { error: insertUserError } = await client
      .from('chat_messages')
      .insert({ user_id: userId, sender: 'user', message });
    if (insertUserError) throw insertUserError;

    // ---- 6. call Gemini --------------------------------------------------
    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(context) }] },
      contents: buildContents(history, message),
      generationConfig: {
        // Gemini 3 thinking and visible output share this allowance. Keep
        // thinking minimal for short student-advice answers and leave
        // enough room to finish instead of stopping mid-sentence.
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: 'minimal' },
      },
    });

    let upstream: Response;
    let upstreamModel = GEMINI_MODEL;
    try {
      const result = await fetchGeminiWithRetry(requestBody);
      upstream = result.response;
      upstreamModel = result.model;
    } catch {
      console.error('[chat] Gemini request failed');
      return fail(503, 'AI_UNAVAILABLE', MSG_UNAVAILABLE);
    }

    if (!upstream.ok || !upstream.body) {
      console.error('[chat] Gemini response status', upstream.status);
      return upstreamFailure(upstream.status);
    }

    // ---- 7. stream, filter, persist -------------------------------------
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const reader = upstream.body!.getReader();
        let buffer = '';
        let full = '';
        let finishReason: string | null = null;

        const send = (payload: unknown) => controller.enqueue(encoder.encode(sse(payload)));
        const consumeEvent = (event: string) => {
          const line = event.split(/\r?\n/).find((entry) => entry.startsWith('data:'));
          if (!line) return;
          const raw = line.slice(5).trim();
          if (!raw || raw === '[DONE]') return;
          try {
            const chunk = extractGeminiChunk(raw);
            finishReason = chunk.finishReason ?? finishReason;
            if (chunk.text) {
              full += chunk.text;
              // Filter each chunk as it goes AND the whole text at the end,
              // so an unsafe link is never rendered even momentarily.
              send({ delta: filterOutput(chunk.text) });
            }
          } catch {
            // A split frame remains buffered until the next network chunk.
          }
        };

        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const split = splitSseEvents(buffer);
            buffer = split.remainder;

            for (const event of split.events) consumeEvent(event);
          }

          buffer += decoder.decode();
          if (buffer.trim()) {
            const split = splitSseEvents(`${buffer}\n\n`);
            for (const event of split.events) consumeEvent(event);
          }

          const clean = filterOutput(full).trim();

          if (!clean) {
            console.error('[chat] Gemini returned no visible text', {
              model: upstreamModel,
              finishReason,
            });
            send({ error: { code: 'EMPTY_RESPONSE', message: MSG_EMPTY } });
          } else if (finishReason === 'MAX_TOKENS') {
            console.error('[chat] Gemini exhausted its output allowance', {
              model: upstreamModel,
              characters: clean.length,
            });
            send({
              error: {
                code: 'INCOMPLETE_RESPONSE',
                message: 'The answer was cut short. Please try again.',
              },
            });
          } else {
            const { error: insertError } = await client
              .from('chat_messages')
              .insert({ user_id: userId, sender: 'assistant', message: clean.slice(0, 4000) });
            if (insertError) console.error('[chat] failed to persist reply');
            send({ done: true, message: clean });
          }
        } catch {
          // Stream interrupted (§12.5): the client keeps the partial text and
          // offers a retry, so this is reported rather than thrown away.
          console.error('[chat] stream interrupted');
          send({ error: { code: 'STREAM_INTERRUPTED', message: MSG_UNAVAILABLE } });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch {
    console.error('[chat] request failed');
    return fail(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
  }
} };

export function upstreamFailure(status: number): Response {
  if (status === 429) return fail(429, 'RATE_LIMITED', MSG_RATE_LIMITED);
  return fail(503, 'AI_UNAVAILABLE', MSG_UNAVAILABLE);
}

async function fetchGeminiWithRetry(
  body: string
): Promise<{ response: Response; model: string }> {
  const models = [...new Set([GEMINI_MODEL, GEMINI_FALLBACK_MODEL])];
  const attemptsPerModel = 2;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

    for (let attempt = 0; attempt < attemptsPerModel; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY as string,
          },
          body,
        });
        if (response.ok || !isTransientGeminiStatus(response.status)) {
          return { response, model };
        }

        const isLastAttempt =
          modelIndex === models.length - 1 && attempt === attemptsPerModel - 1;
        if (isLastAttempt) return { response, model };

        console.warn('[chat] transient Gemini response; retrying', {
          model,
          attempt: attempt + 1,
          status: response.status,
        });
      } catch {
        const isLastAttempt =
          modelIndex === models.length - 1 && attempt === attemptsPerModel - 1;
        if (isLastAttempt) throw error;
        console.warn('[chat] Gemini network failure; retrying', {
          model,
          attempt: attempt + 1,
        });
      }

      const delayMs = 700 * 2 ** attempt + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Gemini retry loop ended without a response.');
}

async function getCaller(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return { client, userId: data.user.id };
}
