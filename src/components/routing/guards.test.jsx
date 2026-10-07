import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute, ProfileGate, AdminRoute } from './guards';

const mockUseAuth = vi.fn();
vi.mock('@/context/useAuth', () => ({ useAuth: () => mockUseAuth() }));

const LOADING = { loading: true, isAuthenticated: false, profile: null, role: null };
const ANON = { loading: false, isAuthenticated: false, profile: null, role: null };
const STUDENT_INCOMPLETE = {
  loading: false,
  isAuthenticated: true,
  profile: { profile_completed: false },
  role: 'student',
};
const STUDENT_COMPLETE = {
  loading: false,
  isAuthenticated: true,
  profile: { profile_completed: true },
  role: 'student',
};
const ADMIN = {
  loading: false,
  isAuthenticated: true,
  profile: { profile_completed: true },
  role: 'admin',
};

function renderAt(path, ui) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/dashboard" element={<div>dashboard page</div>} />
        <Route path="/profile-setup" element={<div>setup page</div>} />
        <Route path="/secret" element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => mockUseAuth.mockReset());

describe('ProtectedRoute — requires a session (architecture.md §5.6)', () => {
  it('redirects an anonymous user to /login', () => {
    mockUseAuth.mockReturnValue(ANON);
    renderAt(
      '/secret',
      <ProtectedRoute>
        <div>protected content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders children for an authenticated user', () => {
    mockUseAuth.mockReturnValue(STUDENT_COMPLETE);
    renderAt(
      '/secret',
      <ProtectedRoute>
        <div>protected content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('shows a spinner while the session is still resolving', () => {
    mockUseAuth.mockReturnValue(LOADING);
    renderAt(
      '/secret',
      <ProtectedRoute>
        <div>protected content</div>
      </ProtectedRoute>
    );
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('PublicOnlyRoute — keeps signed-in users off /login and /register', () => {
  it('redirects an authenticated user to /dashboard', () => {
    mockUseAuth.mockReturnValue(STUDENT_COMPLETE);
    renderAt(
      '/secret',
      <PublicOnlyRoute>
        <div>login form</div>
      </PublicOnlyRoute>
    );
    expect(screen.getByText('dashboard page')).toBeInTheDocument();
  });
  it('renders the form for an anonymous user', () => {
    mockUseAuth.mockReturnValue(ANON);
    renderAt(
      '/secret',
      <PublicOnlyRoute>
        <div>login form</div>
      </PublicOnlyRoute>
    );
    expect(screen.getByText('login form')).toBeInTheDocument();
  });
});

describe('ProfileGate — requires a completed profile', () => {
  it('redirects to /profile-setup when the profile is incomplete', () => {
    mockUseAuth.mockReturnValue(STUDENT_INCOMPLETE);
    renderAt(
      '/secret',
      <ProfileGate>
        <div>dashboard content</div>
      </ProfileGate>
    );
    expect(screen.getByText('setup page')).toBeInTheDocument();
  });
  it('renders children when the profile is complete', () => {
    mockUseAuth.mockReturnValue(STUDENT_COMPLETE);
    renderAt(
      '/secret',
      <ProfileGate>
        <div>dashboard content</div>
      </ProfileGate>
    );
    expect(screen.getByText('dashboard content')).toBeInTheDocument();
  });
});

describe('AdminRoute — requires role = admin, returns 404 (not 403)', () => {
  it('shows the 404 page to a non-admin instead of confirming the area exists', () => {
    mockUseAuth.mockReturnValue(STUDENT_COMPLETE);
    renderAt(
      '/secret',
      <AdminRoute>
        <div>admin panel</div>
      </AdminRoute>
    );
    expect(screen.getByText(/404/i)).toBeInTheDocument();
    expect(screen.queryByText('admin panel')).not.toBeInTheDocument();
  });
  it('shows the 404 page to an anonymous visitor', () => {
    mockUseAuth.mockReturnValue(ANON);
    renderAt(
      '/secret',
      <AdminRoute>
        <div>admin panel</div>
      </AdminRoute>
    );
    expect(screen.getByText(/404/i)).toBeInTheDocument();
  });
  it('renders children for an admin', () => {
    mockUseAuth.mockReturnValue(ADMIN);
    renderAt(
      '/secret',
      <AdminRoute>
        <div>admin panel</div>
      </AdminRoute>
    );
    expect(screen.getByText('admin panel')).toBeInTheDocument();
  });
});
