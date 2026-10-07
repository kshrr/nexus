import { describe, expect, it } from 'vitest';
import { buildCareerFit } from './careerFit';

const career = {
  riasec_profile: 'IRC',
  useful_subjects: ['MATH', 'SAINS_KOMP'],
};

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
    expect(fit.subjects.map((subject) => subject.subjectCode)).toEqual(['MATH']);
  });

  it('returns no personalised claims when stored results do not support them', () => {
    expect(buildCareerFit(career, null, [])).toEqual({ riasec: null, subjects: [] });
  });
});

