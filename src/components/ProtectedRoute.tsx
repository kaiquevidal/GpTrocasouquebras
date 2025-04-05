
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user';
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-company-primary"></div>
      </div>
    );
  }

  // If not logged in, redirect to login page
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If a specific role is required, check it
  if (requiredRole) {
    // Admin role check
    if (requiredRole === 'admin' && !isAdmin()) {
      return <Navigate to="/unauthorized" replace />;
    }
    
    // All authorized, show children content
    return <>{children}</>;
  }

  // No role requirements, just logged in
  return <>{children}</>;
};

export default ProtectedRoute;
