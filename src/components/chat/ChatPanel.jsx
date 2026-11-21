import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Alert, Button, Spinner } from '@/components/ui';
import { useChat, useChatContextSummary } from '@/hooks/useChat';
import { useAuth } from '@/context/useAuth';
import { MAX_MESSAGE_LENGTH } from '@/config/policy';
import { savePendingQuestion, takePendingQuestion } from '@/lib/chatPending';
import { GUEST_FAQ, guestAnswerFor } from '@/lib/chatGuestFaq';
import { AiDisclosure } from './AiDisclosure';
import { ContextDisclosure } from './ContextDisclosure';
import { MessageList } from './MessageList';
import { SuggestedQuestions } from './SuggestedQuestions';

const FIRST_SESSION_KEY = 'nexus.chat.noticeSeen';

/**
 * The reply to a question a visitor types. A typed question may be personal, and
 * personal answers need the student's context, so it waits for sign-in. Nothing
 * is sent.
 */
export const SIGN_IN_REPLY =
  'To answer your own questions, I need to know a little about you. Please sign in or create a free Nexus account, then I can tailor my advice to your interests, results and recommendations. Until then, you can tap any of the questions about Nexus below.';

const LINK_BASE =
  'inline-flex h-10 items-center justify-center rounded-pill px-4 text-body-sm font-semibold transition-all duration-200';

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
  const { profile, isAuthenticated } = useAuth();
  const location = useLocation();
  const chat = useChat();
  const { summary, loading: loadingSummary } = useChatContextSummary();

  const [input, setInput] = useState('');
  // Visitors: questions and fixed answers, kept in this panel only (never stored).
  const [guestMessages, setGuestMessages] = useState([]);

  const isGuest = !isAuthenticated;
  const messages = isGuest ? guestMessages : chat.messages;
  const hasHistory = isGuest ? guestMessages.length > 0 : chat.hasHistory;
  const loadingHistory = isGuest ? false : chat.loadingHistory;
  const { streaming, error, stop, clearError } = chat;

  // A question typed before signing in waits in the composer; the student sends it.
  useEffect(() => {
    if (!isAuthenticated) return;
    const pending = takePendingQuestion();
    if (pending) setInput(pending);
  }, [isAuthenticated]);

  const askedByGuest = new Set(
    guestMessages.filter((m) => m.sender === 'user').map((m) => m.message)
  );
  const guestQuestions = GUEST_FAQ.map((f) => f.question).filter((q) => !askedByGuest.has(q));
  const showSignIn = isGuest && guestMessages.at(-1)?.message === SIGN_IN_REPLY;

  /**
   * Signed-in students reach the assistant. Visitors get the fixed answer to a
   * question about Nexus, or — for anything they type — a request to sign in.
   */
  const ask = (text) => {
    if (isGuest) {
      const answer = guestAnswerFor(text);
      if (!answer) savePendingQuestion(text);
      const id = `guest-${Date.now()}-${guestMessages.length}`;
      setGuestMessages((prev) => [
        ...prev,
        { id, sender: 'user', message: text },
        { id: `${id}-reply`, sender: 'assistant', message: answer ?? SIGN_IN_REPLY },
      ]);
      return;
    }
    clearError();
    chat.send(text);
  };
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
    ask(text);
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

      {!isGuest && <ContextDisclosure summary={summary} loading={loadingSummary} />}

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
            {!hasHistory && isGuest && (
              <div className="mb-4">
                <p className="text-body text-ink-900">
                  Hi! I can tell you about Nexus and how to use it. Tap a question below to get
                  started.
                </p>
                <p className="mt-2 text-body-sm text-ink-700">
                  Want advice about your own interests, results or recommendations? Sign in and I
                  can tailor my answers to you.
                </p>
              </div>
            )}

            {!hasHistory && !isGuest && (
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

            {showSignIn && (
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Sign in to chat">
                <Link
                  to="/login"
                  state={{ from: location }}
                  onClick={onClose}
                  className={`${LINK_BASE} bg-pine-700 text-white hover:bg-pine-900`}
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  onClick={onClose}
                  className={`${LINK_BASE} border border-ink-300 bg-surface text-ink-900 hover:border-pine-300 hover:bg-pine-50`}
                >
                  Create account
                </Link>
              </div>
            )}

            {isGuest && guestQuestions.length > 0 && (
              <div className="mt-4">
                <SuggestedQuestions
                  questions={guestQuestions}
                  label={hasHistory ? 'More about Nexus:' : 'Questions about Nexus:'}
                  onSelect={ask}
                />
              </div>
            )}

            {!isGuest && !hasHistory && !streaming && (
              <div className="mt-4">
                <SuggestedQuestions summary={summary} disabled={streaming} onSelect={ask} />
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
            placeholder={isGuest ? 'Ask your own question (sign-in needed)…' : 'Ask a question…'}
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
