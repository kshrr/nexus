import { useCallback, useContext, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BreadcrumbContext } from './breadcrumbContext';
import { buildTrail } from './breadcrumbTrail';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@/styles/breadcrumbs.css';

/** Lets a detail page (a course, a career) name its own breadcrumb. */
export function BreadcrumbProvider({ children }) {
  const [labels, setLabels] = useState({});
  const setLabel = useCallback((path, label) => {
    setLabels((current) => {
      if (label == null) {
        if (!(path in current)) return current;
        const { [path]: _removed, ...rest } = current;
        return rest;
      }
      return current[path] === label ? current : { ...current, [path]: label };
    });
  }, []);
  const value = useMemo(() => ({ labels, setLabel }), [labels, setLabel]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function Breadcrumbs({ items, tone = 'default' }) {
  const { pathname } = useLocation();
  const { labels } = useContext(BreadcrumbContext);
  const trail = items ?? buildTrail(pathname, labels);
  if (!trail.length) return null;
  return (
    <nav className={`nexus-crumbs${tone === 'light' ? ' is-light' : ''}`} aria-label="Breadcrumb">
      <ol>
        {trail.map((item, index) => {
          const current = index === trail.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {current || !item.to ? (
                <span aria-current={current ? 'page' : undefined} title={item.label}>
                  {item.label}
                </span>
              ) : (
                <Link to={item.to}>{item.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
