import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { normaliseError } from '@/lib/api';
import { useAuth } from '@/context/useAuth';

/**
 * Profile reads + mutations (FR03, FR04).
 *
 * Reads come from AuthContext (`profile`) so the row is fetched once and shared
 * app-wide (§3.3.3D). Writes go direct to PostgREST under RLS — a student can
 * only ever touch their own row (policy `profiles_update`, §4.4), and `role` is
 * never in any payload (there is no application code path that writes it, §5.7).
 *
 * @returns {{
 *   profile: import('@/types').Profile | null,
 *   saving: boolean,
 *   updateProfile: (patch: Partial<import('@/types').Profile>) => Promise<{ error: import('@/lib/api').ApiError | null }>,
 *   completeProfileSetup: (input: ProfileSetupInput) => Promise<{ error: import('@/lib/api').ApiError | null }>,
 *   saveGrades: (grades: GradeEntry[]) => Promise<{ error: import('@/lib/api').ApiError | null }>,
 *   replaceGrades: (grades: GradeEntry[]) => Promise<{ error: import('@/lib/api').ApiError | null }>,
 * }}
 *
 * @typedef {{ subjectCode: string, examType: string, grade: string }} GradeEntry
 * @typedef {{
 *   fullName: string, educationLevel: string,
 *   careerGoal?: string | null, targetIndustry?: string | null, nationality?: string | null,
 *   birthYear?: number | null, householdIncomeBand?: string | null,
 *   grades?: GradeEntry[]
 * }} ProfileSetupInput
 */
export function useProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  /** Only these columns are ever writable from the client. */
  const pickWritable = (patch) => {
    const allowed = [
      'full_name',
      'education_level',
      'career_goal',
      'target_industry',
      'nationality',
      'birth_year',
      'household_income_band',
    ];
    const out = {};
    for (const key of allowed) if (key in patch) out[key] = patch[key];
    return out;
  };

  const updateProfile = useCallback(
    async (patch) => {
      if (!user) return { error: { code: 'NO_SESSION', message: 'You are not signed in.' } };
      setSaving(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update(pickWritable(patch))
          .eq('id', user.id);
        if (error) throw error;
        await refreshProfile();
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      } finally {
        setSaving(false);
      }
    },
    [user, refreshProfile]
  );

  const saveGrades = useCallback(
    async (grades) => {
      if (!user) return { error: { code: 'NO_SESSION', message: 'You are not signed in.' } };
      const rows = grades
        .filter((g) => g.grade)
        .map((g) => ({
          user_id: user.id,
          subject_code: g.subjectCode,
          exam_type: g.examType,
          grade: g.grade,
        }));
      setSaving(true);
      try {
        if (rows.length) {
          const { error } = await supabase
            .from('academic_results')
            .upsert(rows, { onConflict: 'user_id,exam_type,subject_code' });
          if (error) throw error;
        }
        // Recompute the strength profile in one place (SQL) — architecture.md §8.1.
        const { error: rpcError } = await supabase.rpc('compute_subject_strengths');
        if (rpcError) throw rpcError;
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  /**
   * Replace the student's entire grade set (used by the Profile > Results
   * editor, where subjects and cells can be removed). Delete-then-insert keeps
   * the stored set an exact mirror of the form; RLS confines both to own rows.
   * @param {GradeEntry[]} grades
   */
  const replaceGrades = useCallback(
    async (grades, options = {}) => {
      if (!user) return { error: { code: 'NO_SESSION', message: 'You are not signed in.' } };
      setSaving(true);
      try {
        // By default the whole set is replaced. With `examTypes` only those periods are replaced, so
        // grades from other periods (Form 4, trial) that the editor does not show are kept. Subjects
        // dropped from the list (`keepSubjects` given) are removed in every period.
        let removeQuery = supabase.from('academic_results').delete().eq('user_id', user.id);
        if (options.examTypes) removeQuery = removeQuery.in('exam_type', options.examTypes);
        const { error: delError } = await removeQuery;
        if (delError) throw delError;
        if (options.keepSubjects) {
          const { data: existing, error: readError } = await supabase
            .from('academic_results')
            .select('subject_code')
            .eq('user_id', user.id);
          if (readError) throw readError;
          const dropped = [...new Set((existing ?? []).map((row) => row.subject_code))].filter(
            (code) => !options.keepSubjects.includes(code)
          );
          if (dropped.length) {
            const { error: dropError } = await supabase
              .from('academic_results')
              .delete()
              .eq('user_id', user.id)
              .in('subject_code', dropped);
            if (dropError) throw dropError;
          }
        }

        const rows = grades
          .filter((g) => g.grade)
          .map((g) => ({
            user_id: user.id,
            subject_code: g.subjectCode,
            exam_type: g.examType,
            grade: g.grade,
          }));
        if (rows.length) {
          const { error: insError } = await supabase.from('academic_results').insert(rows);
          if (insError) throw insError;
        }
        const { error: rpcError } = await supabase.rpc('compute_subject_strengths');
        if (rpcError) throw rpcError;
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  const completeProfileSetup = useCallback(
    async ({
      fullName,
      educationLevel,
      careerGoal,
      targetIndustry,
      nationality,
      birthYear,
      householdIncomeBand,
      grades,
    }) => {
      if (!user) return { error: { code: 'NO_SESSION', message: 'You are not signed in.' } };
      setSaving(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            education_level: educationLevel,
            career_goal: careerGoal?.trim() || null,
            target_industry: targetIndustry?.trim() || null,
            nationality: nationality || null,
            birth_year: birthYear ? Number(birthYear) : null,
            household_income_band: householdIncomeBand || null,
            profile_completed: true,
          })
          .eq('id', user.id);
        if (error) throw error;

        if (grades?.length) {
          const { error: gradeError } = await saveGrades(grades);
          if (gradeError) throw new Error(gradeError.message);
        }

        await refreshProfile();
        return { error: null };
      } catch (err) {
        return { error: normaliseError(err) };
      } finally {
        setSaving(false);
      }
    },
    [user, refreshProfile, saveGrades]
  );

  return { profile, saving, updateProfile, completeProfileSetup, saveGrades, replaceGrades };
}

export default useProfile;
