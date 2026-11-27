import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Breadcrumbs, BreadcrumbProvider } from './Breadcrumbs';
import { useBreadcrumbLabel } from './breadcrumbContext';
import { buildTrail } from './breadcrumbTrail';

function Named({ label }) {
  useBreadcrumbLabel(label);
  return null;
}

function show(path, label) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <BreadcrumbProvider>
        <Breadcrumbs />
        {label && <Named label={label} />}
      </BreadcrumbProvider>
    </MemoryRouter>
  );
  return screen.queryByRole('navigation', { name: 'Breadcrumb' });
}

describe('breadcrumbs', () => {
  it('shows nothing on the landing page', () => {
    expect(show('/')).toBeNull();
  });

  it('links every parent and marks the current page', () => {
    const nav = show('/find-your-path/assessment');
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'Find Your Path' })).toHaveAttribute(
      'href',
      '/find-your-path'
    );
    expect(within(nav).getByText('Interest assessment')).toHaveAttribute('aria-current', 'page');
  });

  it('uses the name a detail page gives itself', () => {
    const nav = show('/courses/abc', 'Bachelor of Medicine');
    expect(within(nav).getByRole('link', { name: 'Courses' })).toHaveAttribute('href', '/courses');
    expect(within(nav).getByText('Bachelor of Medicine')).toHaveAttribute('aria-current', 'page');
  });

  it('files recommendations under Find Your Path and admin pages under Admin', () => {
    expect(buildTrail('/recommendations').map((item) => item.label)).toEqual([
      'Home',
      'Find Your Path',
      'Recommendations',
    ]);
    expect(buildTrail('/admin/audit').map((item) => item.label)).toEqual([
      'Home',
      'Admin',
      'Audit log',
    ]);
  });
});
