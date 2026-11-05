import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const auth = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  resendOtp: vi.fn(),
  isAuthenticated: false,
  loading: false,
}));
vi.mock('@/context/useAuth', () => ({ useAuth: () => auth }));

import Verify from './Verify';

function setup(email = 'student@example.com') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/verify', state: email ? { email } : null }]}>
      <Routes>
        <Route path="/verify" element={<Verify />} />
        <Route path="/profile-setup" element={<h1>Set up your profile</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  auth.verifyOtp.mockReset().mockResolvedValue({ error: null });
  auth.resendOtp.mockReset().mockResolvedValue({ error: null });
  auth.isAuthenticated = false;
  auth.loading = false;
});

describe('Signup verification by code or email link', () => {
  it('verifies the emailed code and continues to profile setup', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/verification code/i), '123456');
    await user.click(screen.getByRole('button', { name: /verify and continue/i }));
    expect(auth.verifyOtp).toHaveBeenCalledWith('student@example.com', '123456');
    expect(await screen.findByRole('heading', { name: 'Set up your profile' })).toBeInTheDocument();
  });

  it('continues when the confirmation link has established a session', async () => {
    auth.isAuthenticated = true;
    setup('');
    expect(await screen.findByRole('heading', { name: 'Set up your profile' })).toBeInTheDocument();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('allows entering the registration email when opened without navigation state', async () => {
    const user = userEvent.setup();
    setup('');
    await user.type(screen.getByLabelText(/^email/i), 'student@example.com');
    await user.type(screen.getByLabelText(/verification code/i), '123456');
    await user.click(screen.getByRole('button', { name: /verify and continue/i }));
    expect(auth.verifyOtp).toHaveBeenCalledWith('student@example.com', '123456');
    expect(await screen.findByRole('heading', { name: 'Set up your profile' })).toBeInTheDocument();
  });

  it('shows a resend failure and permits retry instead of claiming an email was sent', async () => {
    auth.resendOtp.mockResolvedValueOnce({
      error: { message: 'Please wait before requesting another email.' },
    });
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /resend code/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please wait');
    expect(screen.queryByText(/new code sent/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /resend code/i }));
    expect(await screen.findByText(/new code sent/i)).toBeInTheDocument();
  });

  it('lets a user resend again if a newly issued code has expired', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /resend code/i }));
    auth.verifyOtp.mockResolvedValueOnce({ error: { message: 'Token expired' } });
    await user.type(screen.getByLabelText(/verification code/i), '123456');
    await user.click(screen.getByRole('button', { name: /verify and continue/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/expired/i);
    await user.click(screen.getByRole('button', { name: /resend code/i }));
    expect(auth.resendOtp).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/new code sent/i)).toBeInTheDocument();
  });
});
