import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { CourseSyncPanel } from './CourseSyncPanel';
const fixture = vi.hoisted(() => ({
  refresh: vi.fn(async () => ({ data: {}, error: null })),
  options: [],
}));
vi.mock('@/hooks/useCourseSync', () => ({
  useCourseSync: () => ({
    items: [],
    total: 0,
    loading: false,
    error: null,
    busy: false,
    lastRun: null,
    sourceChoices: [
      { source: 'um', name: 'Universiti Malaya' },
      { source: 'unimap', name: 'Universiti Malaysia Perlis' },
      { source: 'usim', name: 'Universiti Sains Islam Malaysia' },
    ],
    runsBySource: {},
    requestsBySource: {},
    refresh: fixture.refresh,
    reload: vi.fn(),
  }),
}));
it('lets admin select USIM or refresh all supported universities', async () => {
  render(
    <MemoryRouter>
      <CourseSyncPanel />
    </MemoryRouter>
  );
  fireEvent.change(screen.getByLabelText('University'), { target: { value: 'usim' } });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh selected university' }));
  expect(fixture.refresh).toHaveBeenCalledWith('usim');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh all supported universities' }));
  expect(fixture.refresh).toHaveBeenCalledWith('all');
});
