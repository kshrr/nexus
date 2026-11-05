import { Outlet, useLocation } from 'react-router-dom';
import { PublicHeader } from './PublicHeader';
import { Footer } from './Footer';
import '@/styles/landing.css';
import '@/styles/course-catalogue.css';

/**
 * Shell for public marketing + auth pages. Renders via a layout route so the
 * header/footer mount once (react-router <Outlet>).
 */
export function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div
      className={`nexus-public-page flex min-h-screen flex-col bg-surface${pathname === '/' ? ' rail-public-page' : ''}${pathname === '/courses' || pathname.startsWith('/courses/') ? ' course-public-page' : ''}`}
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
    </div>
  );
}

export default PublicLayout;
