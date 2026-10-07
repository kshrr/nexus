/**
 * fn:chat — architecture.md §12, §15.
 *
 *   POST { message: string <= 1000 }  + Authorization: Bearer <JWT>
 *   -> text/event-stream of { delta } events, then { done } or { error }
 *
 * The ONLY place the Gemini key exists is `Deno.env` inside this function
 * (NFR01c / AC-34). It is never sent to the browser, never stored in the
 * database, and never appears in a client bundle. The browser talks to this
 * function; this function talks to Gemini.
 *
 * The `service_role` key is NEVER used here. Every database query runs under
 * the caller's JWT (FR-SEC-05), so a flaw in user_id handling cannot expose
 * another student's data — that is vulnerability V-02.
 */
import { getCaller } from '../_shared/auth.ts';
import { corsHeaders, fail, preflight, serverError } from '../_shared/http.ts';
import {
  HISTORY_TURNS,
  RATE_LIMIT_PER_HOUR,
  TOP_RECOMMENDATIONS,
  assertBounded,
  buildStudentContext,
  filterOutput,
  validateMessage,
  type ChatTurn,
} from '../_shared/chat-context.ts';
import { buildContents, buildSystemPrompt } from './system-prompt.ts';
import {
  extractGeminiChunk,
  isTransientGeminiStatus,
  splitSseEvents,
} from '../_shared/gemini.ts';

// @ts-expect-error — Deno global
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// @ts-expect-error — Deno global
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash';
// @ts-expect-error — Deno global
const GEMINI_FALLBACK_MODEL = Deno.env.get('GEMINI_FALLBACK_MODEL') ?? 'gemini-3.5-flash-lite';

/** Verbatim from architecture.md §12.5 — do not reword. */
const MSG_UNAVAILABLE = 'The assistant is temporarily unavailable. Please try again shortly.';
const MSG_RATE_LIMITED = "You've reached the message limit for now. Try again in an hour.";
const MSG_EMPTY = "I couldn't generate a response. Try rephrasing your question.";

const sse = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;

// @ts-expect-error — Deno global
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req);

  try {
    if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Unsupported request.');

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

    // ---- 3. validate ----------------------------------------------------
    let body: { message?: unknown };
    try {
      body = await req.json();
    } catch {
      return fail(400, 'INVALID_MESSAGE', 'Send a question as text.');
    }
    const validation = validateMessage(body?.message);
    if (!validation.ok) return fail(400, validation.code, validation.message);
    const message = validation.message;

    if (!GEMINI_API_KEY) {
      console.error('[chat] GEMINI_API_KEY is not configured');
      return fail(
        503,
        'AI_UNAVAILABLE',
        MSG_UNAVAILABLE,
        'GEMINI_API_KEY is not set. Run: npx supabase secrets set GEMINI_API_KEY=...'
      );
    }

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
    } catch (err) {
      console.error('[chat] gemini fetch failed', err);
      return fail(
        503,
        'AI_UNAVAILABLE',
        MSG_UNAVAILABLE,
        `network error reaching Gemini: ${String((err as Error)?.message ?? err)}`
      );
    }

    if (!upstream.ok || !upstream.body) {
      const body = await safeText(upstream);
      console.error('[chat] gemini responded', upstream.status, body);
      // Self-diagnose: ask Gemini which models this key can actually see. That
      // separates "the key is rejected" from "the key is fine but the model
      // name is wrong", without anyone having to handle the secret by hand.
      const diagnosis = await diagnoseModels();
      return fail(
        503,
        'AI_UNAVAILABLE',
        MSG_UNAVAILABLE,
        `Gemini returned ${upstream.status} for model "${upstreamModel}". ${body} — ${diagnosis}`
      );
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
            if (insertError) console.error('[chat] failed to persist reply', insertError);
            send({ done: true, message: clean });
          }
        } catch (err) {
          // Stream interrupted (§12.5): the client keeps the partial text and
          // offers a retry, so this is reported rather than thrown away.
          console.error('[chat] stream interrupted', err);
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
  } catch (err) {
    return serverError(err);
  }
});

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
            'x-goog-api-key': GEMINI_API_KEY as string,
          },
          body,
        });
        if (response.ok || !isTransientGeminiStatus(response.status)) {
          return { response, model };
        }

        const isLastAttempt =
          modelIndex === models.length - 1 && attempt === attemptsPerModel - 1;
        if (isLastAttempt) return { response, model };

        const detail = await safeText(response);
        console.warn('[chat] transient Gemini response; retrying', {
          model,
          attempt: attempt + 1,
          status: response.status,
          detail,
        });
      } catch (error) {
        const isLastAttempt =
          modelIndex === models.length - 1 && attempt === attemptsPerModel - 1;
        if (isLastAttempt) throw error;
        console.warn('[chat] Gemini network failure; retrying', {
          model,
          attempt: attempt + 1,
          error: String((error as Error)?.message ?? error),
        });
      }

      const delayMs = 700 * 2 ** attempt + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Gemini retry loop ended without a response.');
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 400);
  } catch {
    return '<unreadable>';
  }
}

/**
 * Failure triage, run only when a chat call has already failed.
 *
 * Lists the models the configured key can see. The outcome distinguishes the
 * two causes that look identical from the outside:
 *
 *   * the listing also fails  -> the credential itself is rejected (wrong key,
 *     or an ephemeral `AQ.` token rather than a long-lived API key)
 *   * the listing succeeds    -> the key is fine and GEMINI_MODEL is wrong;
 *     the reply names models that would work
 *
 * Never echoes the key: `redact()` in http.ts scrubs the string on the way out.
 */
async function diagnoseModels(): Promise<string> {
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'x-goog-api-key': GEMINI_API_KEY as string },
    });

    if (!res.ok) {
      const body = await safeText(res);
      return (
        `Listing models with the same key ALSO failed (${res.status}), so the credential is being ` +
        `rejected rather than the model name. Check that GEMINI_API_KEY is a long-lived AI Studio ` +
        `API key. ${body}`
      );
    }

    const data = await res.json();
    const usable = (data?.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes('generateContent')
      )
      .map((m: { name?: string }) => (m.name ?? '').replace(/^models\//, ''))
      .filter(Boolean);

    if (usable.length === 0) return 'The key works but exposes no chat-capable model.';

    return (
      `The key is valid — the model name is the problem. Models available to it: ` +
      `${usable.slice(0, 12).join(', ')}. Fix with: ` +
      `npx supabase secrets set GEMINI_MODEL=${usable[0]}`
    );
  } catch (err) {
    return `Could not list models: ${String((err as Error)?.message ?? err)}`;
  }
}
