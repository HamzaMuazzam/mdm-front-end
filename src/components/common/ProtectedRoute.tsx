import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ROUTES, isAdminRole } from '@/utils/constants';
import { useUserPlanQuery } from '@/hooks/useSubscriptions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresSubscription?: boolean;
}

export function ProtectedRoute({ children, requiresSubscription = false }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  const { data: userPlan, isLoading } = useUserPlanQuery();

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Admins (Admin / Super Admin) always have access — skip subscription gate
  const isAdmin = isAdminRole(user?.roleName);

  // Non-admin with no active subscription — redirect to plans
  if (
    requiresSubscription &&
    !isAdmin &&
    !isLoading &&
    !userPlan &&
    location.pathname !== ROUTES.SUBSCRIPTIONS
  ) {
    return <Navigate to={ROUTES.SUBSCRIPTIONS} replace />;
  }

  return <>{children}</>;
}
