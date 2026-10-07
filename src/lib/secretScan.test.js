import { describe, it, expect } from 'vitest';
import { PATTERNS, scanText } from '../../scripts/secret-patterns.mjs';

/**
 * Tests for the AC-34 bundle scanner.
 *
 * A detection rule that is never exercised is worse than no rule: it produces
 * confidence without coverage. The original scanner only knew the legacy
 * `AIzaSy…` Gemini format and would have missed a current `AQ.A…` key entirely.
 *
 * Every value below is fabricated for testing. No real credential is committed.
 */
describe('bundle secret scanner — detection', () => {
  it('catches a current-format Gemini key (AQ.…)', () => {
    const hits = scanText('const k="AQ.Ab8RN6JhFakeKeyForTestingOnly_1234567890";');
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toMatch(/current AI Studio/);
  });

  it('catches a legacy-format Gemini key (AIza…)', () => {
    const hits = scanText('key: "AIzaSyFAKE0000000000000000000000000000000"');
    expect(hits[0].name).toMatch(/legacy AI Studio/);
  });

  it('catches the Gemini endpoint appearing client-side', () => {
    expect(scanText('https://generativelanguage.googleapis.com/v1beta/x')).toHaveLength(1);
  });

  it.each([
    ['service-role JWT', '{"role":"service_role","iss":"supabase"}'],
    ['Supabase secret key', 'sb_secret_FAKEfakeFAKEfakeFAKEfake123456'],
    ['GitHub token', 'ghp_FAKEfakeFAKEfakeFAKEfakeFAKEfake1234'],
    ['OpenAI-style key', 'sk-FAKEfakeFAKEfakeFAKEfakeFAKEfake123456'],
    ['private key block', '-----BEGIN RSA PRIVATE KEY-----'],
  ])('catches a %s', (_label, sample) => {
    expect(scanText(sample).length).toBeGreaterThan(0);
  });

  it('reports which credential it found, not just that something matched', () => {
    const hits = scanText('AQ.Ab8RN6JhFakeKeyForTestingOnly_1234567890');
    expect(hits[0].name).toBeTruthy();
    expect(hits[0].sample).toMatch(/…$/);
  });
});

describe('bundle secret scanner — no false positives', () => {
  it('allows the guardrail that lists secret NAMES', () => {
    const guardrail = `const FORBIDDEN=["VITE_SUPABASE_SERVICE_ROLE_KEY","VITE_GEMINI_API_KEY"];`;
    expect(scanText(guardrail)).toEqual([]);
  });

  it("allows the privacy notice naming Google's Gemini service", () => {
    expect(scanText('a short summary of your profile is sent to Google’s Gemini service')).toEqual(
      []
    );
  });

  it('does not fire on ordinary minified code', () => {
    expect(scanText('const a=1;function b(c){return c.map(d=>d.id)}export{a,b};')).toEqual([]);
  });

  it('does not fire on the public Supabase anon key role claim', () => {
    expect(scanText('{"role":"anon","iss":"supabase"}')).toEqual([]);
  });
});

describe('bundle secret scanner — coverage', () => {
  it('knows both Gemini key formats', () => {
    const names = PATTERNS.map((p) => p.name).join(' ');
    expect(names).toMatch(/AIza/);
    expect(names).toMatch(/AQ\./);
  });

  it('every pattern is a global regex, so all occurrences are reported', () => {
    for (const p of PATTERNS) expect(p.re.flags).toContain('g');
  });
});
