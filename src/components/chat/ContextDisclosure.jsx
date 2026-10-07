import { useState } from 'react';
import { EDUCATION_LEVEL_LABELS } from '@/types';

/**
 * "What I know about you" (ui-spec §8.4).
 *
 * A deliberate transparency device with no equivalent in a general chat
 * product. It lists exactly the fields sent to Gemini per architecture.md §12.2,
 * which does two things: the student understands why answers are personalised,
 * and the data-minimisation claim becomes visible rather than merely asserted.
 *
 * Collapsed by default.
 *
 * @param {{ summary: any, loading: boolean }} props
 */
export function ContextDisclosure({ summary, loading }) {
  const [open, setOpen] = useState(false);

  const facts = [];
  if (summary?.hollandCode) facts.push(`Holland Code ${summary.hollandCode}`);
  if (summary?.educationLevel) {
    facts.push(EDUCATION_LEVEL_LABELS[summary.educationLevel] ?? summary.educationLevel);
  }
  if (summary?.careerGoal) facts.push(`Goal: ${summary.careerGoal}`);
  if (summary?.strengths?.length) facts.push(`Strong in ${summary.strengths.join(', ')}`);
  if (summary?.recommendationCount) {
    facts.push(`${summary.recommendationCount} current recommendations`);
  }
  if (summary?.savedCount) facts.push(`${summary.savedCount} saved items`);

  return (
    <div className="border-b border-ink-300 bg-ink-100/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2 text-left text-caption text-ink-700 hover:text-ink-900"
      >
        <span>What I know about you</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="px-4 pb-3">
          {loading ? (
            <p className="text-body-sm text-ink-500">Checking…</p>
          ) : facts.length === 0 ? (
            <p className="text-body-sm text-ink-700">
              Nothing yet. Complete your profile and the interest assessment and I&rsquo;ll be able
              to tailor answers to you.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-1 text-body-sm text-ink-900">
                {facts.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              <p className="mt-2 text-caption text-ink-500">
                That is all that is sent. Your email, full name and individual grades never are.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ContextDisclosure;
