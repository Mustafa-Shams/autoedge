import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../../store/authStore';

/**
 * ProtectedRoute — wraps any route that requires a customer token.
 * Redirects to /login?next=<current path> when logged out (spec 11.2).
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
