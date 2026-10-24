import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { Skeleton } from "./ui.jsx";

export function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="mx-auto max-w-4xl px-5 py-16">
        <Skeleton className="h-64" />
      </div>
    );
  if (!user) return <Navigate to="/connexion" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
