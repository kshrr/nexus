import { Outlet } from 'react-router-dom';
import { SideRail } from './SideRail';
import { BottomTabBar } from './BottomTabBar';
import { MobileHeader } from './MobileHeader';
import { ChatLauncher } from '@/components/chat/ChatLauncher';

/**
 * Student application shell (ui-spec §1.3 / §11):
 *  - ≥1280px: persistent 240px left rail
 *  - <768px:  compact top header + bottom tab bar
 *
 * The chat launcher overlay (ui-spec §8) is mounted here so it is available on
 * every authenticated page and nowhere else.
 */
export function AppShell() {
  return (
    <div className="min-h-screen bg-paper lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-input focus:bg-pine-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <SideRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main id="main" className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pt-8 lg:pb-12 lg:pt-10">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomTabBar />
      <ChatLauncher />
    </div>
  );
}

export default AppShell;
