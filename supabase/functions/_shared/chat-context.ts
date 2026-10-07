/**
 * Chatbot context assembly, validation and output filtering — pure logic,
 * unit-testable.
 *
 * The single most important thing in this file is the ALLOWLIST. architecture.md
 * §12.2 resolves Conflict C-16 toward a bounded payload: a fixed, minimal,
 * server-assembled context rather than database-wide access. Two of the
 * prohibited items are load-bearing:
 *
 *   * raw scholarship descriptions — attacker-controllable crawler text, the
 *     V-01 indirect prompt-injection vector
 *   * the rule base — §3.3.2C, business logic must not be disclosed
 *
 * `buildStudentContext` is the only way context is constructed, and
 * `assertBounded` fails closed if a field outside the allowlist ever appears.
 */

export const MAX_MESSAGE_LENGTH = 1000; // §12.1 / §15
export const HISTORY_TURNS = 10; // §3.4.3 "the last ten turns"
export const TOP_RECOMMENDATIONS = 5; // §12.2
export const RATE_LIMIT_PER_HOUR = 20; // FR-SEC-04

/** Exactly the fields §12.2 permits. Anything else is a bug. */
export const PERMITTED_CONTEXT_FIELDS = [
  'first_name',
  'education_level',
  'career_goal',
  'target_industry',
  'holland_code',
  'riasec_scores',
  'top_recommendations',
  'subject_strengths',
  'saved_count',
] as const;

export type PermittedField = (typeof PERMITTED_CONTEXT_FIELDS)[number];

export interface StudentContext {
  first_name: string | null;
  education_level: string | null;
  career_goal: string | null;
  target_industry: string | null;
  holland_code: string | null;
  riasec_scores: Record<string, number> | null;
  top_recommendations: { name: string; match: number }[];
  subject_strengths: string[];
  saved_count: number;
}

export interface ChatTurn {
  sender: 'user' | 'assistant';
  message: string;
}

// ---------------------------------------------------------------------------
// Input validation (§12.1, §15)
// ---------------------------------------------------------------------------

export type MessageValidation =
  | { ok: true; message: string }
  | { ok: false; code: 'EMPTY_MESSAGE' | 'MESSAGE_TOO_LONG' | 'INVALID_MESSAGE'; message: string };

export function validateMessage(raw: unknown): MessageValidation {
  if (typeof raw !== 'string') {
    return { ok: false, code: 'INVALID_MESSAGE', message: 'Send a question as text.' };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, code: 'EMPTY_MESSAGE', message: 'Type a question first.' };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: 'MESSAGE_TOO_LONG',
      message: `Keep your question under ${MAX_MESSAGE_LENGTH} characters.`,
    };
  }
  return { ok: true, message: trimmed };
}

// ---------------------------------------------------------------------------
// Context assembly (§12.2)
// ---------------------------------------------------------------------------

/** First name only — the full name is prohibited (§12.2 PII minimisation). */
export function firstNameOf(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const first = fullName.trim().split(/\s+/)[0];
  return first || null;
}

export interface RawContextInput {
  profile?: {
    full_name?: string | null;
    education_level?: string | null;
    career_goal?: string | null;
    target_industry?: string | null;
  } | null;
  riasec?: Record<string, unknown> | null;
  recommendations?: { name: string; match_score: number }[] | null;
  strengths?: { subject_name: string; strength: string }[] | null;
  savedCount?: number | null;
}

const SCORE_COLUMNS: Record<string, string> = {
  R: 'realistic_score',
  I: 'investigative_score',
  A: 'artistic_score',
  S: 'social_score',
  E: 'enterprising_score',
  C: 'conventional_score',
};

/**
 * Build the bounded payload. Every field is copied explicitly — there is no
 * spread of a database row anywhere in this function, which is what stops an
 * added column from silently leaking to Gemini.
 */
