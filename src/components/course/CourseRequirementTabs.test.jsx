import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { CourseRequirementTabs } from './CourseRequirementTabs';
it('shows programme requirement evidence only for registered official sources', () => {
  render(
    <CourseRequirementTabs
      sections={[
        {
          applicant_category: 'Local',
          route: 'SPM',
          heading: 'Published SPM requirements',
          text: 'Published criteria',
          source_url: 'https://www.unisza.edu.my/our-faculties/foundation-in-science-and-medicine',
        },
        {
          applicant_category: 'Local',
          route: 'SPM',
          heading: 'Other',
          text: 'Other criteria',
          source_url: 'https://evil.example/doc.pdf',
        },
      ]}
    />
  );
  expect(screen.getAllByRole('link', { name: /official requirement source/i })).toHaveLength(1);
  expect(screen.getByRole('link').href).toContain('foundation-in-science-and-medicine');
});
