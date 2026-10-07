import { cn } from '@/lib/cn';

/**
 * One assessment item (ui-spec §3.6). Five full-width option rows, 48px each,
 * with the label inside the target — not a bare radio dot.
 *
 * There is deliberately no Skip control: §4.2.2 requires submission to be
 * blocked while any item is unanswered, and Figure 4.6's skip button loses
 * (Conflict C-04b, D-03).
 *
 * @param {{
 *   question: { id: number, text: string },
 *   labels: string[],
 *   value: number | null,
 *   onChange: (value: number) => void,
 *   index: number,
 *   total: number,
 *   highlight?: boolean,
 * }} props
 */
export function QuestionCard({ question, labels, value, onChange, index, total, highlight }) {
  const name = `question-${question.id}`;
  return (
    <fieldset
      className={cn(
        'rounded-modal border p-5 shadow-card md:p-8',
        highlight ? 'border-rust-600 bg-rust-100' : 'border-pine-100 bg-surface'
      )}
    >
      <legend className="sr-only">{`Question ${index + 1} of ${total}`}</legend>
      <p className="text-caption text-ink-500">
        Question {index + 1} of {total}
      </p>
      <p className="mt-3 text-h2 font-serif text-ink-900 md:text-h1">{question.text}</p>

      <div className="mt-7 flex flex-col gap-3">
        {labels.map((label, optionValue) => {
          const checked = value === optionValue;
          return (
            <label
              key={label}
              className={cn(
                'flex min-h-[56px] cursor-pointer items-center gap-3 rounded-card border px-4 transition-all duration-200',
                checked
                  ? 'border-pine-700 bg-pine-700 text-white shadow-card'
                  : 'border-ink-100 bg-paper hover:-translate-y-0.5 hover:border-pine-300 hover:bg-pine-50'
              )}
            >
              <input
                type="radio"
                name={name}
                value={optionValue}
                checked={checked}
                onChange={() => onChange(optionValue)}
                className="h-4 w-4 accent-lime"
              />
              <span className={cn('text-body-sm font-medium', checked ? 'text-white' : 'text-ink-900')}>{label}</span>
            </label>
          );
        })}
      </div>

      {highlight && (
        <p role="alert" className="mt-3 text-body-sm text-rust-600">
          This question still needs an answer.
        </p>
      )}
    </fieldset>
  );
}

export default QuestionCard;
