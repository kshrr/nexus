import { expect, it } from 'vitest';
import { reconcileCourseRequests } from './courseSyncStatus';

const requested_at = '2026-10-15T00:00:00Z';
it('only a run with the same source and request ID settles a queued refresh', () => {
  const pending = { usim: { source: 'usim', request_id: 'wanted', requested_at } };
  const wrong = [
    { source: 'um', request_id: 'wanted', status: 'completed' },
    { source: 'usim', request_id: 'other', status: 'completed' },
  ];
  expect(reconcileCourseRequests(pending, wrong, Date.parse(requested_at))).toEqual(pending);
  expect(
    reconcileCourseRequests(
      pending,
      [{ source: 'usim', request_id: 'wanted', status: 'completed' }],
      Date.parse(requested_at)
    )
  ).toEqual({});
});
it('retains an expired request as a retry state after thirty minutes', () => {
  const pending = { um: { source: 'um', request_id: 'wanted', requested_at } };
  expect(
    reconcileCourseRequests(pending, [], Date.parse(requested_at) + 30 * 60 * 1000).um.status
  ).toBe('expired');
});
