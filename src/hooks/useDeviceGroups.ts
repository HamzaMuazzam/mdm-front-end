import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deviceGroupService } from '@/api/services/deviceGroup.service';
import { bulkOperationsService } from '@/api/services/bulkOperations.service';
import { toast } from '@/hooks/useToast';
import type { BulkOperationLogQuery, DeviceGroupMembersRequest, DeviceGroupRequest } from '@/types/bulk.types';

export const DEVICE_GROUPS_QUERY_KEY = ['deviceGroups'];
export const BULK_OPERATIONS_QUERY_KEY = ['bulkOperations'];

const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

/** The account's groups — "All" first. Shared by every bulk picker, so keep it fresh but cheap. */
export function useDeviceGroupsQuery(enabled = true) {
  return useQuery({
    queryKey: DEVICE_GROUPS_QUERY_KEY,
    queryFn: deviceGroupService.list,
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useDeviceGroupIdsOfDevice(deviceUuid: string | null | undefined) {
  return useQuery({
    queryKey: [...DEVICE_GROUPS_QUERY_KEY, 'ofDevice', deviceUuid],
    queryFn: () => deviceGroupService.groupIdsOfDevice(deviceUuid!),
    enabled: !!deviceUuid,
    staleTime: 30 * 1000,
  });
}

/** Invalidates everything that renders group membership (groups list + device list chips). */
function useInvalidateGroups() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: DEVICE_GROUPS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ['devices'] });
    queryClient.invalidateQueries({ queryKey: BULK_OPERATIONS_QUERY_KEY });
  };
}

export function useCreateDeviceGroup() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (req: DeviceGroupRequest) => deviceGroupService.create(req),
    onSuccess: (group) => {
      invalidate();
      toast({ variant: 'success', title: 'Group created', description: `"${group.name}" is ready to use in bulk actions.` });
    },
    onError: (error: any) =>
      toast({ variant: 'destructive', title: 'Could not create group', description: errorMessage(error, 'Please try again.') }),
  });
}

export function useUpdateDeviceGroup() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({ id, ...req }: DeviceGroupRequest & { id: number }) => deviceGroupService.update(id, req),
    onSuccess: (group) => {
      invalidate();
      toast({ variant: 'success', title: 'Group updated', description: `"${group.name}" saved.` });
    },
    onError: (error: any) =>
      toast({ variant: 'destructive', title: 'Could not update group', description: errorMessage(error, 'Please try again.') }),
  });
}

export function useUpdateDeviceGroupMembers() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: ({ id, ...req }: DeviceGroupMembersRequest & { id: number }) => deviceGroupService.updateMembers(id, req),
    onSuccess: () => invalidate(),
    onError: (error: any) =>
      toast({ variant: 'destructive', title: 'Could not update members', description: errorMessage(error, 'Please try again.') }),
  });
}

export function useDeleteDeviceGroup() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (id: number) => deviceGroupService.remove(id),
    onSuccess: () => {
      invalidate();
      toast({ variant: 'success', title: 'Group deleted', description: 'Devices were not affected.' });
    },
    onError: (error: any) =>
      toast({ variant: 'destructive', title: 'Could not delete group', description: errorMessage(error, 'Please try again.') }),
  });
}

export function useBulkOperationsQuery(query: BulkOperationLogQuery, enabled = true) {
  return useQuery({
    queryKey: [...BULK_OPERATIONS_QUERY_KEY, query],
    queryFn: () => bulkOperationsService.list(query),
    enabled,
    staleTime: 15 * 1000,
  });
}
