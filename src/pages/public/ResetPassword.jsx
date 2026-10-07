import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Button, Input } from '@/components/ui';
import { validateEmail, validatePassword } from '@/lib/validation';
import { AuthLayout } from './AuthLayout';

/**
 * Password reset (architecture.md §5.8 / D-37 — Supabase built-in, rate-limited
 * server-side to 3/hour per email).
 *
 * Two modes on one route:
 *  - default: request a reset link. The confirmation is identical whether or not
 *    the email exists (no account enumeration).
 *  - recovery: the user arrived from the emailed link, a recovery session is
 *    active (AuthContext.recoveryMode), and they set a new password here.
 */
export function ResetPassword() {
  const { recoveryMode, requestPasswordReset, updatePassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onRequest(e) {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) return setError(err);
    setError('');
    setBusy(true);
    await requestPasswordReset(email.trim());
    setBusy(false);
    setSent(true);
  }

  async function onSetNew(e) {
    e.preventDefault();
    const err = validatePassword(password);
    if (err) return setError(err);
    setError('');
    setBusy(true);
    const { error: updErr } = await updatePassword(password);
    setBusy(false);
    if (updErr) {
      setError('That link may have expired. Request a new reset email.');
      return;
    }
    navigate('/dashboard', { replace: true });
  }

  if (recoveryMode) {
    return (
      <AuthLayout
        title="Set a new password"
        subtitle="Choose a password you haven’t used here before."
      >
        <form onSubmit={onSetNew} noValidate className="flex flex-col gap-4">
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 8 characters, with a letter and a number."
            error={error}
            required
          />
          <Button type="submit" fullWidth loading={busy}>
            Save new password
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We’ll email you a link to set a new one."
      footer={
        <Link to="/login" className="text-pine-700 underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p className="text-body-sm text-ink-700">
          If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way.
          Check your inbox and spam folder.
        </p>
      ) : (
        <form onSubmit={onRequest} noValidate className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            required
          />
          <Button type="submit" fullWidth loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export default ResetPassword;
