/**
 * The profile answers that scholarship eligibility checks use (supabase/functions/_shared/scholarship.ts).
 * A criterion whose answer is missing is shown as "not met" or "can't check", so the profile
 * screens list these and say which are still empty.
 *
 * @param {{
 *   nationality?: string | null, educationLevel?: string | null,
 *   careerGoal?: string | null, targetIndustry?: string | null, gradeCount?: number
 * }} answers
 * @returns {{ id: string, label: string, done: boolean, detail: string, tab: 'account' | 'education' | 'results' | 'scholarships' }[]}
 */
export function eligibilityInputs({
  nationality,
  educationLevel,
  careerGoal,
  targetIndustry,
  birthYear,
  householdIncomeBand,
  gradeCount = 0,
}) {
  return [
    {
      id: 'citizenship',
      label: 'Citizenship',
      done: Boolean(nationality),
      detail: 'Checks scholarships for Malaysian citizens.',
      tab: 'scholarships',
    },
    {
      id: 'age',
      label: 'Year of birth',
      done: Boolean(birthYear),
      detail: 'Checks age limits.',
      tab: 'scholarships',
    },
    {
      id: 'income',
      label: 'Household income',
      done: Boolean(householdIncomeBand),
      detail: 'Checks household income limits.',
      tab: 'scholarships',
    },
    {
      id: 'education',
      label: 'Education level',
      done: Boolean(educationLevel),
      detail: 'Checks which level a scholarship is open to.',
      tab: 'education',
    },
    {
      id: 'field',
      label: 'Field you want to study',
      done: Boolean((careerGoal ?? '').trim() || (targetIndustry ?? '').trim()),
      detail: 'Checks scholarships limited to a field.',
      tab: 'education',
    },
    {
      id: 'results',
      label: 'SPM results',
      done: gradeCount > 0,
      detail: 'Checks minimum grades, credits and subject grades.',
      tab: 'results',
    },
  ];
}
