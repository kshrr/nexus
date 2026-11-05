import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { RailRecommendationCard } from './RailRecommendationCard';
import { reviewedCareer } from '@/test/fixtures/careerEvidence';
it('names the actual exploratory reference without a compatibility percentage', () => {
  const detail = reviewedCareer();
  render(
    <MemoryRouter>
      <RailRecommendationCard
        type="career"
        rank={1}
        secondary
        recommendation={{
          detail,
          shared_letters: ['I', 'C'],
          matched_reference: detail.reference_occupations[0],
        }}
      />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByText(/Why this interest/i));
  expect(screen.getByText(/Software Developers/)).toBeVisible();
  expect(screen.getByText(/Nexus.*heuristic/i)).toBeVisible();
  expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
});
it('does not present a pending cached description or code as sourced', () => {
  const detail = reviewedCareer();
  detail.content_review.status = 'pending';
  detail.description = 'Unsupported legacy promise';
  detail.riasec_profile = 'IRC';
  render(
    <MemoryRouter>
      <RailRecommendationCard
        type="career"
        rank={1}
        recommendation={{ detail, rule_id: 'test', match_score: 80, reasons: [] }}
      />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByText('Why this match'));
  expect(screen.queryByText('Unsupported legacy promise')).not.toBeInTheDocument();
  expect(screen.queryByText(/IRC/)).not.toBeInTheDocument();
});
