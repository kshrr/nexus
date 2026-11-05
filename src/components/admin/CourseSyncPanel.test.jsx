import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, it, expect, vi } from 'vitest';
import { CourseSyncPanel } from './CourseSyncPanel';
const fixture = vi.hoisted(() => ({ rows: [], run: null, queued: false, error: null }));
vi.mock('@/config/env', () => ({ config: { isConfigured: true } }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async (name, args) => {
      if (name === 'list_course_sync_runs')
        return {
          data: {
            latest: fixture.run ? [{ ...fixture.run, source: 'um' }] : [],
            correlated: fixture.run ? [{ ...fixture.run, source: 'um' }] : [],
          },
          error: fixture.error,
        };
      if (name === 'set_course_sync_mode') {
        fixture.rows = fixture.rows.map((row) =>
          row.course_id === args.p_course_id ? { ...row, sync_mode: args.p_mode } : row
        );
        return { data: null, error: null };
      }
      return { data: { items: fixture.rows, total: fixture.rows.length }, error: fixture.error };
    },
    from: () => ({
      select: () => ({
        order: async () => ({ data: [{ source: 'um', name: 'Universiti Malaya' }], error: null }),
      }),
    }),
    functions: {
      invoke: async () => ({
        data: {
          data: {
            dispatched: true,
            source: 'um',
            request_id: 'queued-1',
            requested_at: new Date().toISOString(),
          },
        },
        error: null,
      }),
    },
  },
}));
beforeEach(() => {
  fixture.rows = [];
  fixture.run = null;
  fixture.error = null;
});
function show() {
  return render(
    <MemoryRouter>
      <CourseSyncPanel />
    </MemoryRouter>
  );
}
it('shows actual run counts and an incomplete source reason', async () => {
  fixture.run = {
    id: 'run-1',
    status: 'partial',
    found: 4,
    fetched: 3,
    inserted: 2,
    updated: 1,
    incomplete: 1,
    fetch_failed: 1,
    coverage_complete: false,
  };
  fixture.rows = [
    {
      id: 'source-1',
      canonical_url: 'https://study.um.edu.my/bachelor-example',
      candidate: { name: 'Bachelor Example' },
      outcome: 'incomplete',
      issues: ['missing_entry_requirements'],
    },
  ];
  show();
  expect(await screen.findByText('Bachelor Example')).toBeInTheDocument();
  expect(screen.getByText(/entry requirements were not found/i)).toBeInTheDocument();
  expect(screen.getByText('2 added')).toBeInTheDocument();
  expect(screen.getByText(/coverage is incomplete/i)).toBeInTheDocument();
});
it('reports a refresh as queued while the job has not run', async () => {
  show();
  await screen.findByText(/no university sync has run yet/i);
  fireEvent.click(screen.getByRole('button', { name: /refresh selected university/i }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/refresh queued/i));
});
it('lets an administrator explicitly resume a manually protected course', async () => {
  fixture.rows = [
    {
      id: 'source-1',
      course_id: 'course-1',
      course_name: 'Protected degree',
      canonical_url: 'https://study.um.edu.my/bachelor-example',
      outcome: 'protected_manual',
      sync_mode: 'manual',
      issues: [],
      last_success_at: '2026-10-10T00:00:00Z',
    },
  ];
  show();
  fireEvent.click(await screen.findByRole('button', { name: /resume automatic updates/i }));
  expect(
    await screen.findByRole('button', { name: /pause automatic updates/i })
  ).toBeInTheDocument();
});
it('keeps refresh available for a run whose lease has expired', async () => {
  fixture.run = { id: 'stale-run', status: 'running', started_at: '2000-01-01T00:00:00Z' };
  show();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /refresh selected university/i })).toBeEnabled()
  );
});
