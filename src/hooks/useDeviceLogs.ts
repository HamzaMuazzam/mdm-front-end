import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deviceLogsService } from '@/api/services/deviceLogs.service';
import type { DeviceLogRequest } from '@/api/services/deviceLogs.service';

const LIST_KEY = (deviceUuid: string) => ['deviceLogs', deviceUuid];

/** A capture is in flight while any row is still short of a terminal state. */
function hasPending(rows: DeviceLogRequest[]): boolean {
  return rows.some(
    (r) => r.status === 'REQUESTED' || r.status === 'CAPTURING' || r.status === 'UPLOADING'
  );
}

export function useDeviceLogs(deviceUuid: string | null, page = 0, size = 20) {
  return useQuery({
    queryKey: [...LIST_KEY(deviceUuid ?? ''), page, size],
    queryFn: () => deviceLogsService.list(deviceUuid!, page, size),
    enabled: !!deviceUuid,
    staleTime: 5_000,
    // Poll quickly while a capture is running, then fall back to a slow refresh.
    refetchInterval: (query) => {
      const rows = query.state.data?.content ?? [];
      return hasPending(rows) ? 5_000 : 60_000;
    },
  });
}

export function useCollectDeviceLogs(deviceUuid: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deviceLogsService.collect(deviceUuid!),
    onSuccess: () => {
      if (deviceUuid) qc.invalidateQueries({ queryKey: LIST_KEY(deviceUuid) });
    },
  });
}

export function useDeleteDeviceLogBundle(deviceUuid: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => deviceLogsService.remove(requestId),
    onSuccess: () => {
      if (deviceUuid) qc.invalidateQueries({ queryKey: LIST_KEY(deviceUuid) });
    },
  });
}
