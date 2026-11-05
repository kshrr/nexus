import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui';
import { formatCourseDuration, PATHWAY_LABELS, TYPE_LABELS } from '@/lib/courseCatalogue';

export function CourseBrowseCard({ course, from }) {
  const university = course.universities;
  return (
    <article className="course-browse-card">
      <p className="course-card-university">{university?.name ?? 'Institution not listed'}</p>
      <h3>{course.name}</h3>
      <div className="course-card-top">
        <span className="course-field-tag">
          {PATHWAY_LABELS[course.pathway_type] ?? 'Qualification not listed'}
        </span>
        {course.field_of_study && <span className="course-field-tag">{course.field_of_study}</span>}
      </div>
      <div className="course-card-meta">
        <span>
          <span className="course-mini-dot" />
          {university?.state ?? 'Location not listed'}
        </span>
        <span>
          <Icon name="clock" className="h-4 w-4" />
          {formatCourseDuration(course.duration_months)}
        </span>
      </div>
      <div className="course-card-bottom">
        <Link
          to={'/courses/' + course.id}
          state={{ from }}
          aria-label={'View ' + course.name + ' details'}
        >
          View details <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
        {university?.type && <span>{TYPE_LABELS[university.type] ?? university.type}</span>}
      </div>
    </article>
  );
}
