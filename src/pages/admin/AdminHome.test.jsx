import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const h = vi.hoisted(() => ({
  overview: {
    stats: {
      lastRun: null,
      activeScholarships: 12,
      flaggedScholarships: 2,
      expiredScholarships: 3,
      archivedScholarships: 1,
      activeCourses: 24,
      activeUniversities: 8,
      activeCareers: 16,
      crawlHistory: [],
    },
    recentAudit: [
      {
        id: 'a1',
        action: 'scholarships.insert',
        created_at: '2026-09-08T10:00:00Z',
        metadata: { name: 'MARA Young Talent' },
      },
    ],
    loading: false,
    error: null,
    reload: vi.fn(),
  },
  audit: { entries: [], loading: false, error: null, reload: vi.fn() },
}));

vi.mock('@/hooks/useAdminOps', () => ({
  useAdminOverview: () => h.overview,
  useCrawlRunning: () => ({ running: null, loading: false, refresh: vi.fn() }),
  useTriggerCrawl: () => ({
    trigger: vi.fn().mockResolvedValue({ data: {} }),
    pending: false,
    result: null,
    error: null,
  }),
  useAuditLog: () => h.audit,
  useCrawlLogs: () => ({ logs: [], loading: false, error: null, reload: vi.fn() }),
  useFlaggedRecords: () => ({
    records: [],
    loading: false,
    error: null,
    reload: vi.fn(),
    approve: vi.fn(),
    archive: vi.fn(),
  }),
}));

import { AdminHome } from './AdminHome';
import { AdminAudit } from './AdminAudit';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('AdminHome — the four operational facts (ui-spec §10.1)', () => {
  it('shows the operational and catalogue summary', () => {
    wrap(<AdminHome />);
    expect(screen.getByText('Last crawler run')).toBeInTheDocument();
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(screen.getByText('Scholarships')).toBeInTheDocument();
    expect(screen.getByText('Active courses')).toBeInTheDocument();
    expect(screen.getByText('Career pathways')).toBeInTheDocument();
    expect(screen.getByText('Universities')).toBeInTheDocument();
  });

  it('reports honestly when the crawler has never run', () => {
    wrap(<AdminHome />);
    expect(screen.getByText('Never')).toBeInTheDocument();
    expect(screen.getByText(/No run recorded/i)).toBeInTheDocument();
  });

  it('surfaces work waiting on a human', () => {
    wrap(<AdminHome />);
    expect(screen.getByText('Action required')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open review queue/i })).toBeInTheDocument();
  });

  it('exposes NO student metric of any kind (§13.1 privilege separation)', () => {
    const { container } = wrap(<AdminHome />);
    const text = container.textContent ?? '';
    for (const forbidden of [
      /students? registered/i,
      /total users/i,
      /assessments? (taken|completed)/i,
      /sign-?ups/i,
      /active students/i,
    ]) {
      expect(text).not.toMatch(forbidden);
    }
  });

  it('shows recent administrator activity with a link to the full log', () => {
    wrap(<AdminHome />);
    expect(screen.getByText(/Scholarships Insert/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view all/i })).toHaveAttribute('href', '/admin/audit');
  });

  it('says so plainly when nothing is published', () => {
    h.overview.stats = {
      lastRun: null,
      activeScholarships: 0,
      flaggedScholarships: 0,
      expiredScholarships: 0,
      archivedScholarships: 0,
      activeCourses: 0,
      activeUniversities: 0,
      activeCareers: 0,
      crawlHistory: [],
    };
    wrap(<AdminHome />);
    expect(screen.getByText(/No scholarship data/i)).toBeInTheDocument();
    h.overview.stats = {
      lastRun: null,
      activeScholarships: 12,
      flaggedScholarships: 2,
      expiredScholarships: 3,
      archivedScholarships: 1,
      activeCourses: 24,
      activeUniversities: 8,
      activeCareers: 16,
      crawlHistory: [],
    };
  });
});

describe('AdminAudit — append-only by construction (ui-spec §10.5, §4.7)', () => {
  it('offers no delete or edit control anywhere — the absence is the design', () => {
    h.audit.entries = [
      {
        id: 'e1',
        action: 'scholarships.update',
        target_table: 'scholarships',
        actor_user_id: '11111111-2222-3333-4444-555555555555',
        created_at: '2026-09-08T10:00:00Z',
        metadata: { name: 'PETRONAS' },
      },
    ];
    wrap(<AdminAudit />);

    for (const label of [/delete/i, /remove/i, /clear/i, /edit/i]) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
  });

  it('tells the admin the log cannot be tampered with', () => {
    wrap(<AdminAudit />);
    expect(screen.getByText(/cannot be edited or deleted/i)).toBeInTheDocument();
  });

  it('records who made each change', () => {
    wrap(<AdminAudit />);
    expect(screen.getByText('scholarships.update')).toBeInTheDocument();
    expect(screen.getByText(/11111111…/)).toBeInTheDocument();
  });

  it('shows an honest empty state before any activity', () => {
    h.audit.entries = [];
    wrap(<AdminAudit />);
    expect(screen.getByText(/Nothing recorded yet/i)).toBeInTheDocument();
  });
});
