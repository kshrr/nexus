import { Outlet, useLocation } from 'react-router-dom';
import { BottomTabBar } from './BottomTabBar';
import { PublicHeader } from './PublicHeader';
import { Footer } from './Footer';
import { Breadcrumbs } from './Breadcrumbs';
import { ChatLauncher } from '@/components/chat/ChatLauncher';
import { JourneyLayout } from '@/components/journey/JourneyLayout';
import '@/styles/rail-dashboard.css';
import '@/styles/station-chrome.css';

/**
 * Student application shell (ui-spec §1.3 / §11):
 *  - all widths: shared site header/footer, without a sidebar
 *  - mobile retains the bottom tab bar
 *
 * The chat launcher overlay (ui-spec §8) is mounted here and in PublicLayout,
 * so it is available on every student and public page (not admin or sign-in).
 */
export function AppShell() {
  const { pathname } = useLocation();
  const isCareerCatalogue = pathname === '/careers';
  const ownsBreadcrumbs =
    pathname === '/find-your-path' || pathname === '/profile' || pathname === '/profile-setup';
  const isStation = pathname === '/profile' || pathname === '/profile-setup';
  const isJourney =
    pathname === '/find-your-path' ||
    pathname.startsWith('/find-your-path/') ||
    pathname === '/recommendations';
  return (
    <div
      className={`site-app-shell min-h-screen flex flex-col bg-paper${pathname === '/dashboard' ? ' rail-dashboard-shell' : ''}${isJourney || isStation ? ' station-page' : ''}`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-input focus:bg-pine-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <PublicHeader />
      {!ownsBreadcrumbs && <Breadcrumbs />}
      <div
        className={`site-shell-body flex-1${pathname === '/dashboard' ? ' rail-dashboard-shell' : ''}`}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <main
            id="main"
            className={
              isCareerCatalogue
                ? 'flex-1 min-w-0 pb-24 lg:pb-12'
                : 'flex-1 px-4 pb-24 pt-6 md:px-8 md:pt-8 lg:pb-12 lg:pt-10'
            }
          >
            <div className={isCareerCatalogue ? 'min-w-0' : 'mx-auto max-w-6xl'}>
              {isJourney ? (
                <JourneyLayout>
                  <Outlet />
                </JourneyLayout>
              ) : (
                <Outlet />
              )}
            </div>
          </main>
        </div>
      </div>
      <Footer />
      <BottomTabBar />
      <ChatLauncher />
    </div>
  );
}

export default AppShell;
