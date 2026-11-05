import { Link } from 'react-router-dom';
import { Wordmark } from './Wordmark';
import { Icon } from '@/components/ui';
import '@/styles/landing.css';
import '@/styles/site-chrome.css';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="nexus-public-footer">
      <div className="landing-shell">
        <div className="public-footer-main">
          <div>
            <Wordmark className="public-wordmark" />
            <p>A clearer way forward.</p>
          </div>
          <nav aria-label="Footer" className="public-footer-links">
            <Link to="/scholarships">Scholarships</Link>
            <Link to="/courses">Courses</Link>
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
