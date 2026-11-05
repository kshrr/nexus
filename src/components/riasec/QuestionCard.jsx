import { cn } from '@/lib/cn';
import '@/styles/rail-assessment.css';

/**
 * One assessment item with five face-icon tiles. Native radio inputs keep
 * keyboard selection and the original 0..4 response values intact.
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
    <fieldset className={cn('rail-question-card', highlight && 'needs-answer')}>
      <legend className="sr-only">{`Question ${index + 1} of ${total}: ${question.text}`}</legend>
      <p className="rail-question-position">
        Question {index + 1} of {total}
      </p>
      <p className="rail-question-text">{question.text}</p>
      <p className="rail-question-hint">Choose how much you would enjoy this activity.</p>

      <div className="rail-response-options">
        {labels.map((label, optionValue) => {
          const checked = value === optionValue;
          return (
            <label
              key={label}
              className={cn(
                'rail-response',
                `rail-response-${optionValue}`,
                checked && 'is-selected'
              )}
            >
              <input
                type="radio"
                name={name}
                value={optionValue}
                checked={checked}
                onChange={() => onChange(optionValue)}
                className="sr-only"
              />
              <SentimentFace value={optionValue} />
              <span className="rail-response-label">{label}</span>
              <span className="rail-response-check" aria-hidden="true">
                ✓
              </span>
            </label>
          );
        })}
      </div>

      {highlight && (
        <p role="alert" className="rail-question-warning">
          This question still needs an answer.
        </p>
      )}
    </fieldset>
  );
}

function SentimentFace({ value }) {
  const mouths = [
    'M13 29Q22 18 31 29',
    'M14 28Q22 22 30 28',
    'M14 27H30',
    'M14 25Q22 33 30 25',
    'M13 24Q22 38 31 24Z',
  ];
  return (
    <svg className="rail-response-face" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <circle cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="15.5" cy="17" r="1.6" fill="currentColor" />
      <circle cx="28.5" cy="17" r="1.6" fill="currentColor" />
      {value === 0 && (
        <path
          d="M12 12L18 14M26 14L32 12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
      <path
        d={mouths[value] || mouths[2]}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default QuestionCard;
