import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, it, expect, vi } from 'vitest';
import { CourseDetail } from './CourseDetail';
const fixture = vi.hoisted(() => ({ course: null }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: fixture.course, error: null }) }),
        }),
      }),
    }),
  },
}));
beforeEach(() => {
  fixture.course = {
    id: 'course-1',
    name: 'Example degree',
    field_of_study: 'Computer Science',
    pathway_type: 'degree',
    duration_months: 42,
    entry_requirements: 'Stored entry guidance',
    universities: { name: 'Universiti Malaya' },
    source_url: 'https://study.um.edu.my/bachelor-example',
    last_checked_at: '2026-10-10T00:00:00Z',
    programme_overview: 'Explore information systems.',
    career_prospects: ['Data Analyst'],
    entry_requirement_sections: [
      {
        applicant_category: 'Local',
        route: 'STPM',
        heading: 'STPM',
        text: 'Local route requirement.',
      },
      {
        applicant_category: 'International',
        route: 'Diploma',
        heading: 'Diploma',
        text: 'International route requirement.',
      },
    ],
  };
});
function show() {
  return render(
    <MemoryRouter initialEntries={['/courses/course-1']}>
      <Routes>
        <Route path="/courses/:id" element={<CourseDetail />} />
      </Routes>
    </MemoryRouter>
  );
}
it('shows the official source and separate applicant routes', async () => {
  show();
  expect(await screen.findByRole('link', { name: /official programme page/i })).toHaveAttribute(
    'href',
    'https://study.um.edu.my/bachelor-example'
  );
  expect(screen.getByText(/last source check/i)).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'STPM' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Local — STPM')).toBeInTheDocument();
  expect(screen.getByRole('tabpanel', { name: 'STPM' })).toHaveTextContent(
    'Local route requirement.'
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Diploma' }));
  expect(screen.getByRole('tabpanel', { name: 'Diploma' })).toHaveTextContent(
    'International — Diploma'
  );
  expect(screen.queryByRole('tabpanel', { name: 'STPM' })).not.toBeInTheDocument();
  expect(screen.getByText('Data Analyst')).toBeInTheDocument();
});
it('preserves existing entry guidance when a course has no source metadata', async () => {
  fixture.course = {
    ...fixture.course,
    source_url: null,
    last_checked_at: null,
    entry_requirement_sections: [],
    programme_overview: null,
    career_prospects: [],
  };
  show();
  expect(await screen.findByText('Stored entry guidance')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /official programme page/i })).not.toBeInTheDocument();
});
it('does not make an unsafe metadata URL into a clickable source', async () => {
  fixture.course.source_url = 'javascript:alert(1)';
  show();
  await screen.findByRole('heading', { name: 'Example degree' });
  expect(screen.queryByRole('link', { name: /official programme page/i })).not.toBeInTheDocument();
});
it('shows a protected manual requirement edit after the database clears superseded sections', async () => {
  fixture.course = {
    ...fixture.course,
    sync_mode: 'manual',
    entry_requirements: 'Admin verified correction',
    entry_requirement_sections: [],
  };
  show();
  expect(await screen.findByText('Admin verified correction')).toBeInTheDocument();
  expect(screen.queryByText('Local route requirement.')).not.toBeInTheDocument();
});
it('links back to the catalogue and supports official sources beyond UM', async () => {
  fixture.course.source_url = 'https://admissions.ukm.my/degree/law';
  fixture.course.universities = {
    name: 'Universiti Kebangsaan Malaysia',
    state: 'Selangor',
    type: 'public',
  };
  show();
  expect(await screen.findByRole('link', { name: /back to courses/i })).toHaveAttribute(
    'href',
    '/courses'
  );
  expect(screen.getByRole('link', { name: /official programme page/i })).toHaveAttribute(
    'href',
    'https://admissions.ukm.my/degree/law'
  );
  expect(screen.getAllByText('Selangor').length).toBeGreaterThan(0);
});
it('includes recorded subject requirements alongside the full entry guidance', async () => {
  fixture.course.required_subject_codes = ['MATH', 'ADDMATH'];
  show();
  expect(await screen.findByText('MATH')).toBeInTheDocument();
  expect(screen.getByText('ADDMATH')).toBeInTheDocument();
});

it('supports arrow keys, wrapping, Home and End in the requirement pills', async () => {
  show();
  const stpm = await screen.findByRole('tab', { name: 'STPM' });
  const diploma = screen.getByRole('tab', { name: 'Diploma' });
  stpm.focus();
  fireEvent.keyDown(stpm, { key: 'ArrowRight' });
  expect(diploma).toHaveFocus();
  expect(diploma).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(diploma, { key: 'ArrowRight' });
  expect(stpm).toHaveFocus();
  fireEvent.keyDown(stpm, { key: 'End' });
  expect(diploma).toHaveFocus();
  fireEvent.keyDown(diploma, { key: 'Home' });
  expect(stpm).toHaveFocus();
  for (const tab of screen.getAllByRole('tab')) {
    expect(document.getElementById(tab.getAttribute('aria-controls'))).toHaveAttribute(
      'aria-labelledby',
      tab.id
    );
  }
});

it('groups the same entry route without losing different applicant categories or full source text', async () => {
  fixture.course.entry_requirement_sections = [
    {
      applicant_category: 'Local',
      route: 'SPM',
      heading: 'Academic prerequisites',
      text: 'Five credits including Maths.\nAdditional published conditions.',
    },
    {
      applicant_category: 'International',
      route: ' spm ',
      heading: 'Equivalent qualification',
      text: 'Submit a recognised equivalent certificate.',
    },
    {
      applicant_category: 'International',
      route: 'IGCSE',
      heading: 'IGCSE',
      text: 'International GCSE requirements.',
    },
  ];
  show();
  await screen.findByRole('tab', { name: 'SPM' });
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  const panel = screen.getByRole('tabpanel', { name: 'SPM' });
  expect(panel).toHaveTextContent('Local — Academic prerequisites');
  expect(panel).toHaveTextContent('Additional published conditions.');
  expect(panel).toHaveTextContent('International — Equivalent qualification');
  expect(panel).toHaveTextContent('Submit a recognised equivalent certificate.');
  fireEvent.click(screen.getByRole('tab', { name: 'IGCSE' }));
  expect(screen.getByRole('tabpanel', { name: 'IGCSE' })).toHaveTextContent(
    'International GCSE requirements.'
  );
});

it('does not invent the reference-image routes when the course only records STPM and Diploma', async () => {
  show();
  await screen.findByRole('tab', { name: 'STPM' });
  expect(screen.queryByRole('tab', { name: 'SPM' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'IB MYP' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('tab')).toHaveLength(2);
});

it('uses legacy entry guidance when structured sections are malformed or empty', async () => {
  fixture.course.entry_requirement_sections = [
    null,
    { heading: 'SPM', text: '  ' },
    { heading: 'Bad section', text: 123 },
  ];
  show();
  expect(await screen.findByText('Stored entry guidance')).toBeVisible();
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
});

it('keeps subject codes and the official-source warning visible while switching routes', async () => {
  fixture.course.required_subject_codes = ['MATH', 'ADDMATH'];
  show();
  await screen.findByRole('tab', { name: 'Diploma' });
  fireEvent.click(screen.getByRole('tab', { name: 'Diploma' }));
  expect(screen.getByText('MATH')).toBeVisible();
  expect(screen.getByText(/Requirements may change/)).toBeVisible();
  const tabs = screen.getByRole('tablist', { name: 'Entry routes' });
  expect(within(tabs).getByRole('tab', { name: 'Diploma' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
});
