import { Outlet } from 'react-router-dom';
import { PublicHeader } from './PublicHeader';
import { Footer } from './Footer';
import '@/styles/rail-admin.css';

/**
 * Admin workspace uses the shared header/footer. Its role-specific links
 * live in the header's Workspace menu instead of a second navigation sidebar.
 */
export function AdminShell() {
  return (
    <div className="site-admin-shell rail-admin-shell min-h-screen flex flex-col bg-paper">
      <PublicHeader />
      <div className="site-shell-body flex-1">
        <div className="min-w-0 flex-1">
          <main id="main" className="mx-auto max-w-screen-2xl px-4 py-6 md:px-8 md:py-8 lg:px-10">
            <Outlet />
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default AdminShell;
