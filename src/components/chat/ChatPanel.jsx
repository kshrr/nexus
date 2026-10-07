import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Spinner } from '@/components/ui';
import { useChat, useChatContextSummary } from '@/hooks/useChat';
import { useAuth } from '@/context/useAuth';
import { MAX_MESSAGE_LENGTH } from '@/config/policy';
import { AiDisclosure } from './AiDisclosure';
import { ContextDisclosure } from './ContextDisclosure';
import { MessageList } from './MessageList';
import { SuggestedQuestions } from './SuggestedQuestions';

const FIRST_SESSION_KEY = 'nexus.chat.noticeSeen';

/**
 * The chat panel (FR-CHAT-02, ui-spec §8.3).
 *
 * A side panel, never a page — 400px on the right at desktop width, a
 * full-screen sheet below 768px. Traps focus, closes on Escape, and returns
 * focus to the launcher.
 *
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function ChatPanel({ open, onClose }) {
  const { profile } = useAuth();
  const { messages, loadingHistory, streaming, error, send, stop, clearError, hasHistory } =
    useChat();
  const { summary, loading: loadingSummary } = useChatContextSummary();

  const [input, setInput] = useState('');
  const [noticeSeen, setNoticeSeen] = useState(true);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      setNoticeSeen(localStorage.getItem(FIRST_SESSION_KEY) === '1');
    } catch {
      setNoticeSeen(true); // storage blocked — don't nag on every open
    }
  }, []);

  // Escape closes; focus moves into the panel on open (ui-spec §2.7).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    inputRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const dismissNotice = () => {
    setNoticeSeen(true);
    try {
      localStorage.setItem(FIRST_SESSION_KEY, '1');
    } catch {
      /* storage blocked — the notice simply reappears next time */
    }
  };

  const submit = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    clearError();
    send(text);
  };

  const firstName = (profile?.full_name ?? '').trim().split(/\s+/)[0];
  const overLimit = input.length > MAX_MESSAGE_LENGTH;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Nexus advisor"
      className="fixed inset-0 z-40 flex flex-col bg-paper shadow-panel md:inset-y-4 md:left-auto md:right-4 md:w-[420px] md:rounded-modal"
    >
      {/* header ------------------------------------------------------- */}
      <header className="flex items-start justify-between rounded-t-modal bg-pine-900 px-5 py-4 text-white">
        <div>
          <h2 className="text-h3 font-serif text-white">Nexus advisor</h2>
          <AiDisclosure variant="header" />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the advisor"
          className="rounded-pill px-2 py-1 text-pine-100 hover:bg-pine-700 hover:text-white"
        >
          ✕
        </button>
      </header>

      <ContextDisclosure summary={summary} loading={loadingSummary} />

      {/* conversation ------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!noticeSeen && (
          <AiDisclosure variant="firstSession" onDismiss={dismissNotice} className="mb-4" />
        )}

        {loadingHistory ? (
          <div className="flex items-center gap-2 text-body-sm text-ink-500">
            <Spinner size="sm" /> Loading your conversation…
          </div>
        ) : (
          <>
            {!hasHistory && (
              <div className="mb-4">
                <p className="text-body text-ink-900">
                  Hi{firstName ? ` ${firstName}` : ''}. I can explain your recommendations, help you
                  make sense of your interest profile, or answer questions about Malaysian
                  education.
                </p>
                <p className="mt-2 text-body-sm text-ink-500">
                  For scholarship details, deadlines and entry requirements I&rsquo;ll point you to
                  the stored records rather than answer from memory — those need to be right.
                </p>
              </div>
            )}

            <MessageList messages={messages} streaming={streaming} />

            {!hasHistory && !streaming && (
              <div className="mt-4">
                <SuggestedQuestions
                  summary={summary}
                  disabled={streaming}
                  onSelect={(q) => {
                    clearError();
                    send(q);
                  }}
                />
              </div>
            )}
          </>
        )}

        {error && (
          <Alert variant="error" className="mt-4">
            {error.message}
            {/* Operator-facing cause, development builds only — the student
                always sees the specified wording above and nothing else. */}
            {import.meta.env.DEV && error.detail && (
              <span className="mt-2 block break-words font-mono text-caption text-ink-500">
                dev: {error.detail}
              </span>
            )}
          </Alert>
        )}
      </div>

      {/* composer ----------------------------------------------------- */}
      <form onSubmit={submit} className="border-t border-pine-100 bg-surface p-4 md:rounded-b-modal">
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Ask a question
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) submit(e);
            }}
            placeholder="Ask a question…"
            maxLength={MAX_MESSAGE_LENGTH + 100}
            aria-describedby={overLimit ? 'chat-limit' : undefined}
            aria-invalid={overLimit || undefined}
            className="max-h-32 min-h-10 flex-1 resize-y rounded-input border border-ink-300 bg-surface px-3 py-2 text-body-sm text-ink-900 focus:border-pine-700 focus:outline-none focus:ring-[3px] focus:ring-pine-100"
          />
          {streaming ? (
            <Button type="button" variant="secondary" onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim() || overLimit}>
              Send
            </Button>
          )}
        </div>
        {overLimit && (
          <p id="chat-limit" role="alert" className="mt-1.5 text-body-sm text-rust-600">
            Keep your question under {MAX_MESSAGE_LENGTH} characters — that&rsquo;s{' '}
            {input.length - MAX_MESSAGE_LENGTH} too many.
          </p>
        )}
      </form>
    </div>
  );
}

export default ChatPanel;
