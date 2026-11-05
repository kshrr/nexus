/** Shared, fail-closed interpretation of stored evidence. No network or private data. */
export type ReviewStatus = 'pending' | 'source_checked' | 'limited';
export type SectionName =
  'overview' | 'responsibilities' | 'skills' | 'subjects' | 'study_options' | 'interests';
export interface CareerSource {
  source_id: string;
  title: string;
  publisher: string;
  url: string;
  jurisdiction: string;
  scope: string;
  access_note: string;
  effective_on: string | null;
}
export interface SectionReview {
  status: ReviewStatus;
  kind: 'source_informed' | 'nexus_planning';
  checked_on: string | null;
  limitations: string[];
  sources: CareerSource[];
}
export interface ReferenceOccupation {
  reference_id: string;
  name: string;
  mapping_kind: 'direct' | 'related' | 'example';
  scope_note: string;
  interest_code: string;
  interest_source_id: string;
}
export interface CareerEvidenceInput {
  content_review?: unknown;
  reference_occupations?: unknown;
}
const sectionNames = [
  'overview',
  'responsibilities',
  'skills',
  'subjects',
  'study_options',
  'interests',
];
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && Boolean(value.trim());
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const date = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function isValidInterestCode(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[RIASEC]{1,6}$/.test(value) &&
    new Set(value).size === value.length
  );
}
function source(value: unknown): value is CareerSource {
  if (
    !object(value) ||
    !['source_id', 'title', 'publisher', 'jurisdiction', 'scope'].every((k) => text(value[k])) ||
    !text(value.url) ||
    typeof value.access_note !== 'string' ||
    !(value.effective_on === null || date(value.effective_on))
  )
    return false;
  try {
    const url = new URL(value.url);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
function review(value: unknown): value is SectionReview {
  if (
    !object(value) ||
    typeof value.status !== 'string' ||
    !['pending', 'source_checked', 'limited'].includes(value.status) ||
    typeof value.kind !== 'string' ||
    !['source_informed', 'nexus_planning'].includes(value.kind) ||
    !strings(value.limitations) ||
    !Array.isArray(value.sources) ||
    !value.sources.every(source) ||
    new Set(value.sources.map((s) => s.source_id)).size !== value.sources.length
  )
    return false;
  if (value.status === 'pending') return value.checked_on === null;
  return (
    date(value.checked_on) &&
    (value.status !== 'limited' || value.limitations.length > 0) &&
    (value.kind === 'nexus_planning' || value.sources.length > 0)
  );
}
export function normaliseStageReview(value: unknown): SectionReview | null {
  return review(value) && value.status !== 'pending' ? value : null;
}
export function normaliseCareerEvidence(career: unknown): {
  status: ReviewStatus;
  checked_on: string | null;
  limitations: string[];
  sections: Partial<Record<SectionName, SectionReview>>;
  references: ReferenceOccupation[];
} {
  const empty = {
    status: 'pending' as ReviewStatus,
    checked_on: null,
    limitations: [],
    sections: {},
    references: [],
  };
  if (!object(career) || !object(career.content_review)) return empty;
  const r = career.content_review;
  if (
    typeof r.status !== 'string' ||
    !['source_checked', 'limited'].includes(r.status) ||
    !date(r.checked_on) ||
    !strings(r.limitations) ||
    (r.status === 'limited' && !r.limitations.length) ||
    !object(r.sections) ||
    !Object.keys(r.sections).length ||
    !Object.entries(r.sections).every(([key, v]) => sectionNames.includes(key) && review(v)) ||
    !Array.isArray(career.reference_occupations)
  )
    return empty;
  const sections = r.sections as Partial<Record<SectionName, SectionReview>>;
  const ids = new Set<string>();
  for (const entry of career.reference_occupations) {
    if (
      !object(entry) ||
      !['reference_id', 'name', 'scope_note', 'interest_source_id'].every((k) => text(entry[k])) ||
      typeof entry.mapping_kind !== 'string' ||
      !['direct', 'related', 'example'].includes(entry.mapping_kind) ||
      !isValidInterestCode(entry.interest_code) ||
      ids.has(String(entry.reference_id)) ||
      !sections.interests?.sources.some((s) => s.source_id === entry.interest_source_id)
    )
      return empty;
    ids.add(String(entry.reference_id));
  }
  return {
    status: r.status as ReviewStatus,
    checked_on: r.checked_on,
    limitations: r.limitations,
    sections: Object.fromEntries(
      Object.entries(sections).filter(([, v]) => v?.status !== 'pending')
    ),
    references:
      sections.interests?.status === 'source_checked'
        ? (career.reference_occupations as ReferenceOccupation[])
        : [],
  };
}
export function getSectionReview(career: unknown, section: SectionName): SectionReview | null {
  return normaliseCareerEvidence(career).sections[section] ?? null;
}
export function getBestInterestReference(
  career: unknown,
  studentCode: string,
  options: { requireThreshold?: boolean } = {}
): { reference: ReferenceOccupation; sharedLetters: string[] } | null {
  if (!isValidInterestCode(studentCode)) return null;
  const entries = normaliseCareerEvidence(career).references.map((reference) => ({
    reference,
    sharedLetters: [...reference.interest_code].filter((letter) => studentCode.includes(letter)),
  }));
  return (
    entries
      .filter(
        (entry) =>
          entry.sharedLetters.length >=
          (options.requireThreshold === false
            ? 1
            : Math.min(2, entry.reference.interest_code.length))
      )
      .sort(
        (a, b) =>
          b.sharedLetters.length - a.sharedLetters.length ||
          (a.reference.reference_id < b.reference.reference_id
            ? -1
            : a.reference.reference_id > b.reference.reference_id
              ? 1
              : 0)
      )[0] ?? null
  );
}
