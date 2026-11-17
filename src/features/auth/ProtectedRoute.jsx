import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isAuthorizedRole, getRoleDashboard } from './auth.utils';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">
        <div className="flex flex-col items-center space-y-2">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs uppercase tracking-widest text-gray-400">Verifying Access...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !isAuthorizedRole(user.role, allowedRoles)) {
    // Redirect user to their own permitted dashboard rather than leaving them stranded
    const userDashboard = getRoleDashboard(user.role);
    return <Navigate to={userDashboard} replace />;
  }

  return children;
};

export default ProtectedRoute;

