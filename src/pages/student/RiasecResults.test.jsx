import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import RiasecResults from './RiasecResults';

const data = vi.hoisted(() => ({ result: null, blocks: [] }));
vi.mock('@/context/useAuth', () => ({ useAuth: () => ({ profile: { education_level: 'spm' } }) }));
vi.mock('@/hooks/useRiasec', async (original) => ({
  ...(await original()),
  useRiasecResult: () => ({ result: data.result, loading: false, error: null }),
  useInterpretation: () => ({ blocks: data.blocks, loading: false }),
}));
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 640,
    height: 320,
    top: 0,
    left: 0,
    bottom: 320,
    right: 640,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  data.result = {
    holland_code: 'IAS',
    completed_at: '2026-10-11T00:00:00Z',
    realistic_score: 5,
    investigative_score: 22,
    artistic_score: 20,
    social_score: 18,
    enterprising_score: 10,
    conventional_score: 12,
  };
  data.blocks = [
    {
      letter: 'I',
      name: 'Investigative',
      summary: 'Explore how things work.',
      traits: 'Curious; Analytical',
      career_fields: 'Research; Computing',
      academic_areas: 'Science; Mathematics',
    },
    {
      letter: 'A',
      name: 'Artistic',
      summary: 'Express original ideas.',
      traits: 'Creative; Expressive',
      career_fields: 'Design; Media',
      academic_areas: 'Visual arts; Literature',
    },
    {
      letter: 'S',
      name: 'Social',
      summary: 'Help people learn.',
      traits: 'Supportive; Cooperative',
      career_fields: 'Teaching; Community services',
      academic_areas: 'Education; Social sciences',
    },
  ];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const show = () =>
  render(
    <MemoryRouter>
      <RiasecResults />
    </MemoryRouter>
  );

it('shows all three interpretation sections together and updates them when a card is selected', () => {
  show();
  const initial = screen.getByRole('region', { name: 'Investigative interpretation' });
  expect(within(initial).getByText('Analytical')).toBeVisible();
  expect(within(initial).getByText('Research')).toBeVisible();
  expect(within(initial).getByText('Mathematics')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Artistic/i }));
  const panel = screen.getByRole('region', { name: 'Artistic interpretation' });
  expect(within(panel).getByText('Creative')).toBeVisible();
  expect(within(panel).queryByText('Analytical')).not.toBeInTheDocument();
  expect(within(panel).getByText('Design')).toBeVisible();
  expect(within(panel).getByText('Literature')).toBeVisible();
  for (const label of ['Traits', 'Career fields', 'Study areas']) {
    expect(within(panel).getByRole('heading', { name: label })).toBeVisible();
  }
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Artistic/i })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: /Investigative/i })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
});
it('renders the radar graph immediately alongside all six numeric scores', () => {
  show();
  const graph = screen.getByRole('region', { name: 'Your profile map' });
  expect(graph.querySelector('svg')).toBeInTheDocument();
  expect(graph.closest('details')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Social/i }));
  expect(screen.getByText('22 / 24')).toBeInTheDocument();
  expect(screen.getByText('5 / 24')).toBeInTheDocument();
  expect(screen.getAllByText(/\/ 24$/)).toHaveLength(6);
  expect(graph).toBeVisible();
});
it('lets keyboard users select a personality card without navigating detail tabs', async () => {
  const user = userEvent.setup();
  show();
  const card = screen.getByRole('button', { name: /Social/i });
  card.focus();
  await user.keyboard('[Enter]');
  expect(card).toHaveAttribute('aria-pressed', 'true');
  expect(card).toHaveFocus();
  expect(screen.getByRole('region', { name: 'Social interpretation' })).toHaveTextContent(
    'Community services'
  );
});
it('connects each card to the interpretation it controls', () => {
  show();
  for (const name of ['Investigative', 'Artistic', 'Social']) {
    const card = screen.getByRole('button', { name: new RegExp(name, 'i') });
    expect(document.getElementById(card.getAttribute('aria-controls'))).toBe(
      screen.getByRole('region', { name: 'Investigative interpretation' })
    );
  }
});

it.each([
  ['R', 'Realistic', 'realistic'],
  ['I', 'Investigative', 'investigative'],
  ['A', 'Artistic', 'artistic'],
  ['S', 'Social', 'social'],
  ['E', 'Enterprising', 'enterprising'],
  ['C', 'Conventional', 'conventional'],
])('uses the supplied %s portrait for the matching personality card', (letter, name, file) => {
  data.blocks = [
    {
      letter,
      name,
      summary: 'Example summary.',
      traits: '',
      career_fields: '',
      academic_areas: '',
    },
  ];
  show();
  const image = screen.getByRole('button', { name: new RegExp(name, 'i') }).querySelector('img');
  expect(image).toHaveAttribute('src', expect.stringContaining(`/riasec/${file}.png`));
  expect(image).toHaveAttribute('alt', '');
});

it('keeps the score graphs visible when interpretation data is unavailable', () => {
  data.blocks = [];
  show();
  expect(
    screen.getByRole('region', { name: 'Your profile map' }).querySelector('svg')
  ).toBeInTheDocument();
  expect(screen.getAllByText(/\/ 24$/)).toHaveLength(6);
  expect(screen.getByText(/Detailed interpretations are unavailable/)).toBeVisible();
});
