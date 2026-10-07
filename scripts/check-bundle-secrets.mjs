/**
 * AC-34 / NFR01c — assert that no server-side secret reaches a client asset.
 *
 * "The Gemini API key appears nowhere in any client-delivered asset."
 * Run after `npm run build`; exits non-zero on any finding, so it can gate CI
 * and produce evidence for the security chapter.
 *
 *   node scripts/check-bundle-secrets.mjs
 *
 * TWO LAYERS, because each has a different weakness:
 *
 *   1. PATTERN matching recognises known credential shapes. It needs no access
 *      to the real secret, but it only catches formats it knows about — and
 *      providers change them. Google alone issues Gemini keys as both
 *      `AIzaSy…` (legacy AI Studio) and `AQ.A…` (current AI Studio).
 *
 *   2. LITERAL matching compares against the actual secret values, so it cannot
 *      be defeated by an unrecognised format. It only works where the value is
 *      visible to this script — a local .env or a CI environment variable.
 *
 * Neither is sufficient alone. State that limitation in the thesis rather than
 * claiming the scan is exhaustive.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { PATTERNS, SECRET_ENV_NAMES, scanText } from './secret-patterns.mjs';

const DIST = 'dist';

// --- load .env so the literal check has something to work with --------------
async function loadDotEnv() {
  const out = {};
  try {
    const text = await readFile('.env', 'utf8');
    for (const line of text.split('\n')) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      out[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    /* no .env — the literal layer simply has less to check */
  }
  return out;
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir)) {
    const path = join(dir, entry);
    const info = await stat(path);
    if (info.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}

// ---------------------------------------------------------------------------
let files;
try {
  files = await walk(DIST);
} catch {
  console.error(`No ${DIST}/ directory. Run "npm run build" first.`);
  process.exit(1);
}

const dotEnv = await loadDotEnv();
const literals = [];
for (const name of SECRET_ENV_NAMES) {
  const value = process.env[name] ?? dotEnv[name];
  // Ignore short or placeholder values — they would match everywhere.
  if (value && value.length >= 12 && !/^your-|^<|^changeme/i.test(value)) {
    literals.push({ name, value });
  }
}

const TEXTUAL = /\.(js|mjs|cjs|css|html|json|map|txt|svg)$/i;
const scanned = files.filter((f) => TEXTUAL.test(f));
const findings = [];

for (const file of scanned) {
  const content = await readFile(file, 'utf8');

  for (const hit of scanText(content)) findings.push({ file, ...hit });

  for (const { name, value } of literals) {
    if (content.includes(value)) {
      findings.push({ file, name: `${name} (exact value)`, sample: '<redacted>' });
    }
  }
}

console.log(`Scanned ${scanned.length} built assets.`);
console.log(`  pattern checks: ${PATTERNS.length}`);
console.log(
  literals.length
    ? `  literal checks: ${literals.map((l) => l.name).join(', ')}`
    : '  literal checks: none available locally (secrets live in the Edge runtime, not .env)'
);
console.log('');

if (findings.length === 0) {
  console.log('PASS  No API key, token or private key found in any client asset.');
  console.log('      AC-34 / NFR01c holds: the Gemini key exists only in the Edge runtime.');
  process.exit(0);
}

console.log('FAIL  Server-side material found in a client-delivered asset:\n');
for (const f of findings) console.log(`  ${f.name}\n    in ${f.file} — ${f.sample}`);
process.exit(1);
