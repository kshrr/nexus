export const COURSE_LEASE_MS = 30 * 60 * 1000;

export function reconcileCourseRequests(previous, correlatedRuns, nowMs) {
  const next = {};
  for (const [source, request] of Object.entries(previous)) {
    const run = correlatedRuns.find(
      (row) => row.source === source && row.request_id === request.request_id
    );
    if (run && run.status !== 'running') continue;
    const expired = nowMs - Date.parse(request.requested_at) >= COURSE_LEASE_MS;
    next[source] = expired ? { ...request, status: 'expired' } : request;
  }
  return next;
}
