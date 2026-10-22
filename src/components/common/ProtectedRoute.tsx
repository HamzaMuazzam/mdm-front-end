import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { usePermissionStore } from '@/store/permissionStore';
import { ROUTES } from '@/utils/constants';
import { gateSatisfied, type PermissionGate } from '@/utils/permissions';
import { useUserPlanQuery } from '@/hooks/useSubscriptions';
import { usePermissionsQuery } from '@/hooks/usePermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresSubscription?: boolean;
  /**
   * Permission(s) needed to open this route — an array means "any of".
   * A user who lacks them is sent to the dashboard instead of seeing a page whose
   * API calls would all 403. Falls open while permissions are still loading.
   */
  requiresPermission?: PermissionGate;
}

export function ProtectedRoute({ children, requiresSubscription = false, requiresPermission }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const { data: userPlan, isLoading, isError } = useUserPlanQuery();
  // Make sure the permission matrix is loaded on deep links / hard refresh of sub-pages,
  // not only when the dashboard mounts.
  usePermissionsQuery();
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const permissionsLoaded = usePermissionStore((state) => state.isLoaded);

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

  // Missing feature permission — hide the page entirely.
  if (requiresPermission && permissionsLoaded && !gateSatisfied(requiresPermission, hasPermission)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
}
