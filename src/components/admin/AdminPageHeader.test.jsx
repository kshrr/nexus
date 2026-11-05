import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AdminPageHeader } from './AdminPageHeader';

it('groups the page title, context and unchanged action in the admin banner', () => {
  const onClick = vi.fn();
  render(
    <AdminPageHeader
      title="Catalogue"
      description="Manage existing records."
      actions={<button onClick={onClick}>New record</button>}
    />
  );
  const heading = screen.getByRole('heading', { level: 1, name: 'Catalogue' });
  const banner = heading.closest('header');
  expect(banner).not.toBeNull();
  expect(within(banner).getByText('Manage existing records.')).toBeVisible();
  fireEvent.click(within(banner).getByRole('button', { name: 'New record' }));
  expect(onClick).toHaveBeenCalledOnce();
});
