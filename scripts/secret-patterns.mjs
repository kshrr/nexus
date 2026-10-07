/**
 * Credential shapes that must never appear in a client-delivered asset.
 *
 * Extracted so both the scanner (check-bundle-secrets.mjs) and its test suite
 * use the same list — a detection rule that is never exercised is worse than no
 * rule, because it produces false confidence.
 *
 * Add a row rather than widening an existing regex, so each finding names the
 * credential it found.
 */
export const PATTERNS = [
  { name: 'Google API key (legacy AI Studio, AIza…)', re: /AIza[0-9A-Za-z_-]{30,}/g },
  { name: 'Google API key (current AI Studio, AQ.…)', re: /\bAQ\.[A-Za-z0-9_-]{20,}/g },
  { name: 'Gemini API endpoint', re: /generativelanguage\.googleapis\.com/g },
  { name: 'Google OAuth client secret', re: /GOCSPX-[A-Za-z0-9_-]{20,}/g },
  { name: 'Supabase service-role JWT', re: /"role"\s*:\s*"service_role"/g },
  { name: 'Supabase secret key (sb_secret_…)', re: /\bsb_secret_[A-Za-z0-9_-]{20,}/g },
  { name: 'GitHub token', re: /\bgh[pousr]_[0-9A-Za-z]{30,}/g },
  { name: 'OpenAI-style key', re: /\bsk-[A-Za-z0-9_-]{30,}/g },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];

/** Secrets whose literal value is searched for when it is readable locally. */
export const SECRET_ENV_NAMES = [
  'GEMINI_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GITHUB_DISPATCH_TOKEN',
  'BRAVE_SEARCH_API_KEY',
  'SUPABASE_DB_PASSWORD',
];

/**
 * Legitimate mentions of a forbidden WORD, never of a secret VALUE:
 *   * src/config/env.js lists secret NAMES so it can throw if one is ever
 *     mis-prefixed with VITE_ — that guardrail is why the name appears at all
 *   * the privacy notice names Google's Gemini service, which it must
 */
export const ALLOWED_MENTIONS = [
  'VITE_GEMINI_API_KEY',
  'Google’s Gemini service',
  "Google's Gemini service",
];

/**
 * Scan one blob of text. Returns a finding per match, excluding the allowed
 * word mentions above.
 * @param {string} content
 * @returns {{ name: string, sample: string }[]}
 */
export function scanText(content) {
  const findings = [];
  for (const { name, re } of PATTERNS) {
    for (const match of content.match(new RegExp(re.source, re.flags)) ?? []) {
      if (ALLOWED_MENTIONS.some((a) => match.includes(a))) continue;
      findings.push({ name, sample: `${match.slice(0, 16)}…` });
    }
  }
  return findings;
}
