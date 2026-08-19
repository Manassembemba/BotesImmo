import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-medium">Validation des accès...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If roles are specified, check if the user's role is allowed
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    console.warn(`Access denied for role: ${role}. Required: ${allowedRoles.join(', ')}`);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
