import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-prose flex-col items-center justify-center px-4 text-center">
      <p className="text-caption text-ink-500">Error 404</p>
      <h1 className="mt-2 text-h1 font-serif">We can’t find that page</h1>
      <p className="mt-3 text-body text-ink-700">
        The link may be broken, or the page may have moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center rounded-input bg-pine-700 px-4 text-body-sm font-medium text-white hover:bg-pine-500"
      >
        Back to home
      </Link>
    </div>
  );
}

export default NotFound;
