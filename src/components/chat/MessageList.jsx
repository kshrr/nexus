import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { mentionsScholarship } from '@/lib/chatSafety';
import { AiDisclosure } from './AiDisclosure';

/**
 * One message (ui-spec §8.6).
 *
 * Student messages right-aligned; assistant messages left-aligned with a border
 * and a small "Nexus" mark. There is deliberately NO avatar and no persona name
 * like "Alex" — this is a system, and saying so is part of the honesty.
 *
 * Content is rendered as plain text. React escapes it, and
 * `dangerouslySetInnerHTML` is never used (§12.4).
 */
export function MessageBubble({ message }) {
  const isUser = message.sender === 'user';
  const showInlineDisclosure =
    !isUser && !message.streaming && mentionsScholarship(message.message);

  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      {!isUser && <span className="mb-1 text-caption text-ink-500">Nexus</span>}
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap break-words px-3 py-2 text-body-sm',
          isUser
            ? 'rounded-modal rounded-br-sm bg-pine-700 text-white'
            : 'rounded-modal rounded-bl-sm border border-pine-100 bg-surface text-ink-900 shadow-sm'
        )}
      >
        {message.message}
        {message.streaming && (
          <span aria-hidden="true" className="ml-0.5 inline-block animate-pulse">
            ▍
          </span>
        )}
        {message.failed && !message.message && (
          <span className="text-ink-500">No reply — try again.</span>
        )}
      </div>
      {showInlineDisclosure && <AiDisclosure variant="inline" />}
    </div>
  );
}

/**
 * The conversation. Streams into an `aria-live="polite"` region and marks
 * itself busy while a reply is arriving, so a screen reader announces the
 * finished answer rather than every token (ui-spec §13).
 */
export function MessageList({ messages, streaming }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  return (
    <div
      className="flex flex-col gap-4"
      aria-live="polite"
      aria-busy={streaming || undefined}
      aria-label="Conversation"
    >
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {streaming && messages[messages.length - 1]?.message === '' && (
        <div className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-pulse rounded-pill bg-ink-300"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

export default MessageList;
