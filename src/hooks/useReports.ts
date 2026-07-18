import { useMutation, useQuery } from '@tanstack/react-query';
import { reportService } from '@/api/services/report.service';
import { toast } from '@/hooks/useToast';
import type { ReportExportType } from '@/types/report.types';

const STALE = 60 * 1000;

export function useReportOverviewQuery(enabled = true) {
  return useQuery({
    queryKey: ['reports', 'overview'],
    queryFn: reportService.getOverview,
    staleTime: STALE,
    enabled,
  });
}

export function useDeviceReportQuery(enabled = true) {
  return useQuery({
    queryKey: ['reports', 'devices'],
    queryFn: reportService.getDeviceReport,
    staleTime: STALE,
    enabled,
  });
}

export function useSecurityReportQuery(enabled = true) {
  return useQuery({
    queryKey: ['reports', 'security'],
    queryFn: reportService.getSecurityReport,
    staleTime: STALE,
    enabled,
  });
}

export function useApplicationReportQuery(enabled = true) {
  return useQuery({
    queryKey: ['reports', 'applications'],
    queryFn: reportService.getApplicationReport,
    staleTime: STALE,
    enabled,
  });
}

export function useUserReportQuery(enabled = true) {
  return useQuery({
    queryKey: ['reports', 'users'],
    queryFn: reportService.getUserReport,
    staleTime: STALE,
    enabled,
  });
}

export function useUsageReportQuery(enabled = true) {
  return useQuery({
    queryKey: ['reports', 'usage'],
    queryFn: reportService.getUsageReport,
    staleTime: STALE,
    enabled,
  });
}

export function useDownloadReportCsv() {
  return useMutation({
    mutationFn: (type: ReportExportType) => reportService.downloadCsv(type),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Report downloaded', description: 'CSV export saved to your downloads.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Export failed', description: 'Could not download the CSV report.' });
    },
  });
}
