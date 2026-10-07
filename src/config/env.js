/**
 * Centralised, validated access to browser-safe environment variables.
 *
 * Only `VITE_`-prefixed variables exist in `import.meta.env`; anything else is
 * undefined in the bundle by design. No component reads `import.meta.env`
 * directly — they import from here so validation happens in exactly one place.
 *
 * @typedef {Object} AppConfig
 * @property {string}  supabaseUrl
 * @property {string}  supabaseAnonKey
 * @property {string}  appName
 * @property {'development' | 'production' | 'test'} appEnv
 * @property {boolean} isConfigured  true when Supabase credentials are present
 */

/** @param {string} name @returns {string | undefined} */
function read(name) {
  const value = import.meta.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

const supabaseUrl = read('VITE_SUPABASE_URL');
const supabaseAnonKey = read('VITE_SUPABASE_ANON_KEY');

/**
 * Guardrail: fail loudly if a secret was mis-prefixed with `VITE_` and leaked
 * into the bundle. These names must never be browser-visible.
 */
const FORBIDDEN = [
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SERVICE_ROLE_KEY',
  'VITE_GEMINI_API_KEY',
  'VITE_GITHUB_DISPATCH_TOKEN',
  'VITE_BRAVE_SEARCH_API_KEY',
];
for (const name of FORBIDDEN) {
  if (read(name) !== undefined) {
    throw new Error(
      `[env] ${name} is present in the client bundle. Server secrets must never be VITE_-prefixed. ` +
        `Move it to Supabase Edge Function secrets or GitHub Secrets.`
    );
  }
}

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured && import.meta.env.DEV) {
  // Warn, don't crash — the foundation must run before Supabase is provisioned.
  console.warn(
    '[env] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env and fill them in. Auth and data features are disabled until then.'
  );
}

/** @type {AppConfig} */
export const config = Object.freeze({
  supabaseUrl: supabaseUrl ?? '',
  supabaseAnonKey: supabaseAnonKey ?? '',
  appName: read('VITE_APP_NAME') ?? 'Nexus',
  appEnv: /** @type {AppConfig['appEnv']} */ (read('VITE_APP_ENV') ?? import.meta.env.MODE),
  isConfigured,
});

export default config;
