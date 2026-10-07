import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Button, Input } from '@/components/ui';
import { AuthLayout } from './AuthLayout';

const MAX_ATTEMPTS = 5; // FR-SEC-02 / V-03 — client guard; the server enforces the real cap.

/**
 * Email verification (FR01 / NFR01, architecture.md §5.2).
 *
 * The 6-digit OTP, its 10-minute expiry and single use are enforced by Supabase
 * Auth. This screen adds the attempt cap: after 5 wrong entries the field locks
 * and a fresh code must be requested. On success a session is issued and the
 * user is routed to /profile-setup.
 */
export function Verify() {
  const { verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  const locked = attemptsLeft <= 0;

  async function onSubmit(e) {
    e.preventDefault();
    if (locked) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setError('');
    setBusy(true);
    const { error: err } = await verifyOtp(email, code);
    setBusy(false);

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
    await resendOtp(email);
    setResent(true);
    setAttemptsLeft(MAX_ATTEMPTS);
    setError('');
    setCode('');
  }

  return (
    <AuthLayout
      title="Check your email"
      subtitle={
        email
          ? `We sent a 6-digit code to ${email}. It expires in 10 minutes.`
          : 'Enter the 6-digit code we emailed you.'
      }
      footer={
        <Link to="/login" className="text-pine-700 underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          error={error}
          disabled={locked}
          required
        />
        <Button type="submit" fullWidth loading={busy} disabled={locked}>
          Verify and continue
        </Button>
        <button
          type="button"
          className="text-body-sm text-pine-700 underline disabled:text-ink-500"
          disabled={!email || (resent && !locked)}
          onClick={onResend}
        >
          {resent ? 'New code sent — check your inbox' : 'Resend code'}
        </button>
      </form>
    </AuthLayout>
  );
}

export default Verify;
