import { expect, it } from 'vitest';
import { normaliseCareerCode, validateCareerCode } from './careerCatalogForm';
it('normalises real codes and blank without inventing a letter', () => {
  expect(normaliseCareerCode(' ic ')).toBe('IC');
  expect(normaliseCareerCode('S')).toBe('S');
  expect(normaliseCareerCode(' ')).toBeNull();
  expect(validateCareerCode('CI')).toBeNull();
  expect(() => normaliseCareerCode('II')).toThrow(RangeError);
  expect(validateCareerCode('RIASECX')).toBeTruthy();
});
