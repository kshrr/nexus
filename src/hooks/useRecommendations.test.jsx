import { renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { reviewedCareer } from '@/test/fixtures/careerEvidence';
const f = vi.hoisted(() => ({ read: vi.fn(), projection: '', user: { id: 'student' } }));
vi.mock('@/context/useAuth', () => ({ useAuth: () => ({ user: f.user }) }));
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table) => {
      const q = {
        select: (cols) => {
          if (table === 'careers') f.projection = cols;
          return q;
        },
        eq: () => q,
        order: () => q,
        in: () => q,
        then: (resolve, reject) => f.read(table).then(resolve, reject),
      };
      return q;
    },
  },
}));
import { useRecommendations } from './useRecommendations';
it('loads current evidence for cached careers while retaining historical rule reasons', async () => {
  const row = {
    id: 'r',
    target_id: 'career-1',
    rec_type: 'career',
    rank: 1,
    reasons: [{ label: 'Historical rule observation' }],
    rule_id: 'rule',
    match_score: 75,
    generated_at: '2026-10-01',
  };
  f.read.mockImplementation(async (table) => ({
    data: table === 'recommendations' ? [row] : table === 'careers' ? [reviewedCareer()] : [],
    error: null,
  }));
  const { result } = renderHook(() => useRecommendations());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(f.projection).toContain('content_review');
  expect(f.projection).toContain('reference_occupations');
  expect(result.current.careers[0].reasons).toEqual([{ label: 'Historical rule observation' }]);
  expect(result.current.generatedAt).toBe('2026-10-01');
});
