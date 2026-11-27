/**
 * Scholarship eligibility tests — verified against docs/architecture.md §10.5,
 * §10.6 and ui-specifications.md §3.11.
 */
import { describe, it, expect } from 'vitest';
import {
  deadlineUrgency,
  evaluateCriterion,
  inferRule,
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
    const c = crit({
      criterion_type: 'other',
      label: 'Leadership experience',
      is_checkable: false,
    });
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
  it('reports age as unknown rather than guessing', () => {
    const c = crit({ criterion_type: 'age', operator: 'lte', value: 19 });
    expect(evaluateCriterion(c, profile()).status).toBe('unknown');
  });
});

describe('citizenship — optional self-declared nationality (migration 0036)', () => {
  const c = crit({ criterion_type: 'citizenship', value: 'MY', label: 'Malaysian citizen' });
  it('is unknown, with a prompt, when the student has not answered', () => {
    const res = evaluateCriterion(c, profile());
    expect(res.status).toBe('unknown');
    expect(res.hint).toMatch(/add your nationality/i);
  });
  it('is satisfied for a Malaysian student', () => {
    expect(evaluateCriterion(c, profile({ nationality: 'malaysian' })).status).toBe('satisfied');
  });
  it('is unsatisfied for a non-Malaysian student', () => {
    expect(evaluateCriterion(c, profile({ nationality: 'non_malaysian' })).status).toBe(
      'unsatisfied'
    );
  });
  it('stays unknown when the criterion is not checkable', () => {
    const off = crit({ criterion_type: 'citizenship', value: 'MY', is_checkable: false });
    expect(evaluateCriterion(off, profile({ nationality: 'malaysian' })).status).toBe('unknown');
  });
});

describe('min_grade — count of subjects at or above a grade', () => {
  // profile(): MATH 8 (A), ADD_MATH 7 (A-), PHYSICS 6 (B+), BIOLOGY 3 (C)
  const count = (n: number, grade: string) =>
    crit({ criterion_type: 'min_grade', operator: 'gte', value: { count: n, grade } });
  it('counts subjects at the grade or better', () => {
    expect(evaluateCriterion(count(2, 'A-'), profile()).status).toBe('satisfied');
  });
  it('fails with how many were reached', () => {
    const res = evaluateCriterion(count(8, 'A'), profile());
    expect(res.status).toBe('unsatisfied');
    expect(res.hint).toBe('You have 1 of the 8 subjects needed.');
  });
  it('counts credits (C or better)', () => {
    expect(evaluateCriterion(count(4, 'C'), profile()).status).toBe('satisfied');
  });
  it('asks for results when none are recorded', () => {
    expect(evaluateCriterion(count(5, 'C'), profile({ subjectPoints: {} })).status).toBe(
      'unsatisfied'
    );
  });
  it('treats a malformed shape as unknown', () => {
    expect(evaluateCriterion(count(0, 'Z'), profile()).status).toBe('unknown');
  });
});

