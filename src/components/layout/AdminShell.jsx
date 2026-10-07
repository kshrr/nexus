import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { ADMIN_NAV } from '@/config/navigation';
import { useAuth } from '@/context/useAuth';
import { Icon } from '@/components/ui';
import { SignOutButton } from './SignOutButton';

const NAV_ICONS = {
  '/admin': 'chart',
  '/admin/scholarships': 'scholarship',
  '/admin/scholarship-discovery': 'search',
  '/admin/crawler': 'refresh',
  '/admin/updates': 'alert',
  '/admin/courses': 'database',
  '/admin/audit': 'shield',
};

/**
 * Admin shell — deliberately NOT the student shell (ui-spec §1.4). Dark top bar,
 * white text, persistent "Admin" label. Two reasons: it prevents an admin
 * control ever appearing inside a student view, and it makes the privilege
 * boundary visible to whoever is using it.
 */
export function AdminShell() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-paper lg:flex">
      <aside className="bg-pine-900 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <div className="flex min-h-16 items-center justify-between border-b border-pine-700 px-4 py-3 lg:block lg:min-h-0 lg:px-6 lg:py-7">
          <div>
            <span className="font-serif text-h3 font-semibold tracking-tight">Nexus</span>
            <span className="ml-2 rounded-pill bg-lime px-2 py-0.5 text-caption text-pine-900">
              Admin
            </span>
          </div>
          <p className="mt-2 hidden text-caption text-pine-300 lg:block">
            Content operations workspace
          </p>
          <div className="lg:hidden">
            <SignOutButton className="text-pine-100 hover:text-white" />
          </div>
        </div>

        <nav
          className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3 lg:py-6"
          aria-label="Admin"
        >
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-3 rounded-input px-3 py-2.5 text-body-sm font-medium text-pine-100 transition-colors hover:bg-pine-700 hover:text-white',
                  isActive && 'bg-white text-pine-900 shadow-sm hover:bg-white hover:text-pine-900'
                )
              }
            >
              <Icon name={NAV_ICONS[item.to]} className="h-3.5 w-3.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden border-t border-pine-700 p-4 lg:block">
          {user?.email && <p className="mb-2 truncate text-caption text-pine-300">{user.email}</p>}
          <SignOutButton className="text-pine-100 hover:text-white" />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <main id="main" className="mx-auto max-w-screen-2xl px-4 py-6 md:px-8 md:py-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminShell;
