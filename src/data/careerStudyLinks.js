// How each career finds related catalogue courses and scholarships.
//
// The course catalogue is scraped, so courses are not linked to careers by hand.
// `courseTerms` are matched against course names (case-insensitive substring), and
// `studyFields` use the same field vocabulary as courses.field_of_study and
// scholarships.field_of_study. Matches are suggestions, not admission or
// professional-recognition decisions.
export const CAREER_STUDY_LINKS = {
  'software-engineer': {
    studyFields: ['Computer Science'],
    courseTerms: [
      'software engineering',
      'computer science',
      'information technology',
      'foundation in computing',
    ],
  },
  'data-analyst': {
    studyFields: ['Data Science', 'Computer Science'],
    courseTerms: [
      'data science',
      'data analytics',
      'business analytics',
      'statistics',
      'business intelligence',
    ],
  },
  'data-scientist': {
    studyFields: ['Data Science', 'Computer Science'],
    courseTerms: ['data science', 'data analytics', 'artificial intelligence', 'statistics'],
  },
  'cybersecurity-analyst': {
    studyFields: ['Computer Science'],
    courseTerms: ['cyber', 'security', 'network', 'computer science'],
  },
  'civil-engineer': {
    studyFields: ['Engineering'],
    courseTerms: ['civil engineering', 'foundation in engineering'],
  },
  architect: {
    studyFields: ['Architecture'],
    courseTerms: ['architecture'],
  },
  'graphic-designer': {
    studyFields: ['Design', 'Creative Arts'],
    courseTerms: [
      'graphic',
      'visual communication',
      'communication design',
      'creative',
      'foundation in art',
      'foundation in design',
    ],
  },
  'multimedia-designer': {
    studyFields: ['Design', 'Creative Arts', 'Communication and Media'],
    courseTerms: ['multimedia', 'animation', 'digital media', 'creative media', 'game'],
  },
  'secondary-school-teacher': {
    studyFields: ['Education'],
    courseTerms: ['education', 'teaching'],
  },
  accountant: {
    studyFields: ['Accounting'],
    courseTerms: ['accounting', 'accountancy', 'perakaunan'],
  },
  'medical-doctor': {
    studyFields: ['Medicine'],
    courseTerms: ['medicine', 'foundation in science', 'life science'],
  },
  pharmacist: {
    studyFields: ['Pharmacy'],
    courseTerms: ['pharmacy', 'foundation in science'],
  },
  nurse: {
    studyFields: ['Nursing'],
    courseTerms: ['nursing', 'kejururawatan'],
  },
  'biomedical-scientist': {
    studyFields: ['Biomedical Science', 'Science'],
    courseTerms: ['biomedical', 'medical laboratory', 'foundation in science'],
  },
  'mechanical-engineer': {
    studyFields: ['Engineering'],
    courseTerms: [
      'mechanical',
      'mechatronic',
      'manufactur',
      'automotive',
      'foundation in engineering',
    ],
  },
  'electrical-engineer': {
    studyFields: ['Engineering'],
    courseTerms: ['electrical', 'electronic', 'foundation in engineering'],
  },
  lawyer: {
    studyFields: ['Law'],
    courseTerms: ['law', 'llb'],
  },
  psychologist: {
    studyFields: ['Arts and Social Sciences', 'Counselling'],
    courseTerms: ['psychology'],
  },
  chef: {
    studyFields: ['Business and Economics'],
    courseTerms: ['culinary', 'patisserie', 'hospitality', 'food service'],
  },
  physiotherapist: {
    studyFields: ['Biomedical Science'],
    courseTerms: ['physiotherapy'],
  },
};

export function careerStudyLinks(slug) {
  return CAREER_STUDY_LINKS[slug] ?? { studyFields: [], courseTerms: [] };
}
