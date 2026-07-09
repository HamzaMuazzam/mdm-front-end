import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deviceIntegrityService } from '@/api/services/deviceIntegrity.service';

const EVENTS_KEY = (deviceUuid: string) => ['deviceIntegrityEvents', deviceUuid];
const STATS_KEY = (deviceUuid: string) => ['deviceIntegrityStats', deviceUuid];
const FLEET_KEY = ['deviceIntegrityFleet'];

export function useIntegrityEvents(
  deviceUuid: string | null,
  page = 0,
  size = 50,
  securityOnly = false
) {
  return useQuery({
    queryKey: [...EVENTS_KEY(deviceUuid ?? ''), page, size, securityOnly],
    queryFn: () => deviceIntegrityService.getEvents(deviceUuid!, page, size, securityOnly),
    enabled: !!deviceUuid,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useIntegrityStats(deviceUuid: string | null) {
  return useQuery({
    queryKey: STATS_KEY(deviceUuid ?? ''),
    queryFn: () => deviceIntegrityService.getStats(deviceUuid!),
    enabled: !!deviceUuid,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useIntegrityFleetSummary(enabled = true) {
  return useQuery({
    queryKey: FLEET_KEY,
    queryFn: () => deviceIntegrityService.getFleetSummary(),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useRequestIntegrityScan(deviceUuid: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deviceIntegrityService.requestScan(deviceUuid!),
    onSuccess: () => {
      if (deviceUuid) {
        qc.invalidateQueries({ queryKey: STATS_KEY(deviceUuid) });
        qc.invalidateQueries({ queryKey: EVENTS_KEY(deviceUuid) });
      }
    },
  });
}
