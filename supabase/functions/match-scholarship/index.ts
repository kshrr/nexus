/**
 * fn:match-scholarship — architecture.md §10.5, §15.
 *
 *   POST { scholarship_ids?: uuid[] }   (omitted = all active scholarships)
 *   -> { matches: [{ scholarship_id, eligibility_score, relevance_score, checklist[] }] }
 *
 * Read-only against the database. Every query runs under the caller's JWT
 * (FR-SEC-05), so a student can only ever be matched against their own profile.
 *
 * The evaluation logic itself is business logic and stays server-side
 * (§3.3.2C) — the browser receives the resulting checklist, never the rules
 * that produced it.
 */
import { getCaller } from '../_shared/auth.ts';
import { fail, ok, preflight, serverError } from '../_shared/http.ts';
import { GRADE_POINTS, matchAll, type Criterion, type ScholarshipRow } from '../_shared/scholarship.ts';

const MAX_IDS = 200;

// @ts-expect-error — Deno global
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req);

  try {
    if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Unsupported request.');

    const caller = await getCaller(req);
    if (!caller) {
      return fail(401, 'UNAUTHENTICATED', 'Sign in to see which scholarships you qualify for.');
    }
    const { client, userId } = caller;

    let body: { scholarship_ids?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    let ids: string[] | null = null;
    if (Array.isArray(body.scholarship_ids)) {
      ids = body.scholarship_ids.filter((v): v is string => typeof v === 'string').slice(0, MAX_IDS);
    }

    // ---- the student's own data (RLS-scoped) ------------------------------
    const [profileRes, resultsRes, recsRes] = await Promise.all([
      client
        .from('profiles')
        .select('education_level, career_goal, target_industry')
        .eq('id', userId)
        .maybeSingle(),
      client.from('academic_results').select('subject_code, grade').eq('user_id', userId),
      client.from('recommendations').select('target_id').eq('user_id', userId).eq('rec_type', 'course'),
    ]);
    if (profileRes.error) throw profileRes.error;
    if (resultsRes.error) throw resultsRes.error;
    if (recsRes.error) throw recsRes.error;

    // Average grade points per subject, on the §8.2 scale.
    const totals: Record<string, { sum: number; n: number }> = {};
    for (const row of resultsRes.data ?? []) {
      const points = GRADE_POINTS[row.grade];
      if (points === undefined) continue;
      totals[row.subject_code] = totals[row.subject_code] ?? { sum: 0, n: 0 };
      totals[row.subject_code].sum += points;
      totals[row.subject_code].n += 1;
    }
    const subjectPoints: Record<string, number> = {};
    for (const [code, { sum, n }] of Object.entries(totals)) subjectPoints[code] = sum / n;

    // Course fields the engine already recommended (§10.5 relevance signal).
    const courseIds = (recsRes.data ?? []).map((r) => r.target_id);
    let recommendedFields: string[] = [];
    if (courseIds.length) {
      const { data: courses, error } = await client
        .from('courses')
        .select('field_of_study')
        .in('id', courseIds);
      if (error) throw error;
      recommendedFields = [...new Set((courses ?? []).map((c) => c.field_of_study))];
    }

    // ---- scholarships + their criteria (public-read reference data) -------
    let query = client
      .from('scholarships')
      .select('id, name, provider, deadline, status, field_of_study, education_levels');
    query = ids?.length ? query.in('id', ids) : query.eq('status', 'active');

    const { data: scholarships, error: scholarshipsError } = await query;
    if (scholarshipsError) throw scholarshipsError;

    const rows = (scholarships ?? []) as ScholarshipRow[];
    if (rows.length === 0) return ok({ matches: [] });

    const { data: criteriaRows, error: criteriaError } = await client
      .from('scholarship_criteria')
      .select('id, scholarship_id, criterion_type, operator, value, label, is_checkable')
      .in(
        'scholarship_id',
        rows.map((r) => r.id)
      );
    if (criteriaError) throw criteriaError;

    const criteriaByScholarship = new Map<string, Criterion[]>();
    for (const row of criteriaRows ?? []) {
      const list = criteriaByScholarship.get(row.scholarship_id) ?? [];
      list.push(row as unknown as Criterion);
      criteriaByScholarship.set(row.scholarship_id, list);
    }
    // Stable input order so the ranking tie-breaks are reproducible.
    for (const list of criteriaByScholarship.values()) {
      list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }

    const matches = matchAll(rows, criteriaByScholarship, {
      educationLevel: profileRes.data?.education_level ?? null,
      careerGoal: profileRes.data?.career_goal ?? null,
      targetIndustry: profileRes.data?.target_industry ?? null,
      subjectPoints,
      recommendedFields,
    });

    return ok({ matches, generated_at: new Date().toISOString() });
  } catch (err) {
    return serverError(err);
  }
});
