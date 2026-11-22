import { Navigate, useLocation } from "react-router-dom";
import { hasModuleAccess, staffHome } from "../utils/staffAccess";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ children, allowedRoles, module, write }) {
  const { isLoggedIn, role, user } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if ((allowedRoles && !allowedRoles.includes(role)) || (module && !hasModuleAccess(user, module, write))) {
    return <Navigate to={staffHome(user)} replace />;
  }

  return children;
}
