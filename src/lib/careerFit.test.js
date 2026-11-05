import { describe, expect, it } from 'vitest';
import { buildCareerFit } from './careerFit';
import { reviewedCareer } from '@/test/fixtures/careerEvidence';

const career = reviewedCareer({ overrides: { useful_subjects: ['MATH', 'SAINS_KOMP'] } });

describe('buildCareerFit', () => {
  it('uses only shared stored RIASEC letters and stored strong subjects', () => {
    const fit = buildCareerFit(career, { holland_code: 'IAE' }, [
      { subjectCode: 'MATH', name: 'Mathematics', strength: 'strong' },
      { subjectCode: 'SAINS_KOMP', name: 'Computer Science', strength: 'average' },
      { subjectCode: 'BIOLOGY', name: 'Biology', strength: 'strong' },
    ]);

    expect(fit.riasec.studentCode).toBe('IAE');
    expect(fit.riasec.shared).toEqual(['I']);
    expect(fit.riasec.primaryName).toBe('Investigative');
    expect(fit.riasec.reference?.name).toBe('Software Developers');
    expect(fit.subjects.map((subject) => subject.subjectCode)).toEqual(['MATH']);
  });

  it('returns no personalised claims when stored results do not support them', () => {
    expect(buildCareerFit(career, null, [])).toEqual({ riasec: null, subjects: [] });
  });
  it('does not turn pending legacy profiles or subjects into personal claims', () => {
    const c = structuredClone(career);
    c.content_review.status = 'pending';
    expect(
      buildCareerFit(c, { holland_code: 'ICS' }, [{ subjectCode: 'MATH', strength: 'strong' }])
    ).toEqual({ riasec: null, subjects: [] });
  });
});
