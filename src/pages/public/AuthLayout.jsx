import { config } from '@/config/env';
import { Alert } from '@/components/ui';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@/styles/auth.css';

/**
 * Shared frame for the sign-in screens: one clean card on a light background.
 *
 * @param {{ title: string, subtitle?: string, children: React.ReactNode, footer?: React.ReactNode }} props
 */
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-stage">
      <div className="auth-card">
        <h1>{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}

        {!config.isConfigured && (
          <Alert variant="warning" title="Sign-in is not connected yet" className="mt-4">
            Supabase credentials aren’t configured in this environment, so account actions won’t
            complete. The form and validation still work.
          </Alert>
        )}

        <div className="auth-body">{children}</div>
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default AuthLayout;
