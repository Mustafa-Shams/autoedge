/**
 * NotFoundPage — 404 page for unmatched routes.
 */
import { Link } from 'react-router-dom';
import BackButton from '../components/common/BackButton';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <BackButton fallback="/" label="Back" className="mb-6" />
        <p className="text-6xl font-bold text-accent-blue mb-4">404</p>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Page Not Found</h1>
        <p className="text-text-secondary mb-8 max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/"
            className="px-6 py-2.5 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white font-medium rounded-lg transition-colors"
          >
            Go Home
          </Link>
          <Link
            to="/cars"
            className="px-6 py-2.5 bg-bg-elevated hover:bg-bg-border text-text-primary font-medium rounded-lg border border-bg-border transition-colors"
          >
            Browse Cars
          </Link>
        </div>
      </div>
    </div>
  );
}
