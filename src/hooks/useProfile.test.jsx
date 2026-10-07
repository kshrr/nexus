import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const h = vi.hoisted(() => {
  const eqAfterUpdate = vi.fn(async () => ({ error: null }));
  const eqAfterDelete = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: eqAfterUpdate }));
  const del = vi.fn(() => ({ eq: eqAfterDelete }));
  const upsert = vi.fn(async () => ({ error: null }));
  const insert = vi.fn(async () => ({ error: null }));
  const rpc = vi.fn(async () => ({ error: null }));
  const refreshProfile = vi.fn(async () => {});
  return { eqAfterUpdate, eqAfterDelete, update, del, upsert, insert, rpc, refreshProfile };
});

vi.mock('@/context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'a@test.nexus' },
    profile: { id: 'user-1', full_name: 'Student A', role: 'student' },
    refreshProfile: h.refreshProfile,
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: h.update,
      upsert: h.upsert,
      insert: h.insert,
      delete: h.del,
    })),
    rpc: h.rpc,
  },
}));

import { useProfile } from './useProfile';

beforeEach(() => vi.clearAllMocks());

describe('useProfile.updateProfile — authorization / ownership at the client layer', () => {
  it('never forwards `role` (or unknown keys) in the update payload', async () => {
    const { result } = renderHook(() => useProfile());
    await act(async () => {
      await result.current.updateProfile({
        full_name: 'New Name',
        role: 'admin', // must be stripped — no client path writes role (§5.7)
        profile_completed: true, // not in this method's allow-list
        injected: 'x',
      });
    });
    expect(h.update).toHaveBeenCalledTimes(1);
    expect(h.update).toHaveBeenCalledWith({ full_name: 'New Name' });
  });

  it('always scopes the write to the caller’s own id', async () => {
    const { result } = renderHook(() => useProfile());
    await act(async () => {
      await result.current.updateProfile({ career_goal: 'Doctor' });
    });
    expect(h.eqAfterUpdate).toHaveBeenCalledWith('id', 'user-1');
    expect(h.refreshProfile).toHaveBeenCalled();
  });
});

describe('useProfile.completeProfileSetup', () => {
  it('sets profile_completed and persists the four profile fields', async () => {
    const { result } = renderHook(() => useProfile());
    await act(async () => {
      await result.current.completeProfileSetup({
        fullName: '  Kauthar  ',
        educationLevel: 'stpm',
        careerGoal: '',
        targetIndustry: 'Information Technology',
      });
    });
    expect(h.update).toHaveBeenCalledWith({
      full_name: 'Kauthar',
      education_level: 'stpm',
      career_goal: null,
      target_industry: 'Information Technology',
      profile_completed: true,
    });
    expect(h.eqAfterUpdate).toHaveBeenCalledWith('id', 'user-1');
  });

  it('writes grades only for SPM students, then recomputes strengths in SQL', async () => {
    const { result } = renderHook(() => useProfile());
    await act(async () => {
      await result.current.completeProfileSetup({
        fullName: 'Kauthar',
        educationLevel: 'spm',
        grades: [
          { subjectCode: 'MATH', examType: 'spm_actual', grade: 'A' },
          { subjectCode: 'BIOLOGY', examType: 'spm_actual', grade: '' }, // dropped
        ],
      });
    });
    expect(h.upsert).toHaveBeenCalledWith(
      [{ user_id: 'user-1', subject_code: 'MATH', exam_type: 'spm_actual', grade: 'A' }],
      { onConflict: 'user_id,exam_type,subject_code' }
    );
    expect(h.rpc).toHaveBeenCalledWith('compute_subject_strengths');
  });
});

describe('useProfile.replaceGrades — Profile > Results editor', () => {
  it('clears then re-inserts the whole set and recomputes', async () => {
    const { result } = renderHook(() => useProfile());
    await act(async () => {
      await result.current.replaceGrades([
        { subjectCode: 'MATH', examType: 'spm_trial', grade: 'B+' },
      ]);
    });
    expect(h.del).toHaveBeenCalled();
    expect(h.eqAfterDelete).toHaveBeenCalledWith('user_id', 'user-1');
    expect(h.insert).toHaveBeenCalledWith([
      { user_id: 'user-1', subject_code: 'MATH', exam_type: 'spm_trial', grade: 'B+' },
    ]);
    expect(h.rpc).toHaveBeenCalledWith('compute_subject_strengths');
  });
});
