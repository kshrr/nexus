import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { Button, Input } from '@/components/ui';
import { validateEmail } from '@/lib/validation';
import { AuthLayout } from './AuthLayout';

/**
 * Login (FR02). Foundation: wired to Supabase Auth via AuthContext. Failure
 * messaging does not distinguish "no such account" from "wrong password"
 * (architecture.md §5.3) — account-enumeration prevention.
 */
export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState(/** @type {{ email?: string, form?: string }} */ ({}));
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) return setErrors({ email: emailError });
    setErrors({});
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) {
      setErrors({ form: 'Email or password is incorrect.' });
      return;
    }
    navigate(from, { replace: true });
  }

  return (
    <AuthLayout
      title="Sign in"
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="text-pine-700 underline">
            Create an account
          </Link>
          <br />
          <Link to="/reset-password" className="text-pine-700 underline">
            Forgot your password?
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
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setErrors((p) => ({ ...p, email: validateEmail(email) ?? undefined }))}
          error={errors.email}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" fullWidth loading={busy}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}

export default Login;
