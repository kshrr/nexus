import { cn } from '@/lib/cn';

/**
 * AI disclosure, in the three layers ui-spec §8.8 specifies. Each does distinct
 * work, which is why one is not enough:
 *
 *   header       always visible, never dismissible
 *   firstSession a fuller notice, shown once per account
 *   inline       appended to answers that touch scholarships, because that data
 *                is crawled from third-party sites and may be stale or, per
 *                vulnerability V-01, manipulated
 *
 * @param {{ variant: 'header' | 'firstSession' | 'inline', onDismiss?: () => void }} props
 */
export function AiDisclosure({ variant, onDismiss, className }) {
  if (variant === 'header') {
    return (
      <p className={cn('text-caption text-ink-500', className)}>AI assistant · can make mistakes</p>
    );
  }

  if (variant === 'firstSession') {
    return (
      <div
        className={cn(
          'rounded-card border-l-4 border-slate-600 bg-slate-100 p-3 text-body-sm text-ink-900',
          className
        )}
      >
        <p>
          This assistant uses AI to answer questions about your profile and Malaysian education. It
          can be wrong. Always check scholarship details on the provider&rsquo;s official site
          before applying.
        </p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-2 text-body-sm text-pine-700 underline"
          >
            Got it
          </button>
        )}
      </div>
    );
  }

  return (
    <p className={cn('mt-2 text-caption text-ink-500', className)}>
      Check the provider&rsquo;s page for the final word.
    </p>
  );
}

export default AiDisclosure;
