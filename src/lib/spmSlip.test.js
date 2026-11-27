import { describe, expect, it } from 'vitest';
import { parseSpmSlip } from './spmSlip';

const SUBJECTS = [
  { code: 'BM', name: 'Bahasa Melayu' },
  { code: 'BI', name: 'English' },
  { code: 'SEJARAH', name: 'Sejarah' },
  { code: 'MATH', name: 'Mathematics' },
  { code: 'ADD_MATH', name: 'Additional Mathematics' },
  { code: 'PHYSICS', name: 'Physics' },
  { code: 'CHEMISTRY', name: 'Chemistry' },
  { code: 'SCIENCE', name: 'Science' },
  { code: 'SAINS_KOMP', name: 'Computer Science' },
  { code: 'PM', name: 'Pendidikan Moral' },
];

const grades = (text) =>
  Object.fromEntries(parseSpmSlip(text, SUBJECTS).results.map((r) => [r.code, r.grade]));

describe('parseSpmSlip', () => {
  it('reads a slip with codes, names and descriptors', () => {
    const slip = `
      KEPUTUSAN SIJIL PELAJARAN MALAYSIA
      1103 BAHASA MELAYU A+ CEMERLANG TERTINGGI
      1119 BAHASA INGGERIS A CEMERLANG TINGGI
      1249 SEJARAH B+ KEPUJIAN TERTINGGI
      1449 MATEMATIK A- CEMERLANG
      3472 MATEMATIK TAMBAHAN C KEPUJIAN
      4531 FIZIK B KEPUJIAN TINGGI
      1225 PENDIDIKAN MORAL C+ KEPUJIAN ATAS
    `;
    expect(grades(slip)).toEqual({
      BM: 'A+',
      BI: 'A',
      SEJARAH: 'B+',
      MATH: 'A-',
      ADD_MATH: 'C',
      PHYSICS: 'B',
      PM: 'C+',
    });
  });

  it('prefers the descriptor when OCR garbles the letter grade', () => {
    expect(grades('1103 BAHASA MELAYU At CEMERLANG TERTINGGI')).toEqual({ BM: 'A+' });
    // "8" is a misread "B"; the descriptor settles it.
    expect(grades('4541 KIMIA 8 KEPUJIAN TINGGI')).toEqual({ CHEMISTRY: 'B' });
  });

  it('reads letter grades when no descriptor is printed', () => {
    expect(grades('Bahasa Melayu  A+\nMathematics: B\nEnglish (C)')).toEqual({
      BM: 'A+',
      MATH: 'B',
      BI: 'C',
    });
  });

  it('does not read a longer subject as a shorter one', () => {
    expect(grades('MATEMATIK TAMBAHAN A\nSAINS KOMPUTER B')).toEqual({
      ADD_MATH: 'A',
      SAINS_KOMP: 'B',
    });
  });

  it('reports subject lines without a readable grade, and ignores other text', () => {
    const { results, unread } = parseSpmSlip(
      'NAMA: SITI\nANGKA GILIRAN AB123\nSEJARAH ???\nJUMLAH MATA PELAJARAN 9',
      SUBJECTS
    );
    expect(results).toEqual([]);
    expect(unread).toEqual(['SEJARAH ???']);
  });

  it('keeps the first reading of a subject that appears twice', () => {
    expect(grades('BAHASA MELAYU A\nBAHASA MELAYU B')).toEqual({ BM: 'A' });
  });

  it('only returns subjects the app knows', () => {
    expect(grades('PENDIDIKAN SENI VISUAL A')).toEqual({});
  });
});
