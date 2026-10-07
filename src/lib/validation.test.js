import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, validateFullName, passwordChecklist } from './validation';

describe('validateEmail', () => {
  it('accepts a well-formed address', () => {
    expect(validateEmail('kauthar@example.com')).toBeNull();
  });
  it.each(['', '  ', 'not-an-email', 'a@b', 'a@b.', '@x.com'])('rejects %j', (value) => {
    expect(validateEmail(value)).toBeTruthy();
  });
});

describe('validatePassword — policy: >=8 chars, a letter and a digit (D-36)', () => {
  it('accepts a compliant password', () => {
    expect(validatePassword('nexus2026')).toBeNull();
  });
  it('rejects fewer than 8 characters', () => {
    expect(validatePassword('nex2')).toMatch(/8 characters/i);
  });
  it('rejects letters only', () => {
    expect(validatePassword('nexuspassword')).toMatch(/letter and one number/i);
  });
  it('rejects digits only', () => {
    expect(validatePassword('12345678')).toMatch(/letter and one number/i);
  });
});

describe('validateFullName', () => {
  it('accepts a normal name', () => {
    expect(validateFullName('Kauthar Mohd Suhair')).toBeNull();
  });
  it('rejects empty', () => {
    expect(validateFullName('   ')).toBeTruthy();
  });
  it('rejects > 120 chars', () => {
    expect(validateFullName('a'.repeat(121))).toBeTruthy();
  });
});

describe('passwordChecklist', () => {
  it('tracks each requirement independently', () => {
    expect(passwordChecklist('abcd1234')).toEqual([
      { label: 'At least 8 characters', met: true },
      { label: 'A letter', met: true },
      { label: 'A number', met: true },
    ]);
    expect(passwordChecklist('abc').map((r) => r.met)).toEqual([false, true, false]);
  });
});
