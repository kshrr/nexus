import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Button, Input } from '@/components/ui';
import { AuthLayout } from './AuthLayout';
import { validateEmail } from '@/lib/validation';

const MAX_ATTEMPTS = 5; // UX guard only; server rate limits remain authoritative.

/**
 * Email verification (FR01 / NFR01, architecture.md §5.2).
 *
 * Supabase generates and checks the OTP; length and expiry are project settings.
 * After 5 wrong entries this screen locks until a fresh code is requested.
 * Both code verification and a session from the email link lead to profile setup.
 */
export function Verify() {
  const { verifyOtp, resendOtp, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registrationEmail = location.state?.email ?? '';
  const [enteredEmail, setEnteredEmail] = useState('');
  const email = (registrationEmail || enteredEmail).trim();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  const locked = attemptsLeft <= 0;

  async function onSubmit(e) {
    e.preventDefault();
    if (locked || busy || loading) return;
    if (validateEmail(email)) {
      setError('Enter the email address you used to register.');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setError('');
    setResent(false);
    setBusy(true);
    let err;
    try {
      ({ error: err } = await verifyOtp(email, code));
    } catch {
      setError('Could not verify your code. Check your connection and try again.');
      return;
    } finally {
      setBusy(false);
    }

    if (!err) {
      navigate('/profile-setup', { replace: true });
      return;
    }

    if (/expired/i.test(err.message)) {
      setError('This code has expired. Request a new one.');
      return;
    }
    const left = attemptsLeft - 1;
    setAttemptsLeft(left);
    setCode('');
    setError(
      left > 0
        ? `That code isn't right. ${left} attempt${left === 1 ? '' : 's'} remaining.`
        : 'Too many attempts. Request a new code to continue.'
    );
  }

  async function onResend() {
    if (busy || loading) return;
    if (validateEmail(email)) {
      setError('Enter the email address you used to register.');
      return;
    }
    setBusy(true);
    setResent(false);
    setError('');
    try {
      const { error: err } = await resendOtp(email);
      if (err) {
        setError(err.message);
        return;
      }
      setResent(true);
      setAttemptsLeft(MAX_ATTEMPTS);
      setCode('');
    } catch {
      setError('Could not send a new code. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!loading && isAuthenticated) return <Navigate to="/profile-setup" replace />;

  return (
    <AuthLayout
      title="Check your email"
      subtitle={
        registrationEmail
          ? `We sent a verification email to ${registrationEmail}. Use the confirmation link, or enter the 6-digit code below if your email includes one.`
          : 'Use the confirmation link in your email, or enter your registration email and 6-digit code below.'
      }
      footer={
        <Link to="/login" className="text-pine-700 underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {!registrationEmail && (
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={enteredEmail}
            onChange={(e) => setEnteredEmail(e.target.value)}
            disabled={busy || loading}
            required
          />
        )}
        <Input
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          error={error}
          disabled={locked || busy || loading}
          required
        />
        <Button type="submit" fullWidth loading={busy} disabled={locked || loading}>
          Verify and continue
        </Button>
        <button
          type="button"
          className="text-body-sm text-pine-700 underline disabled:text-ink-500"
          disabled={!email || busy || loading}
          onClick={onResend}
        >
          Resend code
        </button>
        {resent && (
          <p role="status" className="text-body-sm text-pine-700">
            New code sent — check your inbox.
          </p>
        )}
      </form>
    </AuthLayout>
  );
}

export default Verify;
