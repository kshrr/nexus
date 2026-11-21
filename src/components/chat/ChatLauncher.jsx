import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Icon } from '@/components/ui';
import { hasPendingQuestion } from '@/lib/chatPending';

// The panel and its queries load on first open, not on every page (ui-spec §14).
const ChatPanel = lazy(() => import('./ChatPanel').then((m) => ({ default: m.ChatPanel })));

/**
 * Floating launcher (FR-CHAT-01, ui-spec §8.2).
 *
 * Shown to everyone, signed in or not. Anonymous visitors can open the panel,
 * but the panel asks them to sign in before any question is sent — the
 * assistant needs a session to authenticate `/api/chat`, and its value is the
 * student's own context.
 *
 * After signing in, a question the visitor typed is waiting in the composer,
 * so the launcher reopens the panel once on the page they return to.
 *
 * @param {{ aboveTabBar?: boolean }} props  true where the mobile bottom tab bar
 *   is shown (the student shell), so the button sits above it.
 */
export function ChatLauncher({ aboveTabBar = true }) {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated && pathname !== '/profile-setup' && hasPendingQuestion()) setOpen(true);
  }, [isAuthenticated, pathname]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Nexus advisor"
          className={`group fixed right-4 z-30 flex h-14 items-center justify-center gap-2 rounded-pill bg-pine-700 px-4 text-white shadow-lift transition-all duration-200 hover:-translate-y-1 hover:bg-pine-900 md:bottom-6 md:right-6 ${aboveTabBar ? 'bottom-[80px]' : 'bottom-4'}`}
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
