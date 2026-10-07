import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/useAuth';
import { Wordmark } from './Wordmark';
import { Icon } from '@/components/ui';

// Existing destinations, grouped together for the public navigation.
const searchLinks = [
  { to: '/scholarships', label: 'Scholarships', icon: 'scholarship' },
  { to: '/recommendations', label: 'Courses', icon: 'book' },
  { to: '/careers', label: 'Careers', icon: 'career' },
];

function SearchLinks({ onNavigate }) {
  const detailsRef = useRef(null);
  function close() {
    if (detailsRef.current) detailsRef.current.open = false;
    onNavigate();
  }
  return (
    <details
      ref={detailsRef}
      className="public-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}
    >
      <summary>
        Search
        <svg className="public-search-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className="public-search-links">
        {searchLinks.map((item) => (
          <NavLink key={item.to} to={item.to} onClick={close}>
            <Icon name={item.icon} className="h-4 w-4" />
            {item.label}
            <Icon name="arrowUpRight" className="public-search-arrow h-4 w-4" />
          </NavLink>
        ))}
      </div>
    </details>
  );
}

export function PublicHeader() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  function closeNavigation() {
    setOpen(false);
  }
  return (
    <header className={cn('nexus-public-header', scrolled && 'is-scrolled')}>
      <div className="landing-shell public-header-inner">
        <Wordmark className="public-wordmark" />
        <nav
          id="public-primary-nav"
          className={cn('public-primary-nav', open && 'is-open')}
          aria-label="Primary"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              closeNavigation();
              document.getElementById('public-nav-toggle')?.focus();
            }
          }}
        >
          <SearchLinks onNavigate={closeNavigation} />
          <NavLink to="/find-your-path" className="public-nav-link" onClick={closeNavigation}>
            Find Your Path
          </NavLink>
          <div className="public-mobile-auth">
            {isAuthenticated ? (
              <Link to="/dashboard" className="landing-button" onClick={closeNavigation}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="public-login" onClick={closeNavigation}>
                  Login
                </Link>
                <Link to="/register" className="landing-button" onClick={closeNavigation}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
        <div className="public-header-actions">
          {isAuthenticated ? (
            <Link to="/dashboard" className="landing-button">
              Dashboard <Icon name="arrowUpRight" className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link to="/login" className="public-login">
                Login
              </Link>
              <Link to="/register" className="landing-button">
                Sign up <Icon name="arrowUpRight" className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
        <button
          id="public-nav-toggle"
          type="button"
          className="public-nav-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="public-primary-nav"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
        >
          {open ? (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M6 18 18 6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          ) : (
            <Icon name="menu" />
          )}
        </button>
      </div>
    </header>
  );
}

export default PublicHeader;
