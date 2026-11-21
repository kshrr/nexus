import { Outlet, useLocation } from 'react-router-dom';
import { PublicHeader } from './PublicHeader';
import { Footer } from './Footer';
import { ChatLauncher } from '@/components/chat/ChatLauncher';
import '@/styles/landing.css';
import '@/styles/course-catalogue.css';

/** Sign-in flow screens: the visitor is already signing in, so no chat button. */
const AUTH_PATHS = new Set(['/login', '/register', '/verify', '/reset-password']);

/**
 * Shell for public marketing + auth pages. Renders via a layout route so the
 * header/footer mount once (react-router <Outlet>).
 *
 * The chat launcher is available here to everyone. Visitors can read fixed
 * answers about Nexus; their own questions need sign-in (see ChatPanel).
 */
export function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div
      className={`nexus-public-page flex min-h-screen flex-col bg-surface${pathname === '/' ? ' rail-public-page' : ''}${pathname === '/courses' || pathname.startsWith('/courses/') ? ' course-public-page' : ''}${pathname === '/careers' || pathname.startsWith('/careers/') ? ' career-public-page' : ''}`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-input focus:bg-pine-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <PublicHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {!AUTH_PATHS.has(pathname) && <ChatLauncher aboveTabBar={false} />}
    </div>
  );
}

export default PublicLayout;
