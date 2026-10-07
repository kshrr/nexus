import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const h = vi.hoisted(() => ({ signOut: vi.fn(async () => {}) }));
vi.mock('@/context/useAuth', () => ({ useAuth: () => ({ signOut: h.signOut }) }));

import { SignOutButton } from './SignOutButton';

function setup() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/" element={<div>landing page</div>} />
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/dashboard" element={<SignOutButton />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.signOut.mockResolvedValue(undefined);
});

describe('SignOutButton (architecture.md §5.5)', () => {
  it('ends the session and returns the user to the landing page', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('landing page')).toBeInTheDocument();
  });

  it('does not dump the user back on the sign-in form', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(await screen.findByText('landing page')).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });

  it('still leaves the protected area if the sign-out call fails', async () => {
    h.signOut.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /sign out/i })).catch(() => {});
    expect(await screen.findByText('landing page')).toBeInTheDocument();
  });

  it('is a real button, so it is keyboard reachable', async () => {
    const user = userEvent.setup();
    setup();
    await user.tab();
    expect(screen.getByRole('button', { name: /sign out/i })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(h.signOut).toHaveBeenCalled();
  });
});
