/**
 * A question an anonymous visitor typed into the chat before being asked to
 * sign in. Kept in sessionStorage (this tab only, cleared when it closes) so it
 * can be put back in the composer after login. It is never sent anywhere
 * until the signed-in student presses Send themselves.
 */
const KEY = 'nexus.chat.pendingQuestion';

/** @param {string} question */
export function savePendingQuestion(question) {
  try {
    sessionStorage.setItem(KEY, question);
  } catch {
    /* storage blocked — the visitor simply retypes after signing in */
  }
}

/** @returns {boolean} */
export function hasPendingQuestion() {
  try {
    return Boolean(sessionStorage.getItem(KEY));
  } catch {
    return false;
  }
}

/** Reads and clears the pending question. @returns {string} */
export function takePendingQuestion() {
  try {
    const value = sessionStorage.getItem(KEY) ?? '';
    sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return '';
  }
}
