import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { QuestionCard } from './QuestionCard';

const labels = ['Strongly dislike', 'Dislike', 'Neutral', 'Like', 'Strongly like'];
const question = { id: 101, text: 'Build or repair things.' };

function Selector({ item = question }) {
  const [value, setValue] = useState(null);
  return (
    <>
      <QuestionCard
        question={item}
        labels={labels}
        value={value}
        onChange={setValue}
        index={0}
        total={36}
      />
      <output aria-label="Selected response">{value}</output>
    </>
  );
}

describe('Interest response selector', () => {
  it('names the response group with the question', () => {
    render(<Selector />);
    expect(
      screen.getByRole('group', { name: /question 1 of 36.*build or repair things/i })
    ).toBeInTheDocument();
  });

  it('gives every response tile a decorative face without changing its accessible label', () => {
    render(<Selector />);
    for (const label of labels) {
      const radio = screen.getByRole('radio', { name: label });
      expect(radio.closest('label').querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('keeps the five labels mapped to numeric values 0 through 4 with one selected response', async () => {
    const user = userEvent.setup();
    render(<Selector />);
    for (const [label, expected] of [
      ['Strongly dislike', '0'],
      ['Neutral', '2'],
      ['Strongly like', '4'],
    ]) {
      await user.click(screen.getByRole('radio', { name: label }));
      expect(screen.getByLabelText('Selected response')).toHaveTextContent(expected);
      expect(screen.getAllByRole('radio').filter((radio) => radio.checked)).toHaveLength(1);
      expect(screen.getByRole('radio', { name: label })).toBeChecked();
    }
  });

  it('supports keyboard selection through the native radio group', async () => {
    const user = userEvent.setup();
    render(<Selector />);
    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByRole('radio', { name: 'Strongly dislike' })).toBeChecked();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Dislike' })).toBeChecked();
    expect(screen.getByLabelText('Selected response')).toHaveTextContent('1');
  });

  it('shows an unanswered warning without preselecting a response', () => {
    render(
      <QuestionCard
        question={question}
        labels={labels}
        value={null}
        onChange={() => {}}
        index={0}
        total={36}
        highlight
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('still needs an answer');
    expect(screen.getAllByRole('radio').some((radio) => radio.checked)).toBe(false);
  });
});
