import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui';
import '@/styles/rail-journey-pages.css';

export function RailPageHeader({ station, label, title, description, actions }) {
  return (
    <header className="rail-page-heading">
      <div>
        <Link className="rail-back-link" to="/find-your-path">
          ← Find your path
        </Link>
        <p className="rail-page-eyebrow">
          <span>{station}</span> NEXUS LINE / {label}
        </p>
        <h1>{title}</h1>
        {description && <p className="rail-page-description">{description}</p>}
      </div>
      <div className="rail-heading-actions">
        {actions}
        <span className="rail-heading-route" aria-hidden="true">
          <Icon name="compass" /> YOUR NEXT CONNECTION
        </span>
      </div>
    </header>
  );
}
