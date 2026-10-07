import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/useAuth';

/**
 * Sign out (architecture.md §5.5): end the Supabase session, clear the cached
 * profile and role, then return to the public landing page.
 *
 * Redirecting to `/` rather than letting the route guards bounce the user to
 * `/login` matters — being dropped straight back onto a sign-in form reads like
 * the sign-out failed.
 *
 * One implementation shared by the student rail, the mobile header and the
 * admin bar so the behaviour cannot drift between them.
 *
 * @param {{ variant?: 'rail' | 'inline', className?: string }} props
 */
export function SignOutButton({ variant = 'inline', className }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } catch {
      // AuthContext clears local state even when the remote request fails. The
      // user has explicitly chosen to leave, so do not surface a stale promise
      // rejection after the route has already changed.
    } finally {
      // Navigate even if the network call failed: the local session is cleared
      // either way, so leaving the user on a protected screen would be worse.
      navigate('/', { replace: true });
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      className={cn(
        variant === 'rail'
          ? 'flex w-full items-center rounded-input border-l-[3px] border-transparent px-2 py-1.5 text-left text-body-sm text-ink-700 hover:bg-ink-100'
          : 'text-body-sm text-ink-700 hover:text-ink-900',
        'disabled:opacity-40',
        className
      )}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

export default SignOutButton;