export function buildStudentContext(raw: RawContextInput): StudentContext {
  const riasec = raw.riasec ?? null;

  let scores: Record<string, number> | null = null;
  if (riasec) {
    scores = {};
    for (const [letter, column] of Object.entries(SCORE_COLUMNS)) {
      scores[letter] = Number(riasec[column] ?? 0);
    }
  }

  return {
    first_name: firstNameOf(raw.profile?.full_name),
    education_level: raw.profile?.education_level ?? null,
    career_goal: raw.profile?.career_goal ?? null,
    target_industry: raw.profile?.target_industry ?? null,
    holland_code: typeof riasec?.holland_code === 'string' ? riasec.holland_code : null,
    riasec_scores: scores,
    top_recommendations: (raw.recommendations ?? [])
      .slice(0, TOP_RECOMMENDATIONS)
      .map((r) => ({ name: r.name, match: Math.round(Number(r.match_score)) })),
    // Label only — "Strong: Mathematics". Individual grades are prohibited.
    subject_strengths: (raw.strengths ?? [])
      .filter((s) => s.strength === 'strong')
      .map((s) => `Strong: ${s.subject_name}`),
    saved_count: Number(raw.savedCount ?? 0),
  };
}

/**
 * Fail closed. If a key outside §12.2's allowlist ever reaches the payload the
 * request is refused rather than sent — a leak to a third-party model cannot be
 * undone once it has happened.
 */
export function assertBounded(context: Record<string, unknown>): void {
  const allowed = new Set<string>(PERMITTED_CONTEXT_FIELDS);
  const extra = Object.keys(context).filter((k) => !allowed.has(k));
  if (extra.length > 0) {
    throw new Error(`context contains fields outside the §12.2 allowlist: ${extra.join(', ')}`);
  }
}

/** Render the bounded context as the `<student_context>` block (§12.3). */
export function renderContextBlock(context: StudentContext): string {
  assertBounded(context as unknown as Record<string, unknown>);
  const lines: string[] = [];
  const add = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value) && value.length === 0) return;
    lines.push(`${label}: ${value}`);
  };

  add('First name', context.first_name);
  add('Education level', context.education_level);
  add('Career goal', context.career_goal);
  add('Target industry', context.target_industry);
  add('Holland Code', context.holland_code);
  if (context.riasec_scores) {
    add(
      'RIASEC scores (out of 24)',
      Object.entries(context.riasec_scores)
        .map(([l, s]) => `${l}=${s}`)
        .join(', ')
    );
  }
  if (context.top_recommendations.length) {
    add(
      'Top recommendations from the rule engine',
      context.top_recommendations.map((r) => `${r.name} (${r.match}% match)`).join('; ')
    );
  }
  if (context.subject_strengths.length) {
    add('Subject strengths', context.subject_strengths.join(', '));
  }
  // Skipped at zero: "Saved items: 0" as the only line would make an empty
  // profile look populated.
  if (context.saved_count > 0) add('Saved items', context.saved_count);

  return lines.length ? lines.join('\n') : 'No profile information recorded yet.';
}

/** Was anything at all known about this student? Drives the UI's empty state. */
export function hasAnyContext(context: StudentContext): boolean {
  return Boolean(
    context.first_name ||
      context.education_level ||
      context.career_goal ||
      context.target_industry ||
      context.holland_code ||
      context.top_recommendations.length ||
      context.subject_strengths.length
  );
}

// ---------------------------------------------------------------------------
// Output filtering (§12.4 / FR-SEC-08)
// ---------------------------------------------------------------------------

/**
 * Hosts a link may point at. Everything else is stripped so a model — or an
 * injected instruction inside crawled text — cannot surface a phishing link
 * inside a trusted UI.
 */
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

function hostAllowed(url: string, allowlist: string[]): boolean {
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
 * the visible text. Responses render as plain text with React's default
 * escaping — `dangerouslySetInnerHTML` is never used anywhere in this project.
 */
export function filterOutput(text: string, allowlist: string[] = LINK_ALLOWLIST): string {
  if (!text) return '';

  // [label](url) -> label, unless the host is allowed.
  // The url group tolerates one level of nested parentheses so a payload like
  // `[click](javascript:alert(1))` is consumed whole rather than leaving a
  // stray bracket behind.
  let out = text.replace(/\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)/g, (match, label, url) =>
    hostAllowed(String(url).trim(), allowlist) ? match : label
  );

  // bare URLs
  out = out.replace(/\bhttps?:\/\/[^\s<>()[\]]+/gi, (url) =>
    hostAllowed(url, allowlist) ? url : '[link removed]'
  );

  return out;
}
