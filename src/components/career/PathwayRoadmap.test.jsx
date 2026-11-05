import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PathwayRoadmap } from './PathwayRoadmap';
import { reviewedStage } from '@/test/fixtures/careerEvidence';
it('shows all six focus points and does not label a future plan completed', () => {
  render(
    <PathwayRoadmap
      stages={[
        {
          id: 'one',
          stage_order: 1,
          stage_title: 'Check admission',
          stage_description: 'Compare actual criteria',
          focus_points: ['Point 1', 'Point 2', 'Point 3', 'Point 4', 'Point 5', 'Point 6'],
          content_review: reviewedStage({ kind: 'nexus_planning' }),
        },
      ]}
    />
  );
  for (let n = 1; n <= 6; n++) expect(screen.getByText('Point ' + n)).toBeVisible();
  expect(screen.getByText('Nexus planning suggestion')).toBeVisible();
  expect(screen.queryByText(/completed/i)).not.toBeInTheDocument();
});
it('does not publish an unreviewed milestone as a professional requirement', () => {
  render(
    <PathwayRoadmap
      stages={[
        {
          id: 'pending',
          stage_order: 1,
          stage_title: 'Guaranteed licence',
          stage_description: 'Automatically eligible',
          focus_points: ['Unsafe promise'],
          content_review: { status: 'pending' },
        },
      ]}
    />
  );
  expect(screen.queryByText('Guaranteed licence')).not.toBeInTheDocument();
  expect(screen.getByText(/Stage guidance awaiting review/)).toBeVisible();
});
