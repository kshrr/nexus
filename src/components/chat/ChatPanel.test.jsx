import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  chat: {
    messages: [],
    loadingHistory: false,
    streaming: false,
    error: null,
    send: vi.fn(),
    stop: vi.fn(),
    clearError: vi.fn(),
    hasHistory: false,
  },
  summary: {
    firstName: 'Kauthar',
    educationLevel: 'spm',
    careerGoal: 'Pharmacist',
    hollandCode: 'ISA',
    strengths: ['Biology', 'Mathematics'],
    recommendationCount: 5,
    savedCount: 3,
  },
}));

vi.mock('@/hooks/useChat', () => ({
  useChat: () => h.chat,
  useChatContextSummary: () => ({ summary: h.summary, loading: false }),
}));
vi.mock('@/context/useAuth', () => ({
  useAuth: () => ({ profile: { full_name: 'Kauthar binti Mohd Suhair' }, isAuthenticated: true }),
}));

import { ChatPanel } from './ChatPanel';
import { MessageBubble } from './MessageList';

const open = () =>
  render(
    <MemoryRouter>
      <ChatPanel open onClose={() => {}} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.chat, {
    messages: [],
    loadingHistory: false,
    streaming: false,
    error: null,
    hasHistory: false,
  });
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe('ChatPanel — AI disclosure (ui-spec §8.8)', () => {
  it('shows the permanent header disclosure, which cannot be dismissed', () => {
    open();
    expect(screen.getByText('AI assistant · can make mistakes')).toBeInTheDocument();
  });

  it('shows the fuller first-session notice, once', async () => {
    const user = userEvent.setup();
    open();
    expect(screen.getByText(/It can be wrong/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByText(/It can be wrong/i)).not.toBeInTheDocument();
  });

  it('tells the student it will defer to stored records for scholarship facts', () => {
    open();
    expect(screen.getByText(/rather than answer from memory/i)).toBeInTheDocument();
  });
});

describe('ChatPanel — context transparency (ui-spec §8.4)', () => {
  it('is collapsed by default and lists exactly what is sent when opened', async () => {
    const user = userEvent.setup();
    open();
    expect(screen.queryByText(/Holland Code ISA/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /what i know about you/i }));
    expect(screen.getByText(/Holland Code ISA/)).toBeInTheDocument();
    expect(screen.getByText(/Strong in Biology, Mathematics/)).toBeInTheDocument();
    expect(
      screen.getByText(/email, full name and individual grades never are/i)
    ).toBeInTheDocument();
  });
});

describe('ChatPanel — sending', () => {
  it('sends a normal question', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText(/ask a question/i), 'What does ISA mean?');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(h.chat.send).toHaveBeenCalledWith('What does ISA mean?');
  });

  it('will not send an empty question', async () => {
    const user = userEvent.setup();
    open();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/ask a question/i), '   ');
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    expect(h.chat.send).not.toHaveBeenCalled();
  });

  it('blocks an excessively long question and says by how much', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByLabelText(/ask a question/i));
    await user.paste('a'.repeat(1005));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/5 too many/);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('offers state-derived suggestions to a new conversation', () => {
    open();
    expect(screen.getByText('Try asking:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /what does my ISA code mean/i })).toBeInTheDocument();
  });

  it('swaps Send for Stop while a reply is streaming', () => {
    h.chat.streaming = true;
    open();
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^send$/i })).not.toBeInTheDocument();
  });
});

describe('ChatPanel — error states (§12.5, verbatim)', () => {
  it('surfaces the Gemini-unavailable message', () => {
    h.chat.error = {
      code: 'AI_UNAVAILABLE',
      message: 'The assistant is temporarily unavailable. Please try again shortly.',
    };
    open();
    expect(
      screen.getByText('The assistant is temporarily unavailable. Please try again shortly.')
    ).toBeInTheDocument();
  });

  it('surfaces the rate-limit message', () => {
    h.chat.error = {
      code: 'RATE_LIMITED',
      message: "You've reached the message limit for now. Try again in an hour.",
    };
    open();
    expect(
      screen.getByText("You've reached the message limit for now. Try again in an hour.")
    ).toBeInTheDocument();
  });
});

describe('MessageBubble', () => {
  it('has no avatar and no persona name — it is labelled "Nexus" (ui-spec §8.6)', () => {
    render(<MessageBubble message={{ id: '1', sender: 'assistant', message: 'Hello.' }} />);
    expect(screen.getByText('Nexus')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('appends the inline caution to scholarship answers only', () => {
    const { rerender } = render(
      <MessageBubble
        message={{ id: '1', sender: 'assistant', message: 'That scholarship closes soon.' }}
      />
    );
    expect(screen.getByText(/final word/i)).toBeInTheDocument();

    rerender(
      <MessageBubble message={{ id: '1', sender: 'assistant', message: 'Your code is ISA.' }} />
    );
    expect(screen.queryByText(/final word/i)).not.toBeInTheDocument();
  });

  it('renders content as text — never as HTML', () => {
    const { container } = render(
      <MessageBubble
        message={{ id: '1', sender: 'assistant', message: '<img src=x onerror=alert(1)>' }}
      />
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});
