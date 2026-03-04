import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ROUTES } from '@/utils/constants';
import { useUserPlanQuery } from '@/hooks/useSubscriptions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresSubscription?: boolean;
}

export function ProtectedRoute({ children, requiresSubscription = false }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const { data: userPlan, isLoading } = useUserPlanQuery();

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // No active subscription — redirect to plans
  if (
    requiresSubscription &&
    !isLoading &&
    !userPlan &&
    location.pathname !== ROUTES.SUBSCRIPTIONS
  ) {
    return <Navigate to={ROUTES.SUBSCRIPTIONS} replace />;
  }

  return <>{children}</>;
}
