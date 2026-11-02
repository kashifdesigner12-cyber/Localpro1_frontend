import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ user, loading, allowedRoles, children }) {
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FC]">
        <p className="text-sm font-medium text-slate-500">
          Verifying your session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const destination =
      user.role === "user" ? "/user/dashboard" : "/admin/dashboard";

    return <Navigate to={destination} replace />;
  }

  return children;
}
