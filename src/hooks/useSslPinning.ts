import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sslPinningService, type SslPinningPolicyRequest, type SslPinningBulkRequest } from '@/api/services/sslPinning.service';

const KEY = (deviceUuid: string) => ['sslPinning', deviceUuid];

export function useSslPinningPolicies(deviceUuid: string | null) {
  return useQuery({
    queryKey: KEY(deviceUuid ?? ''),
    queryFn: () => sslPinningService.listByDevice(deviceUuid!),
    enabled: !!deviceUuid,
    staleTime: 10_000,
  });
}

export function useSaveSslPinningPolicy(deviceUuid: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SslPinningPolicyRequest) => sslPinningService.createOrUpdate(payload),
    onSuccess: () => {
      if (deviceUuid) qc.invalidateQueries({ queryKey: KEY(deviceUuid) });
    },
  });
}

export function useToggleSslPinningPolicy(deviceUuid: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      sslPinningService.toggle(id, enabled),
    onSuccess: () => {
      if (deviceUuid) qc.invalidateQueries({ queryKey: KEY(deviceUuid) });
    },
  });
}

export function useBulkAssignSslPinning() {
  return useMutation({
    mutationFn: (payload: SslPinningBulkRequest) => sslPinningService.bulkAssign(payload),
  });
}

export function useDeleteSslPinningPolicy(deviceUuid: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => sslPinningService.remove(id),
    onSuccess: () => {
      if (deviceUuid) qc.invalidateQueries({ queryKey: KEY(deviceUuid) });
    },
  });
}
