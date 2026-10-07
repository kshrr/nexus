import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Spinner } from '@/components/ui';
import NotFound from '@/pages/public/NotFound';

/**
 * Route guards (architecture.md §5.6).
 *
 * These are UX only. Every one is backed by an RLS policy in the database — a
 * user who bypasses the router reaches a page that renders empty. Returning 404
 * (not 403) from <AdminRoute> avoids confirming that an admin area exists.
 */

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <Spinner size="lg" label="Loading Nexus" />
    </div>
  );
}

/** Requires a session; otherwise sends to /login, preserving the intended path. */
export function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

/** Redirects an already-authenticated user away from /login and /register. */
export function PublicOnlyRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

/**
 * Requires a completed profile; otherwise sends to /profile-setup.
 * Wrap inside <ProtectedRoute>.
 */
export function ProfileGate({ children }) {
  const { loading, profile } = useAuth();
  if (loading) return <FullPageSpinner />;
  // When the profiles table/row is not yet available (pre-migration) we do not
  // trap the user in a redirect loop — treat "unknown" as "let them through".
  if (profile && profile.profile_completed === false) {
    return <Navigate to="/profile-setup" replace />;
  }
  return children;
}

/** Requires session AND role === 'admin'; otherwise renders the 404 page. */
export function AdminRoute({ children }) {
  const { loading, isAuthenticated, role } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!isAuthenticated || role !== 'admin') return <NotFound />;
  return children;
}
