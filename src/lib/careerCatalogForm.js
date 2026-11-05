import { isValidInterestCode } from './careerEvidence';
export function validateCareerCode(input) {
  const code = String(input ?? '')
    .trim()
    .toUpperCase();
  return !code || isValidInterestCode(code)
    ? null
    : 'Use one to six distinct RIASEC letters, or leave blank when unknown.';
}
export function normaliseCareerCode(input) {
  if (validateCareerCode(input)) throw new RangeError('Invalid occupational interest code');
  return (
    String(input ?? '')
      .trim()
      .toUpperCase() || null
  );
}
