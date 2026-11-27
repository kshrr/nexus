/**
 * Read subject grades out of OCR text from an SPM result slip.
 *
 * Pure and conservative: a line counts only when it names a known subject AND
 * carries a readable grade. Nothing is saved from here — the caller puts the
 * results into the grade table for the student to check first.
 *
 * Grades are read from the official descriptor when present ("CEMERLANG
 * TERTINGGI" survives OCR better than "A+"), otherwise from the letter grade
 * that follows the subject name.
 */

/** subjects.code -> names as printed on slips (Malay first) and in English. */
export const SUBJECT_ALIASES = {
  ADD_MATH: ['MATEMATIK TAMBAHAN', 'ADDITIONAL MATHEMATICS'],
  BM: ['BAHASA MELAYU', 'BAHASA MALAYSIA'],
  BI: ['BAHASA INGGERIS', 'ENGLISH'],
  SEJARAH: ['SEJARAH', 'HISTORY'],
  MATH: ['MATEMATIK', 'MATHEMATICS'],
  PHYSICS: ['FIZIK', 'PHYSICS'],
  CHEMISTRY: ['KIMIA', 'CHEMISTRY'],
  BIOLOGY: ['BIOLOGI', 'BIOLOGY'],
  SAINS_KOMP: ['SAINS KOMPUTER', 'COMPUTER SCIENCE'],
  SCIENCE: ['SAINS', 'SCIENCE'],
  PAI: ['PENDIDIKAN ISLAM', 'ISLAMIC EDUCATION'],
  PM: ['PENDIDIKAN MORAL', 'MORAL EDUCATION'],
  GEOGRAFI: ['GEOGRAFI', 'GEOGRAPHY'],
  EKONOMI: ['EKONOMI', 'ECONOMICS'],
  PERNIAGAAN: ['PERNIAGAAN', 'BUSINESS'],
  PRINSIP_AKAUN: ['PRINSIP PERAKAUNAN', 'PRINCIPLES OF ACCOUNTING'],
  ICT: ['TEKNOLOGI MAKLUMAT DAN KOMUNIKASI', 'INFORMATION AND COMMUNICATION TECHNOLOGY'],
  REKA_CIPTA: ['REKA CIPTA'],
  PSV: ['PENDIDIKAN SENI VISUAL', 'VISUAL ART EDUCATION'],
  BC: ['BAHASA CINA', 'CHINESE LANGUAGE'],
  BT: ['BAHASA TAMIL', 'TAMIL LANGUAGE'],
};

/** Official SPM grade descriptors, most specific first. */
const DESCRIPTORS = [
  ['CEMERLANG TERTINGGI', 'A+'],
  ['CEMERLANG TINGGI', 'A'],
  ['CEMERLANG', 'A-'],
  ['KEPUJIAN TERTINGGI', 'B+'],
  ['KEPUJIAN TINGGI', 'B'],
  ['KEPUJIAN ATAS', 'C+'],
  ['KEPUJIAN', 'C'],
  ['LULUS ATAS', 'D'],
  ['LULUS', 'E'],
  ['GAGAL', 'G'],
];

const LETTER = /(?:^|[\s:|(])(A\+|A-|B\+|C\+|[ABCDEG])(?=$|[\s|)])/;

function normalise(line) {
  return line
    .toUpperCase()
    .replace(/[‐-―−]/g, '-') // dash variants
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} text  raw OCR output
 * @param {{ code: string, name: string }[]} [subjects]  known subjects (only these codes are returned)
 * @returns {{ results: { code: string, grade: string, line: string }[], unread: string[] }}
 */
export function parseSpmSlip(text, subjects = []) {
  const known = subjects.length ? new Set(subjects.map((s) => s.code)) : null;
  const aliases = [];
  for (const [code, names] of Object.entries(SUBJECT_ALIASES)) {
    if (known && !known.has(code)) continue;
    for (const name of names) aliases.push([name, code]);
  }
  for (const s of subjects) {
    if (!SUBJECT_ALIASES[s.code] && s.name) aliases.push([s.name.toUpperCase(), s.code]);
  }
  // Longest name first: "MATEMATIK TAMBAHAN" before "MATEMATIK", "SAINS KOMPUTER" before "SAINS".
  aliases.sort((a, b) => b[0].length - a[0].length);

  const results = [];
  const unread = [];
  const seen = new Set();
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = normalise(raw);
    if (!line) continue;
    const hit = aliases.find(([name]) => new RegExp(`(^|[^A-Z])${name}([^A-Z]|$)`).test(line));
    if (!hit) continue;
    const [name, code] = hit;
    const after = line.slice(line.indexOf(name) + name.length);
    const descriptor = DESCRIPTORS.find(([word]) => after.includes(word));
    const letter = after.match(LETTER);
    const grade = descriptor ? descriptor[1] : letter ? letter[1] : null;
    if (!grade) {
      unread.push(raw.trim());
      continue;
    }
    if (seen.has(code)) continue;
    seen.add(code);
    results.push({ code, grade, line: raw.trim() });
  }
  return { results, unread };
}
