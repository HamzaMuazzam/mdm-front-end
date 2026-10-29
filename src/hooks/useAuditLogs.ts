import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auditService } from '@/api/services/audit.service';
import { toast } from '@/hooks/useToast';
import type { AuditFilter, AuditSettings } from '@/types/audit.types';

export function useAuditSearch(filter: AuditFilter, enabled = true) {
  return useQuery({
    queryKey: ['audit-logs', 'search', filter],
    queryFn: () => auditService.search(filter),
    staleTime: 15_000,
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useDeviceAudit(deviceId: number | null, filter: AuditFilter, enabled = true) {
  return useQuery({
    queryKey: ['audit-logs', 'device', deviceId, filter],
    queryFn: () => auditService.byDevice(deviceId as number, filter),
    staleTime: 15_000,
    enabled: enabled && deviceId !== null,
    placeholderData: (prev) => prev,
  });
}

export function useAuditEvent(id: number | null) {
  return useQuery({
    queryKey: ['audit-logs', 'event', id],
    queryFn: () => auditService.get(id as number),
    enabled: id !== null,
  });
}

export function useAuditSummary(filter: AuditFilter, enabled = true) {
  return useQuery({
    queryKey: ['audit-logs', 'summary', filter],
    queryFn: () => auditService.summary(filter),
    staleTime: 30_000,
    enabled,
  });
}

export function useAuditFacets(filter: AuditFilter, enabled = true) {
  return useQuery({
    queryKey: ['audit-logs', 'facets', filter.from, filter.to, filter.ownerId],
    queryFn: () => auditService.facets({ from: filter.from, to: filter.to, ownerId: filter.ownerId }),
    staleTime: 60_000,
    enabled,
  });
}

export function useAuditHealth(enabled = true) {
  return useQuery({
    queryKey: ['audit-logs', 'health'],
    queryFn: auditService.health,
    refetchInterval: 30_000,
    enabled,
  });
}

export function useAuditExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filter, format }: { filter: AuditFilter; format: 'csv' | 'jsonl' }) => auditService.download(filter, format),
    onSuccess: (job) => {
      if (job) {
        qc.invalidateQueries({ queryKey: ['audit-logs', 'export-jobs'] });
        toast({ title: 'Export queued', description: `Large result set: job #${job.id} is being prepared. Open Exports to download it when ready.` });
      } else {
        toast({ title: 'Export started', description: 'The download will begin shortly. This export has been recorded in the audit log.' });
      }
    },
    onError: () => toast({ title: 'Export failed', description: 'Could not export audit logs.', variant: 'destructive' }),
  });
}

export function useAuditVerify() {
  return useMutation({
    mutationFn: ({ from, to, ownerId }: { from: string; to: string; ownerId?: string }) => auditService.verify(from, to, ownerId),
    onError: () => toast({ title: 'Verification failed', description: 'Could not run the integrity check.', variant: 'destructive' }),
  });
}

export function useAuditExportJobs(enabled = true) {
  return useQuery({
    queryKey: ['audit-logs', 'export-jobs'],
    queryFn: auditService.exportJobs,
    enabled,
    refetchInterval: (q) => (q.state.data?.some((j) => j.status === 'QUEUED' || j.status === 'RUNNING') ? 5_000 : false),
  });
}

export function useAuditSettings(enabled = true) {
  return useQuery({ queryKey: ['audit-logs', 'settings'], queryFn: auditService.getSettings, enabled });
}

export function useUpdateAuditSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: AuditSettings) => auditService.updateSettings(s),
    onSuccess: (data) => {
      qc.setQueryData(['audit-logs', 'settings'], data);
      toast({ variant: 'success', title: 'Audit settings saved', description: 'The change has been recorded in the audit log.' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Could not save settings' }),
  });
}
