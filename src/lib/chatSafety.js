/**
 * Client-side output filtering (architecture.md §12.4 / FR-SEC-08).
 *
 * The Edge Function already filters every chunk and the final text before
 * persisting. This is the second layer, applied immediately before render, so
 * an unsafe link cannot reach the DOM even if the server filter were bypassed
 * or an older stored message predates it.
 *
 * Responses are rendered as PLAIN TEXT with React's default escaping.
 * `dangerouslySetInnerHTML` is not used anywhere in this project.
 */

/** Mirrors LINK_ALLOWLIST in supabase/functions/_shared/chat-context.ts. */
export const LINK_ALLOWLIST = [
  'nexus.my',
  'jpa.gov.my',
  'penajaan.jpa.gov.my',
  'mara.gov.my',
  'petronas.com',
  'mohe.gov.my',
  'moe.gov.my',
  'mqa.gov.my',
  'studymalaysia.com',
];

function hostAllowed(url, allowlist) {
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    const host = hostname.toLowerCase().replace(/^www\./, '');
    return allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/**
 * Strip markdown links and bare URLs pointing outside the allowlist, keeping
 * the visible label.
 * @param {string} text
 * @param {string[]} [allowlist]
 * @returns {string}
 */
export function filterOutput(text, allowlist = LINK_ALLOWLIST) {
  if (!text) return '';
  let out = String(text).replace(/\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)/g, (match, label, url) =>
    hostAllowed(String(url).trim(), allowlist) ? match : label
  );
  out = out.replace(/\bhttps?:\/\/[^\s<>()[\]]+/gi, (url) =>
    hostAllowed(url, allowlist) ? url : '[link removed]'
  );
  return out;
}

/**
 * Answers that touch scholarships get an extra inline caution
 * (ui-spec §8.8 layer 3), because scholarship records are crawled from
 * third-party sites and may be stale — or, per vulnerability V-01, manipulated.
 * @param {string} text
 * @returns {boolean}
 */
export function mentionsScholarship(text) {
  return /\b(scholarship|biasiswa|funding|bursary|award)\b/i.test(text ?? '');
}
