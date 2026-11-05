import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import { PublicHeader } from './PublicHeader';
import { Footer } from './Footer';
vi.mock('@/context/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
it('sends Search and footer Courses links to the published catalogue', () => {
  render(
    <MemoryRouter>
      <PublicHeader />
      <Footer />
    </MemoryRouter>
  );
  for (const link of screen.getAllByRole('link', { name: 'Courses' }))
    expect(link).toHaveAttribute('href', '/courses');
});
