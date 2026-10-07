import { RIASEC_DIMENSIONS } from '@/types';

/**
 * Builds transparent, deterministic context from stored Nexus data only.
 * No score is invented: overlap means shared Holland-code letters, and an
 * academic strength is included only when the stored classifier says strong.
 */
export function buildCareerFit(career, riasecResult, strengths = []) {
  if (!career) return { riasec: null, subjects: [] };

  const studentCode = riasecResult?.holland_code ?? '';
  const careerCode = career.riasec_profile ?? '';
  const shared = [...careerCode].filter((letter, index, all) =>
    studentCode.includes(letter) && all.indexOf(letter) === index
  );

  const useful = new Set(career.useful_subjects ?? []);
  const strongSubjects = strengths.filter(
    (subject) => subject.strength === 'strong' && useful.has(subject.subjectCode)
  );

  return {
    riasec: studentCode && shared.length
      ? {
          studentCode,
          shared,
          primaryName: RIASEC_DIMENSIONS[shared[0]],
        }
      : null,
    subjects: strongSubjects,
  };
}

export function formatFieldLabel(field) {
  return field || 'Other';
}

