import { it, expect, vi, afterEach } from 'vitest';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
it('rejects browser-prefixed Brave credentials', async () => {
  vi.stubEnv('VITE_BRAVE_SEARCH_API_KEY', 'synthetic-key-not-real');
  vi.resetModules();
  let error;
  try {
    await import('./env');
  } catch (caught) {
    error = caught;
  }
  expect(error?.message).toMatch('Server secrets must never be VITE_-prefixed');
});
