import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, it, expect, vi } from 'vitest';
import { AppShell } from './AppShell';
import { AdminShell } from './AdminShell';
import { PublicLayout } from './PublicLayout';
import NotFound from '@/pages/public/NotFound';
const fixture = vi.hoisted(() => ({ role: 'student', isAuthenticated: true, signOut: vi.fn() }));
vi.mock('@/context/useAuth', () => ({
  useAuth: () => ({ ...fixture, user: { email: 'preview@nexus.test' } }),
}));
// Keep the layout real; chat network/activity is unrelated to shared chrome.
vi.mock('@/components/chat/ChatLauncher', () => ({ ChatLauncher: () => null }));
beforeEach(() => {
  fixture.role = 'student';
  fixture.isAuthenticated = true;
});
function show(Shell, path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Shell />}>
          <Route path={path} element={<h1>Page content</h1>} />
          <Route path="*" element={<h1>Destination content</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
it('gives student pages shared chrome without a sidebar and keeps account links in the header', () => {
  show(AppShell, '/dashboard');
  const header = screen.getByRole('banner');
  expect(within(header).getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  expect(within(header).getAllByRole('button', { name: 'Sign out' }).length).toBeGreaterThan(0);
  expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(within(header).queryByText('My journey')).not.toBeInTheDocument();
  const actions = within(header).getByRole('group', { name: 'Account actions' });
  expect(within(actions).getByRole('link', { name: 'Profile' })).toHaveAttribute(
    'href',
    '/profile'
  );
  expect(within(actions).getByRole('link', { name: 'Saved' })).toHaveAttribute('href', '/saved');
  const controls = [...actions.querySelectorAll('a, button')];
  expect(
    controls.map((element) => element.getAttribute('aria-label') || element.textContent)
  ).toEqual(['Saved', 'Profile', 'Sign out']);
  const primary = within(header).getByRole('navigation', { name: 'Primary' });
  expect(within(primary).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
    'href',
    '/dashboard'
  );
  expect(within(header).getAllByRole('link', { name: 'Dashboard' })).toHaveLength(1);
});
it('moves admin navigation into the header without a sidebar', () => {
  fixture.role = 'admin';
  show(AdminShell, '/admin');
  for (const link of within(screen.getByRole('banner')).getAllByRole('link', {
    name: /admin workspace/i,
  }))
    expect(link).toHaveAttribute('href', '/admin');
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  const menu = within(screen.getByRole('banner')).getByText('Workspace').closest('details');
  menu.open = true;
  expect(within(menu).getByRole('link', { name: 'Scholarship discovery' })).toHaveAttribute(
    'href',
    '/admin/scholarship-discovery'
  );
  expect(within(menu).getByRole('link', { name: 'Data management' })).toHaveAttribute(
    'href',
    '/admin/courses'
  );
  expect(within(menu).getByRole('link', { name: 'Audit log' })).toHaveAttribute(
    'href',
    '/admin/audit'
  );
  expect(within(screen.getByRole('banner')).queryByText('My journey')).not.toBeInTheDocument();
  expect(screen.getByRole('contentinfo')).toBeInTheDocument();
});
it('keeps anonymous public navigation and uses the same footer contents', () => {
  fixture.isAuthenticated = false;
  show(PublicLayout, '/privacy');
  expect(
    within(screen.getByRole('banner')).getAllByRole('link', { name: 'Sign up' }).length
  ).toBeGreaterThan(0);
  expect(
    within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Courses' })
  ).toHaveAttribute('href', '/courses');
  expect(screen.queryByText('My journey')).not.toBeInTheDocument();
  expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
});
it('closes mobile navigation when an account icon navigates to its destination', () => {
  show(AppShell, '/dashboard');
  const header = screen.getByRole('banner');
  fireEvent.click(within(header).getByRole('button', { name: 'Open navigation' }));
  const toggle = within(header).getByRole('button', { name: 'Close navigation' });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(
    within(within(header).getByRole('group', { name: 'Account actions' })).getByRole('link', {
      name: 'Profile',
    })
  );
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('heading', { name: 'Destination content' })).toBeInTheDocument();
});
it('gives standalone not-found pages the shared header and footer', () => {
  fixture.isAuthenticated = false;
  render(
    <MemoryRouter>
      <NotFound />
    </MemoryRouter>
  );
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'We can’t find that page' })).toBeInTheDocument();
});
