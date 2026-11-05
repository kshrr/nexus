import { RIASEC_DIMENSIONS } from '@/types';
import { getBestInterestReference, getSectionReview } from './careerEvidence';

/**
 * Builds transparent, deterministic context from stored Nexus data only.
 * No score is invented: overlap means shared Holland-code letters, and an
 * academic strength is included only when the stored classifier says strong.
 */
export function buildCareerFit(career, riasecResult, strengths = []) {
  if (!career) return { riasec: null, subjects: [] };

  const studentCode = riasecResult?.holland_code ?? '';
  const match = getBestInterestReference(career, studentCode, { requireThreshold: false });
  const shared = match?.sharedLetters ?? [];

  const useful = new Set(
    getSectionReview(career, 'subjects') ? (career.useful_subjects ?? []) : []
  );
  const strongSubjects = strengths.filter(
    (subject) => subject.strength === 'strong' && useful.has(subject.subjectCode)
  );

  return {
    riasec:
      studentCode && shared.length
        ? {
            studentCode,
            shared,
            primaryName: RIASEC_DIMENSIONS[shared[0]],
            reference: match.reference,
          }
        : null,
    subjects: strongSubjects,
  };
}

export function formatFieldLabel(field) {
  return field || 'Other';
}
