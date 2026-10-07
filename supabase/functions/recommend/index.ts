/**
 * fn:recommend — architecture.md §9.5, §15.
 *
 *   POST {}  (identity comes from the JWT)
 *   -> { careers[], courses[], secondary_careers[], degraded_mode, generated_at }
 *
 * Precondition: riasec_results must exist, else 422 RIASEC_REQUIRED.
 *
 * The rule base lives in rules.json on the server and is never shipped to the
 * browser (§3.3.2C / AC-26). The engine is deterministic and knowledge-based —
 * no model is consulted at any point (§4.1.3).
 */
import { getCaller } from '../_shared/auth.ts';
import { fail, ok, preflight, serverError } from '../_shared/http.ts';
import { HEXAGON_ORDER, type Letter, type Scores } from '../_shared/riasec.ts';
import {
  generateRecommendations,
  validateRuleBase,
  type Catalog,
  type RuleBase,
  type Strength,
  type StudentFacts,
} from '../_shared/rules.ts';

import ruleBaseJson from './rules.json' with { type: 'json' };

const ruleBase = ruleBaseJson as unknown as RuleBase;
const ruleCheck = validateRuleBase(ruleBase);

const SCORE_COLUMNS: Record<Letter, string> = {
  R: 'realistic_score',
  I: 'investigative_score',
  A: 'artistic_score',
  S: 'social_score',
  E: 'enterprising_score',
  C: 'conventional_score',
};

// @ts-expect-error — Deno global
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight(req);

  try {
    if (!ruleCheck.ok) {
      return fail(500, 'RULE_BASE_INVALID', 'Recommendations are unavailable right now.');
    }
    if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Unsupported request.');

    const caller = await getCaller(req);
    if (!caller) return fail(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    const { client, userId } = caller;

    // ---- load the student's facts (caller-scoped: RLS applies) -----------
    const [profileRes, riasecRes, strengthsRes] = await Promise.all([
      client
        .from('profiles')
        .select('education_level, career_goal, target_industry')
        .eq('id', userId)
        .maybeSingle(),
      client.from('riasec_results').select('*').eq('user_id', userId).maybeSingle(),
      client.from('subject_strengths').select('subject_code, strength').eq('user_id', userId),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (riasecRes.error) throw riasecRes.error;
    if (strengthsRes.error) throw strengthsRes.error;

    if (!riasecRes.data) {
      return fail(
        422,
        'RIASEC_REQUIRED',
        'Take the interest assessment first — it is the starting point for every recommendation.'
      );
    }

    const scores = {} as Scores;
    for (const letter of HEXAGON_ORDER) {
      scores[letter] = Number(riasecRes.data[SCORE_COLUMNS[letter]] ?? 0);
    }

    const subjectStrengths: Record<string, Strength> = {};
    for (const row of strengthsRes.data ?? []) {
      subjectStrengths[row.subject_code] = row.strength as Strength;
    }

    // subjects is public-read reference data (§4.5)
    const { data: subjectRows, error: subjectsError } = await client
      .from('subjects')
      .select('code, domain');
    if (subjectsError) throw subjectsError;
    const subjectDomains: Record<string, string> = {};
    for (const row of subjectRows ?? []) subjectDomains[row.code] = row.domain;

    const facts: StudentFacts = {
      hollandCode: riasecRes.data.holland_code,
      scores,
      subjectStrengths,
      subjectDomains,
      educationLevel: profileRes.data?.education_level ?? null,
      careerGoal: profileRes.data?.career_goal ?? null,
      targetIndustry: profileRes.data?.target_industry ?? null,
    };

    // ---- load the catalog ------------------------------------------------
    const [careersRes, coursesRes] = await Promise.all([
      client.from('careers').select('id, name, slug, field, description, riasec_profile').eq('is_active', true),
      client
        .from('courses')
        .select(
          'id, name, field_of_study, pathway_type, duration_months, entry_requirements, universities(name)'
        )
        .eq('is_active', true),
    ]);
    if (careersRes.error) throw careersRes.error;
    if (coursesRes.error) throw coursesRes.error;

    const catalog: Catalog = {
      careers: (careersRes.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        field: c.field,
        description: c.description,
        riasec_profile: c.riasec_profile,
      })),
      courses: (coursesRes.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        field_of_study: c.field_of_study,
        university_name: c.universities?.name ?? null,
        pathway_type: c.pathway_type,
        duration_months: c.duration_months,
        entry_requirements: c.entry_requirements,
      })),
    };

    // ---- run the engine --------------------------------------------------
    const result = generateRecommendations(ruleBase, facts, catalog);
    const generatedAt = new Date().toISOString();

    // ---- persist: delete then insert (§9.5, §9.7 — no history kept) ------
    const { error: deleteError } = await client
      .from('recommendations')
      .delete()
      .eq('user_id', userId);
    if (deleteError) throw deleteError;

    const rows = [
      ...result.careers.map((r) => ({ ...r, rec_type: 'career' })),
      ...result.courses.map((r) => ({ ...r, rec_type: 'course' })),
    ].map((r) => ({
      user_id: userId,
      rec_type: r.rec_type,
      target_id: r.target_id,
      match_score: r.match_score,
      rank: r.rank,
      reasons: r.reasons,
      rule_id: r.rule_id,
      degraded_mode: result.degradedMode,
      generated_at: generatedAt,
    }));

    if (rows.length) {
      const { error: insertError } = await client.from('recommendations').insert(rows);
      if (insertError) throw insertError;
    }

    // Denormalised detail is returned for rendering but never stored.
    const careerDetail = new Map(catalog.careers.map((c) => [c.id, c]));
    const courseDetail = new Map(catalog.courses.map((c) => [c.id, c]));

    return ok({
      careers: result.careers.map((r) => ({ ...r, detail: careerDetail.get(r.target_id) })),
      courses: result.courses.map((r) => ({ ...r, detail: courseDetail.get(r.target_id) })),
      secondary_careers: result.secondaryCareers.map((s) => ({
        detail: s.detail,
        shared_letters: s.sharedLetters,
      })),
      degraded_mode: result.degradedMode,
      generated_at: generatedAt,
      rule_base_version: ruleBase.version,
    });
  } catch (err) {
    return serverError(err);
  }
});
