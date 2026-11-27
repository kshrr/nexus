import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ rpc: vi.fn(), reject: false }));
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table) => {
      const result = () =>
        Promise.resolve({
          data:
            table === 'scholarships'
              ? { id: 'kijang', name: 'Biasiswa Sarjana Muda Kijang', source_url: 'https://www.bnm.gov.my/careers/scholarships' }
              : [{ id: 'c1', label: 'Malaysian citizen', is_checkable: false }],
          error: null,
        });
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        maybeSingle: result,
        then: (resolve, reject) => result().then(resolve, reject),
      };
      return q;
    },
    rpc: (...args) => (f.reject ? Promise.reject(new Error('network')) : f.rpc(...args)),
  },
}));
import { useScholarship } from './useScholarships';

const PDF = 'https://www.bnm.gov.my/documents/20124/1514833/Approved_Universities_for_Academic_Year_2026.pdf';

beforeEach(() => {
  f.rpc.mockReset();
  f.reject = false;
});

it('loads the official requirement documents for the scholarship', async () => {
  f.rpc.mockResolvedValue({ data: [{ label: 'Approved universities (PDF)', url: PDF }], error: null });
  const { result } = renderHook(() => useScholarship('kijang'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(f.rpc).toHaveBeenCalledWith('scholarship_source_documents', { p_scholarship_id: 'kijang' });
  expect(result.current.documents).toEqual([{ label: 'Approved universities (PDF)', url: PDF }]);
});

it('drops anything that is not an https PDF link', async () => {
  f.rpc.mockResolvedValue({
    data: [
      { label: 'Plain http', url: 'http://www.bnm.gov.my/a.pdf' },
      { label: 'Script', url: 'javascript:alert(1)' },
      { label: 'Page', url: 'https://www.bnm.gov.my/a.html' },
      { label: '', url: PDF },
      { label: 'Kept (PDF)', url: PDF },
    ],
    error: null,
  });
  const { result } = renderHook(() => useScholarship('kijang'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.documents).toEqual([{ label: 'Kept (PDF)', url: PDF }]);
});

it('still shows the scholarship when documents cannot be loaded', async () => {
  f.rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
  const { result } = renderHook(() => useScholarship('kijang'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeNull();
  expect(result.current.scholarship.name).toBe('Biasiswa Sarjana Muda Kijang');
  expect(result.current.documents).toEqual([]);
});

it('still shows the scholarship when the documents request rejects', async () => {
  f.reject = true;
  const { result } = renderHook(() => useScholarship('kijang'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeNull();
  expect(result.current.scholarship.name).toBe('Biasiswa Sarjana Muda Kijang');
  expect(result.current.documents).toEqual([]);
});
