import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import RiasecAssessment from './RiasecAssessment';

const fixture = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock('@/hooks/useRiasec', () => ({
  useRiasecQuestions: () => ({
    questions: [
      { id: 101, text: 'Build or repair things.' },
      { id: 102, text: 'Help people learn.' },
    ],
    scale: {
      min: 0,
      max: 4,
      labels: ['Strongly dislike', 'Dislike', 'Neutral', 'Like', 'Strongly like'],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  submitAssessment: fixture.submit,
}));
beforeEach(() => {
  fixture.submit.mockReset();
  fixture.submit.mockResolvedValue({ error: null });
});

function show() {
  render(
    <MemoryRouter initialEntries={['/find-your-path/assessment']}>
      <Routes>
        <Route path="/find-your-path/assessment" element={<RiasecAssessment />} />
        <Route path="/find-your-path/results" element={<h1>Assessment results</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

it('keeps auto-advance and submits the original numeric responses to scoring', async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole('button', { name: 'Start assessment' }));
  await user.click(screen.getByRole('radio', { name: 'Strongly like' }));
  await waitFor(() => expect(screen.getByText('Help people learn.')).toBeInTheDocument());
  await user.click(screen.getByRole('radio', { name: 'Dislike', exact: true }));
  await user.click(await screen.findByRole('button', { name: 'See my results' }));
  expect(fixture.submit).toHaveBeenCalledWith([
    { question_id: 101, value: 4 },
    { question_id: 102, value: 1 },
  ]);
  expect(await screen.findByRole('heading', { name: 'Assessment results' })).toBeInTheDocument();
});

it('does not add the reference Skip control or allow submission with unanswered items', async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole('button', { name: 'Start assessment' }));
  expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.click(screen.getByRole('button', { name: 'Review answers' }));
  expect(
    screen.getByRole('button', { name: /question 1: build or repair things/i })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /question 2: help people learn/i })
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'See my results' })).not.toBeInTheDocument();
  expect(fixture.submit).not.toHaveBeenCalled();
});
