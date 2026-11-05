import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('provides 44px source-link targets in the mobile stylesheet', () => {
  const css = readFileSync('src/styles/rail-careers.css', 'utf8');
  const mobile = css.slice(css.indexOf('@media (max-width: 767px)'));
  expect(mobile).toMatch(
    /\.career-source-links a,\s*\.career-source-attribution > p a\s*\{[^}]*min-height: 44px;/
  );
});
