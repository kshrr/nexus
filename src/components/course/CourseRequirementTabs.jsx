import { useId, useRef, useState } from 'react';
import { safeRegisteredCourseSource } from '@/lib/courseCatalogue';

/** Group recorded routes, retaining every applicant category and source section. */
function routeGroups(sections) {
  const groups = new Map();
  for (const section of Array.isArray(sections) ? sections : []) {
    if (
      !section ||
      typeof section.text !== 'string' ||
      !section.text.trim() ||
      typeof section.heading !== 'string'
    )
      continue;
    const label =
      (typeof section.route === 'string' && section.route.trim()) ||
      section.heading.trim() ||
      'General';
    const key = label.toLowerCase();
    if (!groups.has(key)) groups.set(key, { key, label, sections: [] });
    groups.get(key).sections.push(section);
  }
  return [...groups.values()];
}

export function CourseRequirementTabs({ sections, fallback }) {
  const groups = routeGroups(sections);
  const [selected, setSelected] = useState(null);
  const id = useId();
  const buttons = useRef([]);
  const active = Math.max(
    0,
    groups.findIndex((group) => group.key === selected)
  );

  function move(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % groups.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + groups.length) % groups.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = groups.length - 1;
    else return;
    event.preventDefault();
    setSelected(groups[next].key);
    buttons.current[next]?.focus();
    buttons.current[next]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  if (!groups.length)
    return (
      <p className="course-requirement-copy">
        {typeof fallback === 'string' && fallback.trim()
          ? fallback
          : 'Entry requirements have not been recorded. Confirm the criteria with the institution.'}
      </p>
    );

  return (
    <div className="course-requirements">
      <div className="course-requirement-pills" role="tablist" aria-label="Entry routes">
        {groups.map((group, index) => (
          <button
            key={group.key}
            type="button"
            role="tab"
            title={group.label}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            id={`${id}-route-${index}`}
            aria-controls={`${id}-route-${index}-panel`}
            aria-selected={index === active}
            tabIndex={index === active ? 0 : -1}
            onClick={() => setSelected(group.key)}
            onKeyDown={(event) => move(event, index)}
          >
            {group.label}
          </button>
        ))}
      </div>
      {groups.map((group, index) => (
        <section
          key={group.key}
          className="course-route-panel"
          role="tabpanel"
          tabIndex={0}
          id={`${id}-route-${index}-panel`}
          aria-labelledby={`${id}-route-${index}`}
          hidden={index !== active}
        >
          {group.sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="course-route-section">
              <h4>
                {typeof section.applicant_category === 'string' && section.applicant_category.trim()
                  ? section.applicant_category.trim()
                  : 'General'}{' '}
                — {section.heading.trim() || group.label}
              </h4>
              <p className="course-requirement-copy">{section.text}</p>
              {safeRegisteredCourseSource(section.source_url) && (
                <a
                  className="mt-2 inline-block text-body-sm text-pine-700 underline"
                  href={safeRegisteredCourseSource(section.source_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Official requirement source
                  {section.source_page ? ` · page ${section.source_page}` : ''}
                </a>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
