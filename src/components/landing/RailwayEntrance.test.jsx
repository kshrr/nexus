import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock('motion/react', () => ({
  useReducedMotion: () => motionState.reduce,
  m: {
    div: (props) => {
      const domProps = Object.fromEntries(
        Object.entries(props).filter(([key]) => !['initial', 'animate', 'transition'].includes(key))
      );
      return <div {...domProps} />;
    },
  },
}));
vi.mock('./RailIllustrations', () => ({ TrainDrawing: () => <svg aria-hidden="true" /> }));

import { RailwayEntrance } from './RailwayEntrance';

let root;
beforeEach(() => {
  vi.useFakeTimers();
  motionState.reduce = false;
  sessionStorage.clear();
  root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
});
afterEach(() => {
  root.remove();
  document.body.style.overflow = '';
  vi.useRealTimers();
});

function Harness({ onFinish = () => {} }) {
  const [open, setOpen] = useState(true);
  return (
    <RailwayEntrance
      open={open}
      sessionKey="nexus.railwayEntranceSeen"
      onFinish={() => {
        onFinish();
        setOpen(false);
      }}
    />
  );
}

describe('Railway entrance', () => {
  it('changes the signal in order and automatically releases the page', () => {
    const finish = vi.fn();
    render(<Harness onFinish={finish} />, { container: root });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Please wait');
    expect(sessionStorage.getItem('nexus.railwayEntranceSeen')).toBe('1');
    expect(root).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByRole('status')).toHaveTextContent('Get ready');
    act(() => vi.advanceTimersByTime(550));
    expect(screen.getByRole('status')).toHaveTextContent('All clear');
    act(() => vi.advanceTimersByTime(1900));
    expect(finish).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(root).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
  });

  it('lets visitors skip immediately and cancels the remaining timers', () => {
    const finish = vi.fn();
    render(<Harness onFinish={finish} />, { container: root });
    fireEvent.click(screen.getByRole('button', { name: /skip intro/i }));
    act(() => vi.advanceTimersByTime(5000));
    expect(finish).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(root).not.toHaveAttribute('inert');
  });

  it('keeps keyboard focus in the intro and supports Escape', () => {
    const before = document.createElement('button');
    before.textContent = 'Previous focus';
    root.appendChild(before);
    before.focus();
    const view = render(<Harness />);
    const skip = screen.getByRole('button', { name: /skip intro/i });
    expect(skip).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(skip).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(before).toHaveFocus();
    view.unmount();
  });

  it('restores pre-existing page state if navigation unmounts the intro', () => {
    document.body.style.overflow = 'scroll';
    root.setAttribute('inert', '');
    const finish = vi.fn();
    const view = render(<Harness onFinish={finish} />);
    view.unmount();
    act(() => vi.advanceTimersByTime(5000));
    expect(finish).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('scroll');
    expect(root).toHaveAttribute('inert');
  });

  it('opens the website immediately when reduced motion is preferred', () => {
    motionState.reduce = true;
    const finish = vi.fn();
    render(<Harness onFinish={finish} />, { container: root });
    expect(finish).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(root).not.toHaveAttribute('inert');
  });
});
