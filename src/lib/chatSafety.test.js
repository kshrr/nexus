import { describe, it, expect } from 'vitest';
import { filterOutput, mentionsScholarship, LINK_ALLOWLIST } from './chatSafety';
import { buildSuggestions } from './chatSuggestions';

/**
 * The client half of §12.4. It must behave identically to the server filter in
 * supabase/functions/_shared/chat-context.ts — these cases mirror that suite.
 */
describe('filterOutput (client render filter, §12.4)', () => {
  it('keeps links to allowlisted provider domains', () => {
    const text = 'See [MARA](https://mara.gov.my/biasiswa) for details.';
    expect(filterOutput(text)).toBe(text);
  });

  it('strips a markdown link elsewhere, keeping the label', () => {
    expect(filterOutput('Claim it [here](https://phish.example.com/go)')).toBe('Claim it here');
  });

  it('removes a bare off-allowlist URL', () => {
    expect(filterOutput('Visit https://phish.example.com now')).toBe('Visit [link removed] now');
  });

  it('rejects a lookalike domain', () => {
    expect(filterOutput('https://mara.gov.my.evil.tk/x')).toBe('[link removed]');
  });

  it('strips javascript: payloads whole, leaving no stray bracket', () => {
    expect(filterOutput('[click](javascript:alert(1))')).toBe('click');
  });

  it('handles empty, null and undefined', () => {
    expect(filterOutput('')).toBe('');
    expect(filterOutput(null)).toBe('');
    expect(filterOutput(undefined)).toBe('');
  });

  it('leaves ordinary prose alone', () => {
    const prose = 'Your ISA code points towards investigative work.';
    expect(filterOutput(prose)).toBe(prose);
  });

  it('shares the allowlist with the server filter', () => {
    expect(LINK_ALLOWLIST).toEqual(
      expect.arrayContaining(['jpa.gov.my', 'mara.gov.my', 'mqa.gov.my'])
    );
  });
});

describe('mentionsScholarship — drives the inline disclosure (ui-spec §8.8)', () => {
  it.each(['Which scholarship suits me?', 'Ada biasiswa untuk saya?', 'What funding is there?'])(
    'detects %j',
    (text) => expect(mentionsScholarship(text)).toBe(true)
  );

  it('does not fire on unrelated answers', () => {
    expect(mentionsScholarship('Your Holland Code is ISA.')).toBe(false);
    expect(mentionsScholarship('')).toBe(false);
    expect(mentionsScholarship(null)).toBe(false);
  });
});

describe('buildSuggestions — state-derived, three at a time (ui-spec §8.5)', () => {
  it('returns exactly three', () => {
    expect(
      buildSuggestions({ hollandCode: 'ISA', strengths: ['Biology'], recommendationCount: 5 })
    ).toHaveLength(3);
  });

  it('uses the student’s own code and strengths', () => {
    const out = buildSuggestions({ hollandCode: 'RIC', strengths: ['Mathematics'] });
    expect(out.join(' ')).toContain('RIC');
    expect(out.join(' ')).toContain('Mathematics');
  });

  it('falls back to general questions for a brand-new student', () => {
    const out = buildSuggestions(null);
    expect(out).toHaveLength(3);
    expect(out.join(' ')).toMatch(/matriculation|Nexus|Holland/);
  });
});
