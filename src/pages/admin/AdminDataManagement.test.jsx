import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { reviewedCareer } from '@/test/fixtures/careerEvidence';
const f = vi.hoisted(() => ({ career: null, payload: null, stageWrites: [], selected: [] }));
vi.mock('@/hooks/useAdminCatalog', () => ({
  useAdminCatalog: (table) => ({
    items: table === 'careers' ? [f.career] : [],
    loading: false,
    error: null,
    reload: () => {},
    update: async (_, payload) => {
      f.payload = payload;
      return { error: null };
    },
    create: async () => ({ error: null }),
  }),
}));
vi.mock('@/hooks/useAdminCareerCourses', () => ({
  useAdminCareerCourses: () => ({
    selectedIds: f.selected,
    loading: false,
    replace: async () => ({ error: null }),
    updateRoutes: async (routes) => {
      f.stageWrites.push(routes);
      return { error: null };
    },
  }),
}));
vi.mock('@/components/admin/CourseSyncPanel', () => ({ CourseSyncPanel: () => null }));
import AdminDataManagement from './AdminDataManagement';
beforeEach(() => {
  f.career = reviewedCareer();
  f.payload = null;
  f.stageWrites = [];
});
async function edit() {
  render(
    <MemoryRouter>
      <AdminDataManagement />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Careers' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
}
it('saves a one-letter profile without restoring evidence or rewriting stage two', async () => {
  await edit();
  fireEvent.change(screen.getByLabelText(/RIASEC profile/), { target: { value: 'S' } });
  fireEvent.click(screen.getByRole('button', { name: /Save career/i }));
  await waitFor(() => expect(f.payload?.riasec_profile).toBe('S'));
  expect(f.payload.content_review).toBeUndefined();
  expect(f.stageWrites).toEqual([]);
});
it('lets a broad career retain unknown canonical code and warns about a new review', async () => {
  await edit();
  fireEvent.change(screen.getByLabelText(/RIASEC profile/), { target: { value: '' } });
  expect(screen.getByText(/editing.*new content review/i)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Save career/i }));
  await waitFor(() => expect(f.payload).not.toBeNull());
  expect(f.payload.riasec_profile).toBeNull();
});
