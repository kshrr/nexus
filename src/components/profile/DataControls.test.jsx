import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  profile: { role: 'student' },
  signOut: vi.fn(async () => {}),
  collectMyData: vi.fn(async () => ({ data: { account: { id: 'u1' } }, error: null })),
  downloadJson: vi.fn(),
  deleteMyAccount: vi.fn(async () => ({ error: null })),
}));
vi.mock('@/context/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'a@test.nexus' },
    profile: h.profile,
    signOut: h.signOut,
  }),
}));
vi.mock('@/lib/accountData', () => ({
  collectMyData: h.collectMyData,
  downloadJson: h.downloadJson,
  deleteMyAccount: h.deleteMyAccount,
}));

import { DataControls } from './DataControls';

const show = () =>
  render(
    <MemoryRouter>
      <DataControls />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  h.profile = { role: 'student' };
  h.deleteMyAccount.mockResolvedValue({ error: null });
  h.collectMyData.mockResolvedValue({ data: { account: { id: 'u1' } }, error: null });
});

describe('DataControls', () => {
  it('downloads a copy of the student’s data as a file', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: /download my data/i }));
    await waitFor(() => expect(h.downloadJson).toHaveBeenCalled());
    expect(h.downloadJson.mock.calls[0][0]).toMatch(/^nexus-my-data-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('says so when the data cannot be collected, and downloads nothing', async () => {
    h.collectMyData.mockResolvedValue({ data: null, error: { message: 'x' } });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: /download my data/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t collect/i);
    expect(h.downloadJson).not.toHaveBeenCalled();
  });

  it('only deletes after the student types DELETE', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: /^delete my account$/i }));
    const confirm = screen.getByRole('button', { name: /permanently delete my account/i });
    expect(confirm).toBeDisabled();
    const field = screen.getByLabelText(/type delete to confirm/i);
    await user.type(field, 'delete');
    expect(confirm).toBeDisabled();
    await user.clear(field);
    await user.type(field, 'DELETE');
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => expect(h.deleteMyAccount).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(h.signOut).toHaveBeenCalled());
  });

  it('keeps the account and explains when deletion fails', async () => {
    h.deleteMyAccount.mockResolvedValue({ error: { message: 'x' } });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: /^delete my account$/i }));
    await user.type(screen.getByLabelText(/type delete to confirm/i), 'DELETE');
    await user.click(screen.getByRole('button', { name: /permanently delete my account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/nothing was removed/i);
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('does not offer deletion to admins', () => {
    h.profile = { role: 'admin' };
    show();
    expect(screen.queryByRole('button', { name: /delete my account/i })).not.toBeInTheDocument();
    expect(screen.getByText(/admin accounts can’t be deleted/i)).toBeInTheDocument();
  });
});
