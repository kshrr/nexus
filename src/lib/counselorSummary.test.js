import { expect, it } from 'vitest';
import { createCounselorSummaryPdf } from './counselorSummary';

it('puts assessment scores and every career and course match in the PDF', () => {
  const pdf = createCounselorSummaryPdf({
    profile: { full_name: 'Aisha Rahman' },
    riasec: {
      holland_code: 'IAS',
      realistic_score: 4,
      investigative_score: 22,
      artistic_score: 17,
      social_score: 15,
      enterprising_score: 8,
      conventional_score: 6,
      completed_at: '2026-10-10T00:00:00Z',
    },
    strengths: [{ name: 'Mathematics', strength: 'strong', averagePoints: 8, examCount: 2 }],
    careers: [
      {
        detail: { name: 'Data scientist', field: 'Technology' },
        match_score: 91,
        reasons: [{ satisfied: true, text: 'Investigative interest' }],
      },
    ],
    secondaryCareers: [
      {
        detail: { name: 'Research writer', field: 'Media' },
        shared_letters: ['I', 'A'],
      },
    ],
    courses: [
      {
        detail: {
          name: 'Computer Science',
          university_name: 'Example University',
          entry_requirements: 'Check official requirements.',
        },
        match_score: 85,
        reasons: [{ satisfied: false, text: 'Mathematics grade to review' }],
      },
    ],
    generatedAt: '2026-10-11T00:00:00Z',
    now: new Date('2026-10-20T00:00:00Z'),
  });
  const document = pdf.output();

  expect(document).toMatch(/^%PDF-/);
  for (const phrase of [
    'Aisha Rahman',
    'IAS',
    'Investigative: 22/24',
    'Artistic: 17/24',
    'Mathematics',
    'Data scientist',
    'Research writer',
    'Computer Science',
    'Mathematics grade to review',
    'Check official requirements.',
  ]) {
    expect(document).toContain(phrase);
  }
});

it('explains missing academic results without inventing scores', () => {
  const document = createCounselorSummaryPdf({
    profile: {},
    riasec: { holland_code: 'RIA' },
    strengths: [],
    careers: [{ detail: { name: 'Career awaiting score' }, match_score: null }],
    secondaryCareers: [],
    courses: [],
    now: new Date('2026-10-20T00:00:00Z'),
  }).output();

  expect(document).toContain('No subject results available');
  expect(document).toContain('Career awaiting score');
  expect(document).toContain('No course recommendations available');
  expect(document).not.toContain('0% match');
  expect(document).not.toContain('undefined');
});

it('continues long recommendation lists onto another page without dropping the last match', () => {
  const careers = Array.from({ length: 45 }, (_, index) => ({
    detail: { name: `Career ${index + 1}` },
    match_score: 80,
    reasons: [{ satisfied: true, text: 'Shared interest' }],
  }));
  const pdf = createCounselorSummaryPdf({ riasec: { holland_code: 'IAS' }, careers });
  expect(pdf.internal.getNumberOfPages()).toBeGreaterThan(1);
  expect(pdf.output()).toContain('Career 45');
});

it('includes both illustrated result charts and all three academic strength bands', () => {
  const pdf = createCounselorSummaryPdf({
    riasec: {
      holland_code: 'IAS',
      realistic_score: 4,
      investigative_score: 22,
      artistic_score: 17,
      social_score: 15,
      enterprising_score: 8,
      conventional_score: 6,
    },
    strengths: [
      { name: 'Mathematics', strength: 'strong', averagePoints: 8, examCount: 3 },
      { name: 'English', strength: 'average', averagePoints: 5, examCount: 2 },
      { name: 'History', strength: 'weak', averagePoints: 2, examCount: 1 },
    ],
    subjects: [
      { code: 'MATH', name: 'Mathematics' },
      { code: 'ENG', name: 'English' },
      { code: 'HIST', name: 'History' },
    ],
    academicGrades: {
      MATH: { form4_final: 'B', spm_trial: 'A-', spm_actual: 'A' },
      ENG: { form4_final: 'C+', spm_trial: 'B' },
      HIST: { form4_final: 'D' },
    },
    now: new Date('2026-10-20T00:00:00Z'),
  });
  const document = pdf.output();

  for (const phrase of [
    'RIASEC interest map',
    'Academic progress across exams',
    'Form 4 Final',
    'SPM Trial',
    'SPM Actual',
    'Mathematics',
    'English',
    'History',
  ]) {
    expect(document).toContain(phrase);
  }
  for (const band of ['Strong', 'Average', 'Weak']) {
    expect(document).toContain(`${band} \\(1\\)`);
  }
});
