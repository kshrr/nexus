/**
 * Privacy policy version. Bumped whenever the /privacy notice changes materially;
 * a new version prompts re-consent. Stored with every consent record
 * (FR-SEC-10 / NFR05).
 */
export const PRIVACY_POLICY_VERSION = '2026-01-01';

/**
 * Chatbot input cap (architecture.md §12.1 / §15). Mirrored server-side in
 * supabase/functions/_shared/chat-context.ts, which is the enforcing copy —
 * this one only drives the character counter and the disabled Send button.
 */
export const MAX_MESSAGE_LENGTH = 1000;

/**
 * Target-industry options for the optional profile field. Used only to populate
 * a select; the column is free text and nullable.
 */
export const TARGET_INDUSTRIES = [
  'Healthcare & Medicine',
  'Engineering & Manufacturing',
  'Information Technology',
  'Business & Finance',
  'Education & Training',
  'Law & Government',
  'Science & Research',
  'Creative & Media',
  'Hospitality & Tourism',
  'Agriculture & Environment',
  'Skilled Trades',
  'Not sure yet',
];