describe('SPM rules that another exam can also meet (alt)', () => {
  const credits = crit({
    criterion_type: 'min_grade',
    operator: 'gte',
    value: { count: 5, grade: 'C', alt: true },
  });
  const bm = crit({
    criterion_type: 'subject_grade',
    operator: 'gte',
    value: { subject: 'BM', grade: 'C', alt: true },
  });
  it('is unknown, not a failure, for a student with no SPM results', () => {
    for (const c of [credits, bm]) {
      const res = evaluateCriterion(c, profile({ subjectPoints: {} }));
      expect(res.status).toBe('unknown');
      expect(res.hint).toMatch(/another exam/i);
    }
  });
  it('is checked normally once SPM results are recorded', () => {
    expect(evaluateCriterion(credits, profile()).status).toBe('unsatisfied'); // 4 credits
    expect(evaluateCriterion(bm, profile({ subjectPoints: { BM: 5 } })).status).toBe('satisfied');
  });
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
    const c = crit({
      criterion_type: 'field_of_study',
      operator: 'in',
      value: ['Computer Science'],
    });
    expect(evaluateCriterion(c, profile()).status).toBe('satisfied');
  });

  it('matches against the stated target industry', () => {
    const c = crit({
      criterion_type: 'field_of_study',
      operator: 'contains',
      value: 'information',
    });
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
    const c = crit({
      criterion_type: 'subject_grade',
      operator: 'gte',
      value: { subject: 'MATH' },
    });
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
      [
        's-1',
        [
          crit({
            criterion_type: 'education_level',
            operator: 'eq',
            value: 'diploma',
            label: 'Diploma',
          }),
        ],
      ],
      [
        's-2',
        [crit({ criterion_type: 'education_level', operator: 'eq', value: 'spm', label: 'SPM' })],
      ],
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

describe('plain-text conditions read from the profile', () => {
  const text = (label: string) => crit({ criterion_type: 'other', label, is_checkable: false });
  const run = (label: string, p: Partial<StudentEligibilityProfile> = {}) =>
    evaluateCriterion(text(label), profile({ currentYear: 2026, ...p }));

  it('reads "Aged 25 years or below" against the year of birth', () => {
    expect(run('Aged 25 years or below.', { birthYear: 2005 }).status).toBe('satisfied');
    expect(run('Aged 25 years or below.', { birthYear: 1995 }).status).toBe('unsatisfied');
    // Born in 2000: 25 or 26 this year, depending on the birthday, so it cannot be told.
    expect(run('Aged 25 years or below.', { birthYear: 2000 }).status).toBe('unknown');
    const missing = run('Aged 25 years or below.', { birthYear: null });
    expect(missing.status).toBe('unknown');
    expect(missing.hint).toMatch(/year of birth in your profile/i);
  });

  it('reads the age limit in English and Malay', () => {
    expect(inferRule('Aged 25 years old and below.')).toEqual({ kind: 'age_max', limit: 25 });
    expect(inferRule('Berumur tidak melebihi 30 tahun pada tahun permohonan')).toEqual({
      kind: 'age_max',
      limit: 30,
    });
    expect(inferRule('General condition: Aged below 35 years')).toEqual({
      kind: 'age_max',
      limit: 35,
    });
  });

  it('checks household income against the income band', () => {
    const label = 'Total monthly gross household income of RM5,000 and below.';
    expect(run(label, { householdIncomeBand: '2500_5000' }).status).toBe('satisfied');
    expect(run(label, { householdIncomeBand: 'under_2500' }).status).toBe('satisfied');
    expect(run(label, { householdIncomeBand: '5000_7500' }).status).toBe('unsatisfied');
    expect(run(label, { householdIncomeBand: 'over_15000' }).status).toBe('unsatisfied');
    expect(run(label, { householdIncomeBand: null }).hint).toMatch(/household income range/i);
    // A band that straddles the limit cannot be called either way.
    expect(
      run('Household income not exceeding RM6,000 is required, RM6,000 and below', {
        householdIncomeBand: '5000_7500',
      }).status
    ).toBe('unknown');
  });

  it('counts SPM credits (grade C or better) from the SPM results added', () => {
    const label = 'Obtained minimum three (3) credits in SPM.';
    expect(inferRule(label)).toEqual({ kind: 'spm_credits', count: 3 });
    expect(
      run(label, { subjectPoints: { MATH: 8, ADD_MATH: 4, PHYSICS: 3, BIOLOGY: 2 } }).status
    ).toBe('satisfied');
    const short = run(label, { subjectPoints: { MATH: 8, BIOLOGY: 2 } });
    expect(short.status).toBe('unsatisfied');
    expect(short.hint).toMatch(/1 of the 3 credits/);
    expect(run(label, { subjectPoints: {} }).status).toBe('unknown');
  });

  it('checks a bare "Malaysian." condition against nationality', () => {
    expect(run('Malaysian.', { nationality: 'malaysian' }).status).toBe('satisfied');
    expect(run('Malaysian.', { nationality: 'non_malaysian' }).status).toBe('unsatisfied');
    expect(run('Malaysian.', { nationality: null }).status).toBe('unknown');
  });

  it('leaves conditions it does not understand as "can’t check"', () => {
    const result = run('Free from chronic illness and able to complete the programme');
    expect(result.status).toBe('unknown');
    expect(result.hint).toMatch(/can't check/i);
  });

  it('counts the new checks in the score, so the checklist can read met and not met', () => {
    const match = matchScholarship(
      {
        id: 's',
        name: 'S',
        provider: 'P',
        deadline: null,
        status: 'active',
        field_of_study: [],
        education_levels: [],
      },
      [
        text('Aged 25 years or below.'),
        text('Total monthly gross household income of RM5,000 and below.'),
        text('Obtained minimum three (3) credits in SPM.'),
        crit({
          criterion_type: 'education_level',
          operator: 'in',
          value: ['spm'],
          label: 'Education level: SPM',
        }),
      ],
      profile({ currentYear: 2026, birthYear: 2008, householdIncomeBand: '2500_5000' })
    );
    expect(match.checkable_count).toBe(4);
    expect(match.satisfied_count).toBe(4);
  });
});
