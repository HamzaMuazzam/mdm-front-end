import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ROUTES, USER_LEVELS } from '@/utils/constants';
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

  // L1 user without subscription trying to access dashboard
  if (
    requiresSubscription &&
    user?.userLevel === USER_LEVELS.L1 &&
    !isLoading &&
    !userPlan &&
    location.pathname !== ROUTES.SUBSCRIPTIONS
  ) {
    return <Navigate to={ROUTES.SUBSCRIPTIONS} replace />;
  }

  return <>{children}</>;
}
