import { config } from '@/config/env';
import { Alert, Icon } from '@/components/ui';

/**
 * Shared frame for the auth screens (ui-spec §3.2): single column, ~400px,
 * offset from the top rather than vertically centred.
 *
 * @param {{ title: string, subtitle?: string, children: React.ReactNode, footer?: React.ReactNode }} props
 */
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 md:py-16">
      <div className="rounded-modal border border-pine-100 bg-surface p-6 shadow-card md:p-8">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-lime text-pine-900"><Icon name="compass" /></span>
      <h1 className="mt-6 text-display font-serif">{title}</h1>
      {subtitle && <p className="mt-2 text-body-sm text-ink-700">{subtitle}</p>}

      {!config.isConfigured && (
        <Alert variant="warning" title="Sign-in is not connected yet" className="mt-4">
          Supabase credentials aren’t configured in this environment, so account actions won’t
          complete. The form and validation still work.
        </Alert>
      )}

      <div className="mt-6">{children}</div>
      {footer && <div className="mt-6 border-t border-ink-100 pt-5 text-body-sm text-ink-700">{footer}</div>}
      </div>
    </div>
  );
}

export default AuthLayout;
