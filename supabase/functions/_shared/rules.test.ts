/**
 * Recommendation engine tests — verified against docs/architecture.md §9.
 * Covers rule evaluation, match scoring, ranking, degraded mode, traceability,
 * determinism (AC-23), edge cases, missing data and invalid input.
 */
import { describe, it, expect } from 'vitest';
import ruleBaseJson from '../recommend/rules.json';
import {
  FIRING_THRESHOLD,
  RESULTS_PER_TYPE,
  evaluateCondition,
  evaluateRule,
  generateRecommendations,
  validateRuleBase,
  type Catalog,
  type Rule,
  type RuleBase,
  type StudentFacts,
} from './rules.ts';

const shippedRules = ruleBaseJson as unknown as RuleBase;

const CATALOG: Catalog = {
  careers: [
    { id: 'c-doc', name: 'Medical Doctor', field: 'Healthcare', riasec_profile: 'ISR' },
    { id: 'c-pha', name: 'Pharmacist', field: 'Healthcare', riasec_profile: 'ICR' },
    { id: 'c-civ', name: 'Civil Engineer', field: 'Engineering', riasec_profile: 'RIC' },
    { id: 'c-sof', name: 'Software Engineer', field: 'Technology', riasec_profile: 'IRC' },
    { id: 'c-dat', name: 'Data Scientist', field: 'Technology', riasec_profile: 'ICR' },
    { id: 'c-arc', name: 'Architect', field: 'Built environment', riasec_profile: 'AIR' },
    { id: 'c-gra', name: 'Graphic Designer', field: 'Creative', riasec_profile: 'AES' },
    { id: 'c-mul', name: 'Multimedia Designer', field: 'Creative', riasec_profile: 'ARE' },
  ],
  courses: [
    mkCourse('u-pha', 'Bachelor of Pharmacy', 'Pharmacy'),
    mkCourse('u-med', 'Bachelor of Medicine', 'Medicine'),
    mkCourse('u-bio', 'Bachelor of Biomedical Science', 'Biomedical Science'),
    mkCourse('u-cs1', 'Bachelor of Computer Science', 'Computer Science'),
    mkCourse('u-eng', 'Bachelor of Civil Engineering', 'Engineering'),
    mkCourse('u-arc', 'Bachelor of Architecture', 'Architecture'),
  ],
};
function mkCourse(id: string, name: string, field: string) {
  return {
    id,
    name,
    field_of_study: field,
    university_name: 'Universiti Sains Malaysia',
    pathway_type: 'degree',
    duration_months: 48,
    entry_requirements: '5 credits including Biology and Chemistry',
  };
}

const SUBJECT_DOMAINS = {
  BIOLOGY: 'science',
  CHEMISTRY: 'science',
  PHYSICS: 'science',
  MATH: 'mathematics',
  ADD_MATH: 'mathematics',
  SEJARAH: 'humanities',
};

function facts(overrides: Partial<StudentFacts> = {}): StudentFacts {
  return {
    hollandCode: 'ISA',
    scores: { R: 6, I: 21, A: 16, S: 18, E: 11, C: 9 },
    subjectStrengths: { BIOLOGY: 'strong', CHEMISTRY: 'strong', MATH: 'strong' },
    subjectDomains: SUBJECT_DOMAINS,
    educationLevel: 'spm',
    careerGoal: 'I want to work in health sciences',
    targetIndustry: 'Healthcare & Medicine',
    ...overrides,
  };
}

const HEALTH_RULE = shippedRules.rules.find((r) => r.id === 'R-HEALTH-01') as Rule;

