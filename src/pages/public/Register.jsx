import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  validateEmail,
  validateFullName,
  validatePassword,
  passwordChecklist,
} from '@/lib/validation';
import { PRIVACY_POLICY_VERSION } from '@/config/policy';
import { AuthLayout } from './AuthLayout';

/**
 * Register (FR01, architecture.md §5.1). Creates the Supabase Auth user in an
 * unverified state, records consent (FR-SEC-10) via sign-up metadata (no session
 * exists yet, so the handle_new_user trigger persists it), and routes to
 * /verify. No session is issued here. Password hint is a checklist, not a
 * strength meter (ui-spec §3.2).
 */
export function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ fullName: '', email: '', password: '', consent: false });
  const [errors, setErrors] = useState(/** @type {Record<string, string | undefined>} */ ({}));
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = key === 'consent' ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [key]: value }));
  };

  function validate() {
    const next = {
      fullName: validateFullName(form.fullName) ?? undefined,
      email: validateEmail(form.email) ?? undefined,
      password: validatePassword(form.password) ?? undefined,
      consent: form.consent ? undefined : 'You need to agree before creating an account.',
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    const { error } = await signUp({
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      consentVersion: PRIVACY_POLICY_VERSION,
    });
    setBusy(false);
    if (error) {
      const duplicate = /already|exist|registered/i.test(error.message);
      setErrors((p) => ({
        ...p,
        email: duplicate ? 'An account with this email already exists.' : undefined,
        form: duplicate
          ? undefined
          : "Couldn't reach the server. Check your connection and try again.",
      }));
      return;
    }
    navigate('/verify', { state: { email: form.email.trim() } });
  }

  return (
    <AuthLayout
      title="Create your account"
      footer={
        <>
          Already have one?{' '}
          <Link to="/login" className="text-pine-700 underline">
            Sign in instead
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {errors.form && (
          <p role="alert" className="text-body-sm text-rust-600">
            {errors.form}
          </p>
        )}
        <Input
          label="Full name"
          autoComplete="name"
          value={form.fullName}
          onChange={set('fullName')}
          onBlur={() =>
            setErrors((p) => ({ ...p, fullName: validateFullName(form.fullName) ?? undefined }))
          }
          error={errors.fullName}
          required
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          onBlur={() => setErrors((p) => ({ ...p, email: validateEmail(form.email) ?? undefined }))}
          error={errors.email}
          required
        />
        <div>
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={errors.password}
            required
          />
          <ul className="mt-2 space-y-1">
            {passwordChecklist(form.password).map((rule) => (
              <li
                key={rule.label}
                className={cn('text-body-sm', rule.met ? 'text-pine-700' : 'text-ink-500')}
              >
                <span aria-hidden="true">{rule.met ? '✓' : '○'}</span> {rule.label}
              </li>
            ))}
          </ul>
        </div>

        <label className="flex items-start gap-2 text-body-sm text-ink-700">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={set('consent')}
            className="mt-1 h-4 w-4"
          />
          <span>
            I’ve read the{' '}
            <Link to="/privacy" className="text-pine-700 underline">
              privacy notice
            </Link>{' '}
            and agree to Nexus storing my profile and results.
          </span>
        </label>
        {errors.consent && (
          <p role="alert" className="text-body-sm text-rust-600">
            {errors.consent}
          </p>
        )}

        <Button type="submit" fullWidth loading={busy}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

export default Register;
