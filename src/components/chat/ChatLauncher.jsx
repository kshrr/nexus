import { lazy, Suspense, useState } from 'react';
import { useAuth } from '@/context/useAuth';
import { Icon } from '@/components/ui';

// The panel and its queries load on first open, not on every page (ui-spec §14).
const ChatPanel = lazy(() => import('./ChatPanel').then((m) => ({ default: m.ChatPanel })));

/**
 * Floating launcher (FR-CHAT-01, ui-spec §8.2).
 *
 * Bottom-right, 56px, offset above the mobile tab bar so it never overlaps.
 * Not rendered for anonymous visitors — the assistant needs a session, both to
 * authenticate the Edge Function call and because its whole value is the
 * student's own context.
 */
export function ChatLauncher() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Nexus advisor"
          className="group fixed bottom-[80px] right-4 z-30 flex h-14 items-center justify-center gap-2 rounded-pill bg-pine-700 px-4 text-white shadow-lift transition-all duration-200 hover:-translate-y-1 hover:bg-pine-900 md:bottom-6 md:right-6"
        >
          <Icon name="sparkles" className="h-5 w-5" />
          <span className="hidden text-body-sm font-semibold sm:inline">Ask Nexus</span>
        </button>
      )}

      {open && (
        <Suspense fallback={null}>
          <ChatPanel open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

export default ChatLauncher;
