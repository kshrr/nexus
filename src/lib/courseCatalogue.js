import registeredSources from '../../scraper/course_sources.json';
export const COURSE_PAGE_SIZE = 24;
export const PATHWAY_LABELS = {
  degree: "Bachelor's degree",
  diploma: 'Diploma',
  foundation: 'Foundation',
  matriculation: 'Matriculation',
  stpm: 'STPM',
};
export const TYPE_LABELS = {
  public: 'Public',
  private: 'Private',
  polytechnic: 'Polytechnic',
  college: 'College',
};
const METADATA =
  'id,name,field_of_study,pathway_type,duration_months,university_id,universities(id,name,state,type)';

// Public reference-data queries; recommendation rules and scores are separate.
export async function fetchCoursePage(client, filters = {}, signal) {
  const {
    search = '',
    state = '',
    field = '',
    university = '',
    type = '',
    pathway = '',
    duration = '',
    sort = 'name',
    page = 1,
  } = filters;
  const select =
    state || type ? METADATA.replace('universities(', 'universities!inner(') : METADATA;
  let query = client.from('courses').select(select, { count: 'exact' }).eq('is_active', true);
  if (search.trim())
    query = query.ilike('name', '%' + search.trim().replace(/[%_\\]/g, '\\$&') + '%');
  if (state) query = query.eq('universities.state', state);
  if (type) query = query.eq('universities.type', type);
  if (field) query = query.eq('field_of_study', field);
  if (university) query = query.eq('university_id', university);
  if (pathway) query = query.eq('pathway_type', pathway);
  if (duration === 'under-24') query = query.lt('duration_months', 24);
  if (duration === '24-48') query = query.gte('duration_months', 24).lte('duration_months', 48);
  if (duration === 'over-48') query = query.gt('duration_months', 48);
  if (sort === 'duration')
    query = query.order('duration_months', { ascending: true, nullsFirst: false });
  query = query.order('name', { ascending: sort !== 'name-desc' }).order('id');
  const offset = (Math.max(1, Number(page) || 1) - 1) * COURSE_PAGE_SIZE;
  query = query.range(offset, offset + COURSE_PAGE_SIZE - 1);
  if (signal) query = query.abortSignal(signal);
  const { data, error, count } = await query;
  if (error) {
    if (error.code === 'PGRST103' && offset > 0) {
      const firstPage = await fetchCoursePage(client, { ...filters, page: 1 }, signal);
      return { items: [], total: firstPage.total, outOfRange: true };
    }
    throw error;
  }
  return { items: data ?? [], total: count ?? 0 };
}

export async function fetchCourseFacets(client, signal) {
  const fields = new Set(),
    states = new Set(),
    pathways = new Set(),
    types = new Set(),
    universities = new Map();
  let offset = 0,
    total = 0;
  // Read only light metadata, in stable batches, so facets do not stop at the
  // API's row cap or reflect just the current result page.
  for (;;) {
    let query = client
      .from('courses')
      .select('id,field_of_study,pathway_type,universities(id,name,state,type)', { count: 'exact' })
      .eq('is_active', true)
      .order('id')
      .range(offset, offset + 999);
    if (signal) query = query.abortSignal(signal);
    const { data, error, count } = await query;
    if (error) throw error;
    const rows = data ?? [];
    total = count ?? offset + rows.length;
    for (const row of rows) {
      if (row.field_of_study) fields.add(row.field_of_study);
      if (row.pathway_type) pathways.add(row.pathway_type);
      const university = row.universities;
      if (university?.id) universities.set(university.id, university);
      if (university?.state) states.add(university.state);
      if (university?.type) types.add(university.type);
    }
    offset += rows.length;
    if (!rows.length || (count != null ? offset >= count : rows.length < 1000)) break;
  }
  const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));
  return {
    fields: sorted(fields),
    states: sorted(states),
    pathways: sorted(pathways),
    types: sorted(types),
    universities: [...universities.values()].sort((a, b) => a.name.localeCompare(b.name)),
    total,
  };
}

export function safeCourseSource(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.hostname.includes('.') &&
      !url.hostname.endsWith('.localhost')
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function safeRegisteredCourseSource(value) {
  const safe = safeCourseSource(value);
  if (!safe) return null;
  const url = new URL(safe);
  if (url.port && url.port !== '443') return null;
  for (const [source, definition] of Object.entries(registeredSources)) {
    const rule = definition.destinations[url.hostname];
    if (!rule) continue;
    const path = url.pathname.replace(/\/$/, '') || '/';
    if (!new RegExp(`^(?:${rule.path})$`, 'i').test(path)) return null;
    const query = url.search.slice(1);
    if (!query) return source === 'unimap' && path === '/programme.php' ? null : safe;
    if (
      rule.query === 'pid' &&
      ['/academic-programmes', '/tamhidi'].includes(path) &&
      /^pid=[1-9][0-9]{0,8}$/.test(query)
    )
      return safe;
    if (rule.query === 'id' && path === '/programme.php' && /^id=UR[0-9]{7}$/.test(query))
      return safe;
    return null;
  }
  return null;
}

export function formatCourseDuration(months) {
  if (!Number.isFinite(months) || months <= 0) return 'Duration not listed';
  if (months >= 12 && months % 3 === 0) {
    const years = months / 12;
    return years + ' ' + (years === 1 ? 'year' : 'years');
  }
  return months + ' ' + (months === 1 ? 'month' : 'months');
}
