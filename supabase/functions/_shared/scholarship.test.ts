/**
 * Scholarship eligibility tests — verified against docs/architecture.md §10.5,
 * §10.6 and ui-specifications.md §3.11.
 */
import { describe, it, expect } from 'vitest';
import {
  deadlineUrgency,
  evaluateCriterion,
  matchAll,
  matchScholarship,
  rankMatches,
  type Criterion,
  type ScholarshipRow,
  type StudentEligibilityProfile,
} from './scholarship.ts';

let seq = 0;
function crit(partial: Partial<Criterion>): Criterion {
  seq += 1;
  return {
    id: `crit-${String(seq).padStart(3, '0')}`,
    criterion_type: 'other',
    operator: 'eq',
    value: null,
    label: 'A requirement',
    is_checkable: true,
    ...partial,
  };
}

function profile(overrides: Partial<StudentEligibilityProfile> = {}): StudentEligibilityProfile {
  return {
    educationLevel: 'spm',
    careerGoal: 'Software engineering',
    targetIndustry: 'Information Technology',
    subjectPoints: { MATH: 8, ADD_MATH: 7, PHYSICS: 6, BIOLOGY: 3 },
    recommendedFields: ['Computer Science', 'Engineering'],
    ...overrides,
  };
}

function scholarship(overrides: Partial<ScholarshipRow> = {}): ScholarshipRow {
  return {
    id: 's-001',
    name: 'Test Scholarship',
    provider: 'Test Provider',
    deadline: '2026-12-01',
    status: 'active',
    field_of_study: ['Computer Science'],
    education_levels: ['spm'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
describe('is_checkable = false — the third state (§10.6, ui-spec §3.11)', () => {
  it('reports unknown, never a failure', () => {
    const c = crit({ criterion_type: 'other', label: 'Leadership experience', is_checkable: false });
    const res = evaluateCriterion(c, profile());
    expect(res.status).toBe('unknown');
    expect(res.status).not.toBe('unsatisfied');
    expect(res.hint).toMatch(/provider/i);
  });

  it('stays unknown even when the type would otherwise be evaluable', () => {
    const c = crit({
      criterion_type: 'education_level',
      operator: 'eq',
      value: 'spm',
      is_checkable: false,
    });
    expect(evaluateCriterion(c, profile()).status).toBe('unknown');
  });
});

describe('criterion types with no collection point (ui-spec §9.1)', () => {
  it.each(['citizenship', 'age'] as const)(
    'reports %s as unknown rather than guessing',
    (type) => {
      const res = evaluateCriterion(crit({ criterion_type: type, value: 'MY' }), profile());
      expect(res.status).toBe('unknown');
    }
  );
});

// ---------------------------------------------------------------------------
describe('education_level', () => {
  it('satisfies an exact match', () => {
    const c = crit({ criterion_type: 'education_level', operator: 'eq', value: 'spm' });
    expect(evaluateCriterion(c, profile()).status).toBe('satisfied');
  });

  it('satisfies membership of a list', () => {
    const c = crit({
      criterion_type: 'education_level',
      operator: 'in',
      value: ['stpm', 'spm', 'diploma'],
    });
    expect(evaluateCriterion(c, profile()).status).toBe('satisfied');
  });

  it('fails a non-match', () => {
    const c = crit({ criterion_type: 'education_level', operator: 'eq', value: 'diploma' });
    expect(evaluateCriterion(c, profile()).status).toBe('unsatisfied');
  });

  it('explains what to do when the level is not set', () => {
    const c = crit({ criterion_type: 'education_level', operator: 'eq', value: 'spm' });
    const res = evaluateCriterion(c, profile({ educationLevel: null }));
    expect(res.status).toBe('unsatisfied');
    expect(res.hint).toMatch(/education level/i);
  });
});

describe('field_of_study', () => {
  it('matches against the recommended course fields', () => {
    const c = crit({ criterion_type: 'field_of_study', operator: 'in', value: ['Computer Science'] });
    expect(evaluateCriterion(c, profile()).status).toBe('satisfied');
  });

  it('matches against the stated target industry', () => {
    const c = crit({ criterion_type: 'field_of_study', operator: 'contains', value: 'information' });
    expect(evaluateCriterion(c, profile({ recommendedFields: [] })).status).toBe('satisfied');
  });

  it('fails when nothing overlaps', () => {
    const c = crit({ criterion_type: 'field_of_study', operator: 'in', value: ['Medicine'] });
    expect(evaluateCriterion(c, profile()).status).toBe('unsatisfied');
  });

  it('explains what to do when the student has no field at all', () => {
    const res = evaluateCriterion(
      crit({ criterion_type: 'field_of_study', operator: 'in', value: ['Medicine'] }),
      profile({ recommendedFields: [], careerGoal: null, targetIndustry: null })
    );
    expect(res.status).toBe('unsatisfied');
    expect(res.hint).toMatch(/career goal|recommendations/i);
  });
});

describe('subject_grade', () => {
  it('satisfies when the student meets the minimum', () => {
    const c = crit({
      criterion_type: 'subject_grade',
      operator: 'gte',
      value: { subject: 'MATH', grade: 'B' },
    });
    expect(evaluateCriterion(c, profile()).status).toBe('satisfied'); // 8 >= 5
  });

  it('fails when the student is below the minimum', () => {
    const c = crit({
      criterion_type: 'subject_grade',
      operator: 'gte',
      value: { subject: 'BIOLOGY', grade: 'A-' },
    });
    expect(evaluateCriterion(c, profile()).status).toBe('unsatisfied'); // 3 < 7
  });

  it('says which grade is missing rather than failing silently', () => {
    const c = crit({
      criterion_type: 'subject_grade',
      operator: 'gte',
      value: { subject: 'CHEMISTRY', grade: 'B' },
    });
    const res = evaluateCriterion(c, profile());
    expect(res.status).toBe('unsatisfied');
    expect(res.hint).toMatch(/chemistry/i);
  });

  it('reports unknown when the criterion itself is malformed', () => {
    const c = crit({ criterion_type: 'subject_grade', operator: 'gte', value: { subject: 'MATH' } });
    expect(evaluateCriterion(c, profile()).status).toBe('unknown');
  });
});

describe('min_grade — average across recorded subjects', () => {
  it('satisfies when the average clears the bar', () => {
    // avg(8,7,6,3) = 6.0
    const c = crit({ criterion_type: 'min_grade', operator: 'gte', value: 'B' }); // 5
    expect(evaluateCriterion(c, profile()).status).toBe('satisfied');
  });

  it('fails when the average is below the bar', () => {
    const c = crit({ criterion_type: 'min_grade', operator: 'gte', value: 'A' }); // 8
    expect(evaluateCriterion(c, profile()).status).toBe('unsatisfied');
  });

  it('explains the gap when no results are recorded (ui-spec §3.11 wording)', () => {
    const c = crit({ criterion_type: 'min_grade', operator: 'gte', value: 'B' });
    const res = evaluateCriterion(c, profile({ subjectPoints: {} }));
    expect(res.status).toBe('unsatisfied');
    expect(res.hint).toMatch(/haven't added/i);
  });

  it('accepts a raw point threshold as well as a letter', () => {
    const c = crit({ criterion_type: 'min_grade', operator: 'gte', value: 5 });
    expect(evaluateCriterion(c, profile()).status).toBe('satisfied');
  });
});

// ---------------------------------------------------------------------------
describe('matchScholarship — §10.5 scoring', () => {
  const criteria = [
    crit({ criterion_type: 'citizenship', label: 'Malaysian citizen', value: 'MY' }),
    crit({ criterion_type: 'education_level', operator: 'eq', value: 'spm', label: 'SPM leaver' }),
    crit({
      criterion_type: 'field_of_study',
      operator: 'in',
      value: ['Computer Science'],
      label: 'Computer Science field',
    }),
    crit({
      criterion_type: 'subject_grade',
      operator: 'gte',
      value: { subject: 'MATH', grade: 'B' },
      label: 'Credit in Mathematics',
    }),
    crit({ criterion_type: 'min_grade', operator: 'gte', value: 'A', label: 'Minimum A average' }),
    crit({ criterion_type: 'other', label: 'Leadership experience', is_checkable: false }),
  ];

  const match = matchScholarship(scholarship(), criteria, profile());

  it('excludes unverifiable criteria from the denominator', () => {
    // 6 criteria, 2 unknown (citizenship + non-checkable) -> 4 checkable
    expect(match.checkable_count).toBe(4);
    expect(match.satisfied_count).toBe(3); // level, field, maths; min_grade fails
    expect(match.eligibility_score).toBe(75);
  });

  it('still lists every criterion, including the unverifiable ones', () => {
    expect(match.checklist).toHaveLength(6);
    expect(match.checklist.filter((c) => c.status === 'unknown')).toHaveLength(2);
  });

  it('never marks an unverifiable criterion as unsatisfied (AC-32)', () => {
    const leadership = match.checklist.find((c) => c.label === 'Leadership experience');
    expect(leadership?.status).toBe('unknown');
  });

  it('scores 100 when everything checkable is met', () => {
    const easy = matchScholarship(
      scholarship(),
      [crit({ criterion_type: 'education_level', operator: 'eq', value: 'spm', label: 'SPM' })],
      profile()
    );
    expect(easy.eligibility_score).toBe(100);
  });

  it('scores 0 rather than dividing by zero when nothing is checkable', () => {
    const none = matchScholarship(
      scholarship(),
      [crit({ label: 'Essay', is_checkable: false })],
      profile()
    );
    expect(none.checkable_count).toBe(0);
    expect(none.eligibility_score).toBe(0);
    expect(none.checklist).toHaveLength(1);
  });

  it('handles a scholarship with no criteria at all', () => {
    const empty = matchScholarship(scholarship(), [], profile());
    expect(empty.checklist).toEqual([]);
    expect(empty.eligibility_score).toBe(0);
  });

  it('counts field overlap as the relevance score', () => {
    const both = matchScholarship(
      scholarship({ field_of_study: ['Computer Science', 'Engineering', 'Medicine'] }),
      [],
      profile()
    );
    expect(both.relevance_score).toBe(2);
  });
});

// ---------------------------------------------------------------------------
describe('rankMatches — §10.5 ordering', () => {
  const rows = [
    scholarship({ id: 's-a', deadline: '2026-12-01', field_of_study: [] }),
    scholarship({ id: 's-b', deadline: '2026-10-01', field_of_study: [] }),
    scholarship({ id: 's-c', deadline: null, field_of_study: [] }),
  ];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const mk = (id: string, elig: number, rel = 0) => ({
    scholarship_id: id,
    eligibility_score: elig,
    relevance_score: rel,
    checkable_count: 1,
    satisfied_count: 1,
    checklist: [],
  });

  it('ranks eligibility first', () => {
    const out = rankMatches([mk('s-a', 50), mk('s-b', 100), mk('s-c', 75)], byId);
    expect(out.map((m) => m.scholarship_id)).toEqual(['s-b', 's-c', 's-a']);
  });

  it('breaks an eligibility tie on relevance', () => {
    const out = rankMatches([mk('s-a', 80, 0), mk('s-b', 80, 3)], byId);
    expect(out[0].scholarship_id).toBe('s-b');
  });

  it('breaks a further tie on the earliest deadline', () => {
    const out = rankMatches([mk('s-a', 80), mk('s-b', 80)], byId);
    expect(out[0].scholarship_id).toBe('s-b'); // Oct before Dec
  });

  it('sorts rolling intakes (no deadline) last', () => {
    const out = rankMatches([mk('s-c', 80), mk('s-b', 80)], byId);
    expect(out.map((m) => m.scholarship_id)).toEqual(['s-b', 's-c']);
  });

  it('is deterministic for identical input', () => {
    const input = [mk('s-a', 80), mk('s-b', 80), mk('s-c', 80)];
    const first = JSON.stringify(rankMatches(input, byId));
    for (let i = 0; i < 10; i += 1) {
      expect(JSON.stringify(rankMatches([...input].reverse(), byId))).toBe(first);
    }
  });
});

describe('matchAll', () => {
  it('scores and ranks a whole set', () => {
    const rows = [
      scholarship({ id: 's-1', field_of_study: ['Medicine'] }),
      scholarship({ id: 's-2', field_of_study: ['Computer Science'] }),
    ];
    const criteria = new Map([
      ['s-1', [crit({ criterion_type: 'education_level', operator: 'eq', value: 'diploma', label: 'Diploma' })]],
      ['s-2', [crit({ criterion_type: 'education_level', operator: 'eq', value: 'spm', label: 'SPM' })]],
    ]);
    const out = matchAll(rows, criteria, profile());
    expect(out[0].scholarship_id).toBe('s-2');
    expect(out[0].eligibility_score).toBe(100);
    expect(out[1].eligibility_score).toBe(0);
  });

  it('handles an empty scholarship set', () => {
    expect(matchAll([], new Map(), profile())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('deadlineUrgency — §3.4.2 thresholds, do not change (AC-30)', () => {
  const now = new Date('2026-09-06T00:00:00Z');
  const plus = (days: number) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  it('flags 7 days as critical and 8 days as warning', () => {
    expect(deadlineUrgency(plus(7), now)).toBe('critical');
    expect(deadlineUrgency(plus(8), now)).toBe('warning');
  });

  it('flags 30 days as warning and 31 days as neither', () => {
    expect(deadlineUrgency(plus(30), now)).toBe('warning');
    expect(deadlineUrgency(plus(31), now)).toBe('normal');
  });

  it('treats 6 days as critical and today as critical', () => {
    expect(deadlineUrgency(plus(6), now)).toBe('critical');
    expect(deadlineUrgency(plus(0), now)).toBe('critical');
  });

  it('returns none for a rolling intake', () => {
    expect(deadlineUrgency(null, now)).toBe('none');
  });

  it('returns none for an unparseable date', () => {
    expect(deadlineUrgency('not-a-date', now)).toBe('none');
  });
});
