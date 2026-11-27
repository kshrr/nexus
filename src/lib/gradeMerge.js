/**
 * Put grades read from a result slip into the grade-table state: each found
 * subject is added (if missing) and its "SPM actual" cell set. Form 4 and
 * trial grades the student already entered are left untouched.
 *
 * @param {string[]} selectedCodes
 * @param {Record<string, Record<string, string>>} grades
 * @param {{ code: string, grade: string }[]} found
 */
export function mergeDetectedGrades(selectedCodes, grades, found) {
  const codes = [...selectedCodes];
  const next = { ...grades };
  for (const { code, grade } of found) {
    if (!codes.includes(code)) codes.push(code);
    next[code] = { ...next[code], spm_actual: grade };
  }
  return { selectedCodes: codes, grades: next };
}
