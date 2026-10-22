import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { usePermissionStore } from '@/store/permissionStore';
import { securityGroupService } from '@/api/services/security-group.service';

/** How often a logged-in session re-checks its permissions so revocations land without a reload. */
const PERMISSIONS_REFRESH_MS = 60 * 1000;

/**
 * Loads the calling user's permission matrix into the permission store and keeps it fresh.
 *
 * - The store is synced from the query DATA (not inside queryFn), so a cache hit after a
 *   remount still populates it — previously a fresh cache left the store "not loaded",
 *   which made every gate fall open.
 * - Re-polls every minute and on window focus, so a permission an admin revokes disappears
 *   from an already-open session within ~1 minute instead of only after a hard reload.
 * - On a definitive error (after retries) the store is marked loaded with NO permissions:
 *   fail closed. The backend would 403 those calls anyway, so hiding the UI is the honest state.
 */
export function usePermissionsQuery() {
  const userId = useAuthStore((state) => state.user?.id);
  const setPermissions = usePermissionStore((state) => state.setPermissions);
  const markUnavailable = usePermissionStore((state) => state.markUnavailable);

  const query = useQuery({
    queryKey: ['userPermissions', userId],
    queryFn: () => securityGroupService.getUserPermissions(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,
    refetchInterval: PERMISSIONS_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 2,
    throwOnError: false,
  });

  useEffect(() => {
    if (query.data) setPermissions(query.data);
  }, [query.data, setPermissions]);

  useEffect(() => {
    if (query.isError && !query.data) markUnavailable();
  }, [query.isError, query.data, markUnavailable]);

  return query;
}
