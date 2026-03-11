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
  const { data: userPlan, isLoading, isError } = useUserPlanQuery();

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // No active subscription — redirect to plans.
  // Skip redirect if there was a network error (backend down) to avoid
  // incorrectly sending the user to /subscriptions on page refresh.
  if (
    requiresSubscription &&
    !isLoading &&
    !isError &&
    !userPlan &&
    location.pathname !== ROUTES.SUBSCRIPTIONS
  ) {
    return <Navigate to={ROUTES.SUBSCRIPTIONS} replace />;
  }

  return <>{children}</>;
}
