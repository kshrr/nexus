import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { STUDENT_NAV } from '@/config/navigation';
import { Wordmark } from './Wordmark';
import { SignOutButton } from './SignOutButton';
import { Icon } from '@/components/ui';

const NAV_ICONS = {
  '/dashboard': 'home',
  '/find-your-path': 'compass',
  '/find-your-path/assessment': 'target',
  '/find-your-path/results': 'chart',
  '/find-your-path/academic': 'book',
  '/recommendations': 'sparkles',
  '/scholarships': 'scholarship',
  '/careers': 'career',
  '/saved': 'bookmark',
  '/profile': 'user',
};

/**
 * Persistent left rail for students on ≥1280px (ui-spec §1.3). A rail rather than
 * a top bar because the student's position in a multi-stage journey should be
 * visible at all times.
 *
 * Group labels are sentence-case caption text, not tracked-out caps.
 */
export function SideRail() {
  const groups = groupNav(STUDENT_NAV);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-pine-100 bg-surface lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-5">
        <Wordmark className="px-1 py-2" />
        <p className="mt-3 rounded-card bg-pine-50 px-3 py-2 text-caption text-pine-700">
          Your education journey
        </p>
        <nav className="mt-5 flex-1 space-y-5 overflow-y-auto" aria-label="Main">
          {groups.map((group) => (
            <div key={group.name ?? 'root'}>
              {group.name && <p className="px-2 pb-1 text-caption text-ink-500">{group.name}</p>}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <RailLink item={item} icon={NAV_ICONS[item.to]} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sign out sits below a divider, at the foot of the rail (ui-spec §1.3) */}
        <div className="mt-4 border-t border-ink-300 pt-3">
          <SignOutButton variant="rail" />
        </div>
      </div>
    </aside>
  );
}

/** @param {{ item: import('@/config/navigation').NavItem }} props */
function RailLink({ item, icon }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex min-h-10 items-center justify-between rounded-input px-3 py-2 text-body-sm font-medium transition-all',
          isActive
            ? 'bg-pine-700 text-white shadow-card'
            : 'text-ink-700 hover:bg-pine-50 hover:text-pine-700'
        )
      }
    >
      <span className="flex items-center gap-3">
        <Icon name={icon} className="h-4 w-4" />
        {item.label}
      </span>
      {item.placeholder && <span className="text-caption text-ink-300">soon</span>}
    </NavLink>
  );
}

/** @param {import('@/config/navigation').NavItem[]} items */
function groupNav(items) {
  /** @type {{ name: string | null, items: import('@/config/navigation').NavItem[] }[]} */
  const out = [];
  for (const item of items) {
    const name = item.group ?? null;
    const last = out[out.length - 1];
    if (last && last.name === name) last.items.push(item);
    else out.push({ name, items: [item] });
  }
  return out;
}

export default SideRail;
