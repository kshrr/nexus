import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
export const migrationPath = new URL('../migrations/', import.meta.url);
export async function migration(db, name) {
  await db.exec(await readFile(new URL(name, migrationPath), 'utf8'));
}
export async function careerDb() {
  const db = new PGlite();
  await db.exec(await readFile(new URL('./auth-shim.sql', import.meta.url), 'utf8'));
  for (const name of [
    '0002_core_tables.sql',
    '0003_reference_tables.sql',
    '0004_security_tables.sql',
    '0005_functions.sql',
    '0006_rls_policies.sql',
    '0007_seed_reference_data.sql',
    '0008_auth_consent.sql',
    '0009_seed_find_your_path.sql',
    '0010_scholarship_operations.sql',
    '0013_career_pathways.sql',
  ])
    await migration(db, name);
  return db;
}
export const source = {
  source_id: 'onet',
  title: 'Software Developers',
  publisher: 'O*NET OnLine',
  url: 'https://www.onetonline.org/link/summary/15-1252.00',
  jurisdiction: 'United States',
  scope: 'Occupation, not admission',
  access_note: '',
  effective_on: null,
};
export const section = {
  status: 'source_checked',
  kind: 'source_informed',
  checked_on: '2026-10-13',
  limitations: [],
  sources: [source],
};
export const review = {
  status: 'source_checked',
  checked_on: '2026-10-13',
  limitations: [],
  sections: { overview: section, interests: section },
};
export const refs = [
  {
    reference_id: '15-1252.00',
    name: 'Software Developers',
    mapping_kind: 'related',
    scope_note: 'Occupational example',
    interest_code: 'IC',
    interest_source_id: 'onet',
  },
];
