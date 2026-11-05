import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CourseSyncStatus } from './CourseSyncStatus';

it('shows a later dispatch error separately while the accepted refresh stays queued', () => {
  render(<CourseSyncStatus source={{source:'um',name:'Universiti Malaya'}} request={{
    request_id:'accepted', requested_at:new Date().toISOString(),
    last_dispatch_error:{message:'Already running'},
  }} />);
  expect(screen.getByText('Refresh queued')).toBeInTheDocument();
  expect(screen.getByText(/Already running/)).toBeInTheDocument();
});

it('labels a completed crawl with incomplete records as needing attention', () => {
  render(<CourseSyncStatus source={{source:'unimap',name:'Universiti Malaysia Perlis'}} run={{
    status:'completed', found:50, inserted:0, updated:0, incomplete:50, fetch_failed:0,
  }} />);
  expect(screen.getByText('Completed with attention')).toBeInTheDocument();
  expect(screen.getByText(/50 need attention/)).toBeInTheDocument();
});
