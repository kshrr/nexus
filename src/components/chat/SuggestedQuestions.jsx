import { buildSuggestions } from '@/lib/chatSuggestions';

/**
 * Suggested questions (FR-CHAT-03, ui-spec §8.5).
 *
 * Generated from the student's actual state rather than a static list, and
 * capped at three. They double as a steer towards what the assistant can
 * usefully answer — explaining a Holland Code or a pathway difference — rather
 * than the factual lookups it must refuse (§12.3).
 *
 * `questions` overrides the generated list (used for visitors' questions about
 * Nexus, which are not capped).
 *
 * @param {{ summary?: any, questions?: string[], label?: string,
 *   onSelect: (q: string) => void, disabled?: boolean }} props
 */
export function SuggestedQuestions({
  summary,
  questions,
  label = 'Try asking:',
  onSelect,
  disabled,
}) {
  const suggestions = questions ?? buildSuggestions(summary);
  if (!suggestions.length) return null;

  return (
    <div>
      <p className="mb-2 text-caption text-ink-500">{label}</p>
      <div className="flex flex-col gap-2">
        {suggestions.map((q) => (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(q)}
            className="rounded-input border border-ink-300 bg-surface px-3 py-2 text-left text-body-sm text-ink-900 hover:border-ink-500 disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SuggestedQuestions;
