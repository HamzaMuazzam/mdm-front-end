import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roleService } from '@/api/services/role.service';
import { toast } from '@/hooks/useToast';
import type { CreateRoleRequest } from '@/types/role.types';

const ROLES_KEY = ['roles'];

export function useRolesQuery() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: roleService.getAll,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoleRequest) => roleService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROLES_KEY });
      toast({ variant: 'success', title: 'Role Created', description: 'Role has been created successfully.' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to create role.';
      toast({ variant: 'destructive', title: 'Create Error', description: message });
    },
  });
}

export function useUpdateRoleSecurityGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, securityGroupId }: { roleId: number; securityGroupId: number }) =>
      roleService.updateSecurityGroup(roleId, securityGroupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROLES_KEY });
      toast({ variant: 'success', title: 'Role Updated', description: 'Security group has been updated successfully.' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update role.';
      toast({ variant: 'destructive', title: 'Update Error', description: message });
    },
  });
}
