import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { securityGroupService } from '@/api/services/security-group.service';
import { toast } from '@/hooks/useToast';
import type { CreateSecurityGroupRequest, MoveSecurityGroupUsersRequest } from '@/types/security-group.types';


const SECURITY_GROUPS_KEY = ['security-groups'];

export function useSecurityGroupsQuery() {
  return useQuery({
    queryKey: SECURITY_GROUPS_KEY,
    queryFn: () => securityGroupService.getAll(),
    staleTime: 5 * 60 * 1000,
  });
}

export const SECURITY_GROUP_MEMBERS_KEY = ['security-group-members'];

export function useSecurityGroupMembersQuery(securityGroupId: number | null) {
  return useQuery({
    queryKey: [...SECURITY_GROUP_MEMBERS_KEY, securityGroupId],
    queryFn: () => securityGroupService.getMembers(securityGroupId!),
    enabled: securityGroupId !== null,
    staleTime: 60 * 1000,
  });
}

export function useSecurityGroupEligibleUsersQuery(securityGroupId: number | null, enabled = true) {
  return useQuery({
    queryKey: [...SECURITY_GROUP_MEMBERS_KEY, 'eligible', securityGroupId],
    queryFn: () => securityGroupService.getEligibleUsers(securityGroupId!),
    enabled: enabled && securityGroupId !== null,
    staleTime: 30 * 1000,
  });
}

/** Bulk move / add / unassign members of a group. Reports skipped users in a toast. */
export function useMoveSecurityGroupUsers(securityGroupId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MoveSecurityGroupUsersRequest) => securityGroupService.moveUsers(securityGroupId!, data),
    onSuccess: (result, vars) => {
      queryClient.invalidateQueries({ queryKey: SECURITY_GROUP_MEMBERS_KEY });
      queryClient.invalidateQueries({ queryKey: SECURITY_GROUPS_KEY });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      const verb = vars.targetSecurityGroupId === null ? 'removed from the group' : vars.targetSecurityGroupId === securityGroupId ? 'added to the group' : 'moved';
      const skipped = result.skipped.length
        ? ` ${result.skipped.length} skipped: ${result.skipped.map((s) => s.reason).filter((r, i, a) => a.indexOf(r) === i).join('; ')}.`
        : '';
      toast({
        variant: result.moved === 0 && result.skipped.length ? 'destructive' : 'success',
        title: result.moved === 0 && result.skipped.length ? 'No users changed' : `${result.moved} user${result.moved === 1 ? '' : 's'} ${verb}`,
        description: skipped || undefined,
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to move users.';
      toast({ variant: 'destructive', title: 'Move failed', description: message });
    },
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

export function useAddPermission(securityGroupId: number | null, options: { silent?: boolean } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (permissionId: number) =>
      securityGroupService.addPermission(securityGroupId!, permissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-group-permissions', securityGroupId] });
      if (!options.silent) toast({ variant: 'success', title: 'Permission Added', description: 'Permission has been assigned successfully.' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to add permission.';
      toast({ variant: 'destructive', title: 'Error', description: message });
    },
  });
}

export function useRemovePermission(securityGroupId: number | null, options: { silent?: boolean } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (permissionId: number) =>
      securityGroupService.removePermission(permissionId, securityGroupId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-group-permissions', securityGroupId] });
      if (!options.silent) toast({ variant: 'success', title: 'Permission Removed', description: 'Permission has been removed successfully.' });
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
