import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ auth: { isAuthenticated: false } }));

vi.mock('@/context/useAuth', () => ({ useAuth: () => h.auth }));
vi.mock('./ChatPanel', () => ({ ChatPanel: () => <div role="dialog" aria-label="Nexus advisor" /> }));

import { ChatLauncher } from './ChatLauncher';

const show = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ChatLauncher />
    </MemoryRouter>
  );

beforeEach(() => {
  h.auth = { isAuthenticated: false };
  sessionStorage.clear();
});

describe('ChatLauncher', () => {
  it('is available to visitors who are not signed in', () => {
    show();
    expect(screen.getByRole('button', { name: /open nexus advisor/i })).toBeInTheDocument();
  });

  it('reopens the advisor after sign-in when a question is waiting', async () => {
    h.auth = { isAuthenticated: true };
    sessionStorage.setItem('nexus.chat.pendingQuestion', 'Which course suits me?');
    show('/scholarships');
    expect(await screen.findByRole('dialog', { name: 'Nexus advisor' })).toBeInTheDocument();
  });

  it('does not interrupt profile setup with the waiting question', () => {
    h.auth = { isAuthenticated: true };
    sessionStorage.setItem('nexus.chat.pendingQuestion', 'Which course suits me?');
    show('/profile-setup');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open nexus advisor/i })).toBeInTheDocument();
  });
});
