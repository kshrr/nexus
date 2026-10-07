import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { MOBILE_TABS } from '@/config/navigation';
import { Icon } from '@/components/ui';

const TAB_ICONS = {
  '/dashboard': 'home',
  '/find-your-path': 'compass',
  '/scholarships': 'scholarship',
  '/careers': 'career',
  '/profile': 'user',
};

/**
 * Mobile bottom tab bar (<768px), 5 items, safe-area padded (ui-spec §1.5).
 * Bottom rather than a hamburger because these five are used constantly and
 * thumb reach matters on the devices Malaysian students actually use.
 */
export function BottomTabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-pine-100 bg-surface/95 shadow-[0_-8px_28px_rgba(31,68,56,0.08)] backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex h-16 items-stretch">
        {MOBILE_TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-pine-700' : 'text-ink-500 hover:text-pine-700'
                )
              }
            >
              <Icon name={TAB_ICONS[tab.to]} className="h-5 w-5" />
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default BottomTabBar;
