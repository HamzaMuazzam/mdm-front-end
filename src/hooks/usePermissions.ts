import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { usePermissionStore } from '@/store/permissionStore';
import { securityGroupService } from '@/api/services/security-group.service';

export function usePermissionsQuery() {
  const userId = useAuthStore((state) => state.user?.id);
  const setPermissions = usePermissionStore((state) => state.setPermissions);

  return useQuery({
    queryKey: ['userPermissions', userId],
    queryFn: async () => {
      const matrix = await securityGroupService.getUserPermissions(userId!);
      setPermissions(matrix);
      return matrix;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    // On failure, mark as loaded so the UI doesn't stay locked — fail open
    throwOnError: false,
  });
}
