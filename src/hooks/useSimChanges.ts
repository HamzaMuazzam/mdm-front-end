import { useQuery } from '@tanstack/react-query';
import { simChangeService } from '@/api/services/simChange.service';

const EVENTS_KEY = (deviceUuid: string) => ['deviceSimChanges', deviceUuid];
const STATS_KEY = (deviceUuid: string) => ['deviceSimChangeStats', deviceUuid];

export function useSimChangeEvents(
  deviceUuid: string | null,
  page = 0,
  size = 50,
  securityOnly = false
) {
  return useQuery({
    queryKey: [...EVENTS_KEY(deviceUuid ?? ''), page, size, securityOnly],
    queryFn: () => simChangeService.getEvents(deviceUuid!, page, size, securityOnly),
    enabled: !!deviceUuid,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useSimChangeStats(deviceUuid: string | null) {
  return useQuery({
    queryKey: STATS_KEY(deviceUuid ?? ''),
    queryFn: () => simChangeService.getStats(deviceUuid!),
    enabled: !!deviceUuid,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
