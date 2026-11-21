import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { expect, it, vi } from 'vitest';

vi.mock('@/context/useAuth', () => ({
  useAuth: () => ({ loading: false, isAuthenticated: false, profile: null, role: null }),
}));
vi.mock('@/components/layout/PublicLayout', () => ({
  PublicLayout: () => <Outlet />,
}));
vi.mock('@/pages/student/Careers', () => ({
  default: () => <h1>Public careers</h1>,
}));
vi.mock('@/pages/student/CareerDetail', () => ({
  default: () => <h1>Public career detail</h1>,
}));

import AppRoutes from './routes';

it.each([
  ['/careers', 'Public careers'],
  ['/careers/software-engineer', 'Public career detail'],
])('lets an anonymous visitor open %s', (path, heading) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
  expect(screen.getByRole('heading', { name: heading })).toBeVisible();
});
