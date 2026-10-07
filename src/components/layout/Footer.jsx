import { Link, useLocation } from 'react-router-dom';
import { Wordmark } from './Wordmark';
import { Icon } from '@/components/ui';

export function Footer() {
  const year = new Date().getFullYear();
  const { pathname } = useLocation();
  return (
    <footer className="nexus-public-footer">
      <div className="landing-shell">
        {pathname === '/' && (
          <div className="public-footer-invitation">
            <h2>
              Your next chapter
              <br />
              <span>starts with you.</span>
            </h2>
            <Link to="/register" className="landing-button">
              Find Your Path <Icon name="arrowUpRight" className="h-4 w-4" />
            </Link>
          </div>
        )}
        <div className="public-footer-main">
          <div>
            <Wordmark className="public-wordmark" />
            <p>A clearer way forward.</p>
          </div>
          <nav aria-label="Footer" className="public-footer-links">
            <Link to="/scholarships">Scholarships</Link>
            <Link to="/recommendations">Courses</Link>
            <Link to="/careers">Careers</Link>
            <Link to="/privacy">Privacy notice</Link>
          </nav>
        </div>
        <div className="public-footer-bottom">
          <p>&copy; {year} Nexus</p>
          <p>Built for Malaysian students.</p>
          <a href="#main">
            Back to top <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
