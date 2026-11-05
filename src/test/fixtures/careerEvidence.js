export const occupationSource = {
  source_id: 'onet',
  title: 'Software Developers',
  publisher: 'O*NET OnLine',
  url: 'https://www.onetonline.org/link/summary/15-1252.00',
  jurisdiction: 'United States',
  scope: 'Occupational tasks and interests, not Malaysian admission',
  access_note: '',
  effective_on: null,
};
export function reviewedStage(overrides = {}) {
  return {
    status: 'source_checked',
    kind: 'source_informed',
    checked_on: '2026-10-13',
    limitations: [],
    sources: [{ ...occupationSource }],
    ...overrides,
  };
}
export function reviewedCareer({ code = 'IC', references, overrides = {} } = {}) {
  const section = reviewedStage();
  return {
    id: 'career-1',
    name: 'Software Engineer',
    slug: 'software-engineer',
    field: 'Computing & Technology',
    description: 'Develops and tests software.',
    responsibilities: ['Evaluate user needs'],
    required_skills: ['Programming'],
    useful_subjects: ['MATH'],
    education_routes: ['Explore computing study'],
    riasec_profile: code,
    is_active: true,
    reference_occupations: references ?? [
      {
        reference_id: '15-1252.00',
        name: 'Software Developers',
        mapping_kind: 'related',
        scope_note: 'Reference occupation, not every software role.',
        interest_code: code,
        interest_source_id: 'onet',
      },
    ],
    content_review: {
      status: 'source_checked',
      checked_on: '2026-10-13',
      limitations: [],
      sections: {
        overview: section,
        responsibilities: section,
        skills: section,
        interests: section,
        subjects: reviewedStage({ kind: 'nexus_planning' }),
        study_options: reviewedStage({ kind: 'nexus_planning' }),
      },
    },
    ...overrides,
  };
}
