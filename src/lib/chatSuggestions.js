/**
 * Suggested questions, derived from the student's state rather than a static
 * list (FR-CHAT-03, ui-spec §8.5). Three at a time.
 *
 * They also steer towards what the assistant can usefully answer — explaining a
 * Holland Code, comparing pathways — rather than the factual lookups §12.3
 * requires it to refuse.
 *
 * @param {{ hollandCode?: string | null, strengths?: string[], recommendationCount?: number } | null} summary
 * @returns {string[]}
 */
export function buildSuggestions(summary) {
  const out = [];
  if (summary?.recommendationCount) out.push('Why were these courses recommended for me?');
  if (summary?.hollandCode) out.push(`What does my ${summary.hollandCode} code mean?`);
  if (summary?.strengths?.length) {
    out.push(`What can I study with strong ${summary.strengths[0]}?`);
  }
  if (out.length < 3) out.push("What's the difference between matriculation and STPM?");
  if (out.length < 3) out.push('How does Nexus work?');
  if (out.length < 3) out.push('What is a Holland Code?');
  return out.slice(0, 3);
}
