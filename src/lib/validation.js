/**
 * Client-side form validation helpers (UX feedback only — never trusted;
 * enforcement is server-side per architecture.md §1.2).
 *
 * Password policy: min 8 chars, at least one letter and one digit
 * (architecture.md §5.1 / D-36).
 */

/** @param {string} value @returns {string | null} error message or null */
export function validateEmail(value) {
  const v = value.trim();
  if (!v) return 'Enter your email address.';
  // Intentionally permissive; the real check is the verification email.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return 'Enter an email address like name@example.com';
  }
  return null;
}

/** @param {string} value @returns {string | null} */
export function validatePassword(value) {
  if (!value) return 'Enter a password.';
  if (value.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return 'Include at least one letter and one number.';
  }
  return null;
}

/** @param {string} value @returns {string | null} */
export function validateFullName(value) {
  const v = value.trim();
  if (!v) return 'Enter your full name.';
  if (v.length > 120) return 'That name is too long.';
  return null;
}

/**
 * Live password requirement checklist for the register hint (ui-spec §3.2:
 * "a hint is actionable, a meter is judgemental").
 * @param {string} value
 * @returns {{ label: string, met: boolean }[]}
 */
export function passwordChecklist(value) {
  return [
    { label: 'At least 8 characters', met: value.length >= 8 },
    { label: 'A letter', met: /[A-Za-z]/.test(value) },
    { label: 'A number', met: /[0-9]/.test(value) },
  ];
}
