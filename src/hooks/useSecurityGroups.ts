import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { securityGroupService } from '@/api/services/security-group.service';
import { toast } from '@/hooks/useToast';
import type { CreateSecurityGroupRequest } from '@/types/security-group.types';


const SECURITY_GROUPS_KEY = ['security-groups'];

export function useSecurityGroupsQuery() {
  return useQuery({
    queryKey: SECURITY_GROUPS_KEY,
    queryFn: () => securityGroupService.getAll(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSecurityGroupPermissionsQuery(securityGroupId: number | null) {
  return useQuery({
    queryKey: ['security-group-permissions', securityGroupId],
    queryFn: () => securityGroupService.getPermissions(securityGroupId!),
    enabled: securityGroupId !== null,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddPermission(securityGroupId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (permissionId: number) =>
      securityGroupService.addPermission(securityGroupId!, permissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-group-permissions', securityGroupId] });
      toast({ variant: 'success', title: 'Permission Added', description: 'Permission has been assigned successfully.' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to add permission.';
      toast({ variant: 'destructive', title: 'Error', description: message });
    },
  });
}

export function useRemovePermission(securityGroupId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (permissionId: number) =>
      securityGroupService.removePermission(permissionId, securityGroupId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-group-permissions', securityGroupId] });
      toast({ variant: 'success', title: 'Permission Removed', description: 'Permission has been removed successfully.' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to remove permission.';
      toast({ variant: 'destructive', title: 'Error', description: message });
    },
  });
}

export function useUpdateSecurityGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateSecurityGroupRequest }) =>
      securityGroupService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SECURITY_GROUPS_KEY });
      toast({
        variant: 'success',
        title: 'Security Group Updated',
        description: 'Security group has been updated successfully.',
      });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update security group. Please try again.';
      toast({ variant: 'destructive', title: 'Update Error', description: message });
    },
  });
}

export function useCreateSecurityGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSecurityGroupRequest) => securityGroupService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SECURITY_GROUPS_KEY });
      toast({
        variant: 'success',
        title: 'Security Group Created',
        description: 'Security group has been created successfully.',
      });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to create security group. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Create Error',
        description: message,
      });
    },
  });
}