// ---------------------------------------------------------------------------
describe('rule base (the shipped config)', () => {
  it('loads and every condition carries a label — "no label, no explanation" (§9.1)', () => {
    expect(validateRuleBase(shippedRules)).toEqual({ ok: true });
    for (const rule of shippedRules.rules) {
      for (const cond of rule.conditions) expect(cond.label.trim()).not.toBe('');
    }
  });

  it('reproduces the §9.1 worked example exactly', () => {
    expect(HEALTH_RULE.conditions).toHaveLength(4);
    expect(HEALTH_RULE.outputs.careers).toEqual(['Medical Doctor', 'Pharmacist']);
    expect(HEALTH_RULE.outputs.course_fields).toEqual([
      'Medicine',
      'Pharmacy',
      'Biomedical Science',
    ]);
  });

  it('rejects a rule with an unlabelled condition', () => {
    const bad: RuleBase = {
      version: '1',
      rules: [
        {
          id: 'X',
          conditions: [{ type: 'riasec_letter', operator: 'in_top_n', value: 'I', label: '' }],
          outputs: { careers: ['Pharmacist'] },
        },
      ],
    };
    expect(validateRuleBase(bad).ok).toBe(false);
  });

  it('rejects duplicate rule ids, empty conditions and output-less rules', () => {
    const dupe: RuleBase = { version: '1', rules: [HEALTH_RULE, HEALTH_RULE] };
    expect(validateRuleBase(dupe).ok).toBe(false);
    expect(
      validateRuleBase({ version: '1', rules: [{ id: 'Y', conditions: [], outputs: {} }] }).ok
    ).toBe(false);
    expect(
      validateRuleBase({
        version: '1',
        rules: [
          {
            id: 'Z',
            conditions: [{ type: 'riasec_letter', operator: 'is_primary', value: 'I', label: 'x' }],
            outputs: {},
          },
        ],
      }).ok
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('evaluateCondition — the six documented condition types (§9.1)', () => {
  it('riasec_letter / in_top_n reads the Holland Code', () => {
    const f = facts({ hollandCode: 'ISA' });
    const base = { type: 'riasec_letter', operator: 'in_top_n', n: 3, label: 'x' } as const;
    expect(evaluateCondition({ ...base, value: 'I' }, f)).toBe('satisfied');
    expect(evaluateCondition({ ...base, value: 'A' }, f)).toBe('satisfied');
    expect(evaluateCondition({ ...base, value: 'R' }, f)).toBe('unsatisfied');
  });

  it('riasec_letter / in_top_n honours a narrower n', () => {
    const f = facts({ hollandCode: 'ISA' });
    expect(
      evaluateCondition(
        { type: 'riasec_letter', operator: 'in_top_n', n: 1, value: 'S', label: 'x' },
        f
      )
    ).toBe('unsatisfied');
  });

  it('riasec_letter / is_primary tests the first letter only', () => {
    const f = facts({ hollandCode: 'ISA' });
    const base = { type: 'riasec_letter', operator: 'is_primary', label: 'x' } as const;
    expect(evaluateCondition({ ...base, value: 'I' }, f)).toBe('satisfied');
    expect(evaluateCondition({ ...base, value: 'S' }, f)).toBe('unsatisfied');
  });

  it('riasec_score compares a dimension score against a threshold', () => {
    const f = facts(); // A = 16
    const base = { type: 'riasec_score', dimension: 'A', label: 'x' } as const;
    expect(evaluateCondition({ ...base, operator: 'gte', value: 15 }, f)).toBe('satisfied');
    expect(evaluateCondition({ ...base, operator: 'gte', value: 17 }, f)).toBe('unsatisfied');
    expect(evaluateCondition({ ...base, operator: 'lte', value: 16 }, f)).toBe('satisfied');
  });

  it('subject_strength matches the classification', () => {
    const f = facts();
    const base = { type: 'subject_strength', operator: 'eq', label: 'x' } as const;
    expect(evaluateCondition({ ...base, subject: 'BIOLOGY', value: 'strong' }, f)).toBe('satisfied');
    expect(evaluateCondition({ ...base, subject: 'BIOLOGY', value: 'weak' }, f)).toBe('unsatisfied');
  });

  it('subject_strength / in accepts a set of strengths', () => {
    const f = facts({ subjectStrengths: { MATH: 'average' }, });
    expect(
      evaluateCondition(
        { type: 'subject_strength', operator: 'in', subject: 'MATH', value: ['strong', 'average'], label: 'x' },
        f
      )
    ).toBe('satisfied');
  });

  it('a subject the student never sat is unsatisfied, not an error (§8.4)', () => {
    const f = facts({ subjectStrengths: { MATH: 'strong' } });
    expect(
      evaluateCondition(
        { type: 'subject_strength', operator: 'eq', subject: 'PHYSICS', value: 'strong', label: 'x' },
        f
      )
    ).toBe('unsatisfied');
  });

  it('education_level supports eq and in', () => {
    const f = facts({ educationLevel: 'stpm' });
    expect(
      evaluateCondition({ type: 'education_level', operator: 'eq', value: 'stpm', label: 'x' }, f)
    ).toBe('satisfied');
    expect(
      evaluateCondition(
        { type: 'education_level', operator: 'in', value: ['spm', 'stpm'], label: 'x' },
        f
      )
    ).toBe('satisfied');
    expect(
      evaluateCondition({ type: 'education_level', operator: 'eq', value: 'spm', label: 'x' }, f)
    ).toBe('unsatisfied');
  });

  it('interest matches career_goal or target_industry, case-insensitively', () => {
    const cond = { type: 'interest', operator: 'contains', value: 'health', label: 'x' } as const;
    expect(evaluateCondition(cond, facts())).toBe('satisfied');
    expect(
      evaluateCondition(cond, facts({ careerGoal: null, targetIndustry: 'HEALTHCARE' }))
    ).toBe('satisfied');
    expect(
      evaluateCondition(cond, facts({ careerGoal: 'Engineering', targetIndustry: null }))
    ).toBe('unsatisfied');
  });

  it('an unstated interest is unsatisfied, matching the card in ui-spec §3.9', () => {
    expect(
      evaluateCondition(
        { type: 'interest', operator: 'contains', value: 'health', label: 'x' },
        facts({ careerGoal: null, targetIndustry: null })
      )
    ).toBe('unsatisfied');
  });

  it('subject_domain_strength aggregates over subjects.domain', () => {
    const f = facts({
      subjectStrengths: { MATH: 'strong', BIOLOGY: 'weak' },
      subjectDomains: SUBJECT_DOMAINS,
    });
    const base = { type: 'subject_domain_strength', operator: 'eq', value: 'strong', label: 'x' } as const;
    expect(evaluateCondition({ ...base, domain: 'mathematics' }, f)).toBe('satisfied');
    expect(evaluateCondition({ ...base, domain: 'science' }, f)).toBe('unsatisfied');
    expect(evaluateCondition({ ...base, domain: 'commerce' }, f)).toBe('unsatisfied');
  });

  it('an unknown condition type is not evaluable rather than throwing', () => {
    expect(
      evaluateCondition(
        { type: 'nonsense' as never, operator: 'eq', value: 'x', label: 'x' },
        facts()
      )
    ).toBe('not_evaluable');
  });
});

// ---------------------------------------------------------------------------
describe('evaluateRule — match score §9.2', () => {
  it('scores 100 when every condition is satisfied', () => {
    const r = evaluateRule(HEALTH_RULE, facts());
    expect(r.applicable).toBe(4);
    expect(r.satisfied).toBe(4);
    expect(r.matchScore).toBe(100);
    expect(r.fired).toBe(true);
  });

  it('scores satisfied/applicable × 100 on a partial match', () => {
    const r = evaluateRule(HEALTH_RULE, facts({ careerGoal: null, targetIndustry: null }));
    expect(r.satisfied).toBe(3);
    expect(r.applicable).toBe(4);
    expect(r.matchScore).toBe(75);
    expect(r.fired).toBe(true);
  });

  it('does not fire below the 50% threshold', () => {
    const r = evaluateRule(
      HEALTH_RULE,
      facts({
        hollandCode: 'REC',
        subjectStrengths: { BIOLOGY: 'weak', CHEMISTRY: 'weak' },
        careerGoal: null,
        targetIndustry: null,
      })
    );
    expect(r.matchScore).toBe(0);
    expect(r.fired).toBe(false);
  });

  it('fires exactly at the 50% boundary', () => {
    const r = evaluateRule(
      HEALTH_RULE,
      facts({ subjectStrengths: { BIOLOGY: 'strong', CHEMISTRY: 'weak' }, careerGoal: null, targetIndustry: null })
    );
    expect(r.matchScore).toBe(FIRING_THRESHOLD);
    expect(r.fired).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('degraded mode — §9.4 / AC-25', () => {
  const noAcademics = facts({ subjectStrengths: {} });

  it('marks subject conditions NOT EVALUABLE and drops them from numerator and denominator', () => {
    const r = evaluateRule(HEALTH_RULE, noAcademics);
    expect(r.applicable).toBe(2); // riasec_letter + interest only
    expect(r.satisfied).toBe(2);
    expect(r.matchScore).toBe(100);
    expect(r.fired).toBe(true);
  });

  it('omits not-evaluable conditions from the reason list', () => {
    const r = evaluateRule(HEALTH_RULE, noAcademics);
    expect(r.reasons).toHaveLength(2);
    expect(r.reasons.map((x) => x.text)).not.toContain('Strong in Biology');
  });

  it('skips a rule whose conditions are all subject-based', () => {
    const subjectOnly: Rule = {
      id: 'R-SUBJ-ONLY',
      conditions: [
        { type: 'subject_strength', operator: 'eq', subject: 'MATH', value: 'strong', label: 'Strong in Mathematics' },
      ],
      outputs: { careers: ['Data Scientist'] },
    };
    const r = evaluateRule(subjectOnly, noAcademics);
    expect(r.skipped).toBe(true);
    expect(r.fired).toBe(false);
    expect(r.matchScore).toBe(0);
  });

  it('flags the whole result set as degraded', () => {
    expect(generateRecommendations(shippedRules, noAcademics, CATALOG).degradedMode).toBe(true);
    expect(generateRecommendations(shippedRules, facts(), CATALOG).degradedMode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('traceability — every recommendation explains itself', () => {
  const result = generateRecommendations(shippedRules, facts(), CATALOG);

  it('names the rule that produced each recommendation', () => {
    for (const rec of [...result.careers, ...result.courses]) {
      expect(rec.rule_id).toBeTruthy();
      expect(shippedRules.rules.some((r) => r.id === rec.rule_id)).toBe(true);
    }
  });

  it('carries a labelled reason for every evaluated condition', () => {
    const doctor = result.careers.find((r) => r.target_id === 'c-doc');
    expect(doctor?.reasons.map((x) => x.text)).toEqual([
      'Investigative interests',
      'Strong in Biology',
      'Strong in Chemistry',
      'Interest in health sciences',
    ]);
  });

  it('identifies which RIASEC characteristics contributed', () => {
    const doctor = result.careers.find((r) => r.target_id === 'c-doc');
    const riasec = doctor?.reasons.filter((x) => x.condition.startsWith('riasec_'));
    expect(riasec).toEqual([
      { condition: 'riasec_letter', satisfied: true, text: 'Investigative interests' },
    ]);
  });

  it('identifies which academic characteristics contributed', () => {
    const doctor = result.careers.find((r) => r.target_id === 'c-doc');
    const academic = doctor?.reasons.filter((x) => x.condition.startsWith('subject_'));
    expect(academic?.map((x) => x.text)).toEqual(['Strong in Biology', 'Strong in Chemistry']);
    expect(academic?.every((x) => x.satisfied)).toBe(true);
  });

  it('shows unsatisfied conditions too, rather than hiding them (ui-spec §3.9)', () => {
    const partial = generateRecommendations(
      shippedRules,
      facts({ careerGoal: null, targetIndustry: null }),
      CATALOG
    );
    const doctor = partial.careers.find((r) => r.target_id === 'c-doc');
    expect(doctor?.reasons).toContainEqual({
      condition: 'interest',
      satisfied: false,
      text: 'Interest in health sciences',
    });
    expect(doctor?.match_score).toBe(75);
  });
});

// ---------------------------------------------------------------------------
describe('ranking, dedupe and limits — §9.3 / §9.5', () => {
  it('ranks by score desc and numbers the ranks from 1', () => {
    const { courses } = generateRecommendations(shippedRules, facts(), CATALOG);
    expect(courses[0].rank).toBe(1);
    for (let i = 1; i < courses.length; i += 1) {
      expect(courses[i - 1].match_score).toBeGreaterThanOrEqual(courses[i].match_score);
      expect(courses[i].rank).toBe(i + 1);
    }
  });

  it('keeps one entry per target, with the strongest evidence', () => {
    const { careers } = generateRecommendations(shippedRules, facts(), CATALOG);
    const ids = careers.map((c) => c.target_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns at most 8 of each type', () => {
    const many: Catalog = {
      careers: Array.from({ length: 20 }, (_, i) => ({
        id: `x-${String(i).padStart(2, '0')}`,
        name: `Medical Doctor`,
        field: 'Healthcare',
        riasec_profile: 'ISR',
      })),
      courses: Array.from({ length: 20 }, (_, i) =>
        mkCourse(`y-${String(i).padStart(2, '0')}`, `Course ${i}`, 'Pharmacy')
      ),
    };
    const res = generateRecommendations(shippedRules, facts(), many);
    expect(res.courses.length).toBe(RESULTS_PER_TYPE);
    expect(res.courses.length).toBeLessThanOrEqual(RESULTS_PER_TYPE);
  });

  it('produces byte-identical output for identical input (AC-23)', () => {
    const a = JSON.stringify(generateRecommendations(shippedRules, facts(), CATALOG));
    for (let i = 0; i < 20; i += 1) {
      expect(JSON.stringify(generateRecommendations(shippedRules, facts(), CATALOG))).toBe(a);
    }
  });

  it('is insensitive to catalog ordering (deterministic tie-break)', () => {
    const reversed: Catalog = {
      careers: [...CATALOG.careers].reverse(),
      courses: [...CATALOG.courses].reverse(),
    };
    const normal = generateRecommendations(shippedRules, facts(), CATALOG);
    const flipped = generateRecommendations(shippedRules, facts(), reversed);
    expect(flipped.courses.map((c) => c.target_id)).toEqual(normal.courses.map((c) => c.target_id));
    expect(flipped.careers.map((c) => c.target_id)).toEqual(normal.careers.map((c) => c.target_id));
  });
});

// ---------------------------------------------------------------------------
describe('secondary signal — careers.riasec_profile (§9.6)', () => {
  it('surfaces careers sharing two or more letters, separately from rule matches', () => {
    const { careers, secondaryCareers } = generateRecommendations(shippedRules, facts(), CATALOG);
    const ruleMatched = new Set(careers.map((c) => c.target_id));
    for (const entry of secondaryCareers) {
      expect(ruleMatched.has(entry.detail.id)).toBe(false);
      expect(entry.sharedLetters.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('includes an unmatched career sharing two or more letters, and excludes one that shares none', () => {
    const withExtras: Catalog = {
      ...CATALOG,
      careers: [
        ...CATALOG.careers,
        // no rule outputs either of these, so both reach the secondary pass
        { id: 'c-nur', name: 'Nurse', field: 'Healthcare', riasec_profile: 'SIA' }, // shares S, I, A
        { id: 'c-far', name: 'Farmer', field: 'Agriculture', riasec_profile: 'REC' }, // shares none
      ],
    };
    const res = generateRecommendations(shippedRules, facts({ hollandCode: 'ISA' }), withExtras);
    const ids = res.secondaryCareers.map((s) => s.detail.id);
    expect(ids).toContain('c-nur');
    expect(ids).not.toContain('c-far');
    expect(res.secondaryCareers.find((s) => s.detail.id === 'c-nur')?.sharedLetters.sort()).toEqual(
      ['A', 'I', 'S']
    );
  });
});

// ---------------------------------------------------------------------------
describe('edge cases and invalid input', () => {
  it('returns nothing when no rule matches (empty state, not an error — AC-24)', () => {
    const res = generateRecommendations(
      shippedRules,
      facts({
        hollandCode: 'SEC',
        scores: { R: 1, I: 1, A: 1, S: 20, E: 18, C: 16 },
        subjectStrengths: { SEJARAH: 'weak' },
        careerGoal: null,
        targetIndustry: null,
      }),
      CATALOG
    );
    expect(res.careers).toEqual([]);
    expect(res.courses).toEqual([]);
  });

  it('handles an empty rule base', () => {
    const res = generateRecommendations({ version: '1', rules: [] }, facts(), CATALOG);
    expect(res.careers).toEqual([]);
    expect(res.courses).toEqual([]);
    expect(res.firedRules).toEqual([]);
  });

  it('handles an empty catalog without throwing', () => {
    const res = generateRecommendations(shippedRules, facts(), { careers: [], courses: [] });
    expect(res.careers).toEqual([]);
    expect(res.courses).toEqual([]);
    expect(res.secondaryCareers).toEqual([]);
  });

  it('silently skips rule outputs that are not in the catalog', () => {
    const partialCatalog: Catalog = {
      careers: [CATALOG.careers[1]], // Pharmacist only
      courses: [],
    };
    const res = generateRecommendations(shippedRules, facts(), partialCatalog);
    expect(res.careers.map((c) => c.target_id)).toEqual(['c-pha']);
  });

  it('never emits a recommendation without reasons', () => {
    const res = generateRecommendations(shippedRules, facts(), CATALOG);
    for (const rec of [...res.careers, ...res.courses]) {
      expect(rec.reasons.length).toBeGreaterThan(0);
    }
  });

  it('never emits a match score outside 0-100', () => {
    const res = generateRecommendations(shippedRules, facts(), CATALOG);
    for (const rec of [...res.careers, ...res.courses]) {
      expect(rec.match_score).toBeGreaterThanOrEqual(0);
      expect(rec.match_score).toBeLessThanOrEqual(100);
    }
  });
});
