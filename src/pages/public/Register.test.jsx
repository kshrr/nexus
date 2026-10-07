import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const signUp = vi.fn(async () => ({ error: null }));
vi.mock('@/context/useAuth', () => ({ useAuth: () => ({ signUp }) }));

import Register from './Register';

function setup() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<div>verify page</div>} />
        <Route path="/privacy" element={<div>privacy</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('Register (FR01)', () => {
  it('blocks an empty submission and does not call signUp', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(signUp).not.toHaveBeenCalled();
    expect(await screen.findByText(/enter your full name/i)).toBeInTheDocument();
  });

  it('rejects a weak password', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/full name/i), 'Kauthar');
    await user.type(screen.getByLabelText(/email/i), 'k@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'short');
    await user.click(screen.getByLabelText(/privacy notice/i));
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(signUp).not.toHaveBeenCalled();
    // the inline field error (distinct from the requirements checklist item)
    expect(await screen.findByText(/use at least 8 characters/i)).toBeInTheDocument();
  });

  it('requires consent before an account can be created (FR-SEC-10)', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/full name/i), 'Kauthar');
    await user.type(screen.getByLabelText(/email/i), 'k@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'nexus2026');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(signUp).not.toHaveBeenCalled();
    expect(await screen.findByText(/you need to agree/i)).toBeInTheDocument();
  });

  it('submits a valid registration with a consent version and routes to /verify', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/full name/i), 'Kauthar Mohd Suhair');
    await user.type(screen.getByLabelText(/email/i), 'kauthar@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'nexus2026');
    await user.click(screen.getByLabelText(/privacy notice/i));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(signUp).toHaveBeenCalledTimes(1);
    const payload = signUp.mock.calls[0][0];
    expect(payload).toMatchObject({
      email: 'kauthar@example.com',
      password: 'nexus2026',
      fullName: 'Kauthar Mohd Suhair',
    });
    expect(payload.consentVersion).toBeTruthy();
    expect(await screen.findByText('verify page')).toBeInTheDocument();
  });

  it('shows the duplicate-email message from the report wording', async () => {
    signUp.mockResolvedValueOnce({ error: { message: 'User already registered', code: '422' } });
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/full name/i), 'Kauthar');
    await user.type(screen.getByLabelText(/email/i), 'dupe@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'nexus2026');
    await user.click(screen.getByLabelText(/privacy notice/i));
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(
      await screen.findByText(/an account with this email already exists/i)
    ).toBeInTheDocument();
  });
});
