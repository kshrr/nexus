import { Alert, Button } from '@/components/ui';

/**
 * What happened, what to do, a retry control. Never a raw error code
 * (ui-spec §16.6).
 *
 * @param {{
 *   title?: string, message?: string, onRetry?: () => void, retryLabel?: string
 * }} props
 */
export function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't load this. Try again in a moment.",
  onRetry,
  retryLabel = 'Try again',
}) {
  return (
    <Alert
      variant="error"
      title={title}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        )
      }
    >
      {message}
    </Alert>
  );
}

export default ErrorState;
