import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { config } from '@/config/env';
import { FUNCTIONS, normaliseError, normaliseFunctionError } from '@/lib/api';
import { useAuth } from '@/context/useAuth';
import { filterOutput } from '@/lib/chatSafety';

/**
 * Chatbot state (FR12, architecture.md §12).
 *
 * The browser never talks to Gemini. It POSTs to `fn:chat`, which holds the API
 * key server-side (NFR01c / AC-34), and reads back a text/event-stream so the
 * answer appears token by token (FR-CHAT-08).
 *
 * History is persisted in `chat_messages` and read back under RLS (D-31), so a
 * refresh does not lose the conversation and the "last ten turns" context can
 * be reconstructed.
 */

/** Verbatim from architecture.md §12.5. */
const MSG_NETWORK = "Couldn't send that. Check your connection.";
const MSG_UNAVAILABLE = 'The assistant is temporarily unavailable. Please try again shortly.';

export function useChat() {
  const { isAuthenticated, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // ---- history ----------------------------------------------------------
  const loadHistory = useCallback(async () => {
    if (!config.isConfigured || !user) {
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    try {
      const { data, error: err } = await supabase
        .from('chat_messages')
        .select('id, sender, message, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100);
      if (err) throw err;
      setMessages(
        (data ?? []).map((m) => ({ ...m, message: filterOutput(m.message), streaming: false }))
      );
    } catch (err) {
      setError(normaliseError(err));
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  // ---- send -------------------------------------------------------------
  const send = useCallback(
    async (raw) => {
      const text = (raw ?? '').trim();
      if (!text || streaming || !isAuthenticated) return;

      setError(null);
      const localId = `local-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: localId, sender: 'user', message: text, created_at: new Date().toISOString() },
        { id: `${localId}-reply`, sender: 'assistant', message: '', streaming: true },
      ]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const updateReply = (updater) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === `${localId}-reply` ? { ...m, ...updater(m) } : m))
        );

      try {
        // Streaming needs the raw Response, so this call goes through
        // supabase.functions.invoke with the SSE content type.
        const { data: response, error: invokeError } = await supabase.functions.invoke(
          FUNCTIONS.CHAT,
          {
            body: { message: text },
            headers: { Accept: 'text/event-stream' },
          }
        );

        if (invokeError) {
          const normalised = await normaliseFunctionError(invokeError);
          updateReply(() => ({ message: '', streaming: false, failed: true }));
          setError(normalised);
          setStreaming(false);
          abortRef.current = null;
          return;
        }

        // A non-streaming JSON body means the function answered with an envelope.
        if (!(response instanceof Response) || !response.body) {
          updateReply(() => ({ streaming: false, failed: true }));
          setError({ code: 'AI_UNAVAILABLE', message: MSG_UNAVAILABLE });
          setStreaming(false);
          abortRef.current = null;
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let completed = false;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? '';

          for (const event of events) {
            const line = event.split(/\r?\n/).find((l) => l.startsWith('data:'));
            if (!line) continue;
            let payload;
            try {
              payload = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }

            if (payload.delta) {
              accumulated += payload.delta;
              // Filter before render, every time (§12.4).
              updateReply(() => ({ message: filterOutput(accumulated) }));
            }
            if (payload.error) {
              setError(payload.error);
              updateReply(() => ({ streaming: false, failed: !accumulated }));
            }
            if (payload.done) {
              completed = true;
              updateReply(() => ({ message: filterOutput(payload.message ?? accumulated) }));
            }
          }
        }

        updateReply(() => ({ streaming: false, failed: !completed }));
        if (!completed && accumulated) {
          setError({
            code: 'STREAM_INTERRUPTED',
            message: 'The answer was cut short. Please try again.',
          });
        }
      } catch (err) {
        if (err?.name === 'AbortError') {
          // Stopped by the student: keep whatever arrived (§12.5).
          updateReply((m) => ({ streaming: false, message: m.message }));
        } else {
          updateReply((m) => ({ streaming: false, failed: !m.message }));
          setError({ code: 'NETWORK', message: MSG_NETWORK });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [streaming, isAuthenticated]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    loadingHistory,
    streaming,
    error,
    send,
    stop,
    clearError,
    reload: loadHistory,
    hasHistory: messages.length > 0,
  };
}

/**
 * The exact fields sent to Gemini, for the "What I know about you" disclosure
 * (ui-spec §8.4).
 *
 * This is a deliberate transparency device with no equivalent in a general chat
 * product: the student can see why answers are personalised, and it makes the
 * data-minimisation claim in §12.2 visible rather than merely asserted. It must
 * stay in step with `buildStudentContext` on the server.
 */
export function useChatContextSummary() {
  const { user, profile } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!config.isConfigured || !user) {
      setLoading(false);
      return () => {};
    }
    (async () => {
      const [riasec, strengths, recs, saved] = await Promise.all([
        supabase.from('riasec_results').select('holland_code').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('subject_strengths')
          .select('strength, subjects(name)')
          .eq('user_id', user.id)
          .eq('strength', 'strong'),
        supabase
          .from('recommendations')
          .select('target_id, rank')
          .eq('user_id', user.id)
          .order('rank', { ascending: true })
          .limit(5),
        supabase
          .from('saved_items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);
      if (!alive) return;
      setSummary({
        firstName: (profile?.full_name ?? '').trim().split(/\s+/)[0] || null,
        educationLevel: profile?.education_level ?? null,
        careerGoal: profile?.career_goal ?? null,
        targetIndustry: profile?.target_industry ?? null,
        hollandCode: riasec.data?.holland_code ?? null,
        strengths: (strengths.data ?? []).map((s) => s.subjects?.name).filter(Boolean),
        recommendationCount: (recs.data ?? []).length,
        savedCount: saved.count ?? 0,
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user, profile]);

  return { summary, loading };
}

export default useChat;
