import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';
import type {
  ApplicationReport,
  DeviceComplianceReport,
  ReportExportType,
  ReportOverview,
  SecurityReport,
  UsageReport,
  UserReport,
} from '@/types/report.types';

export const reportService = {
  async getOverview(): Promise<ReportOverview> {
    const res = await apiClient.get<ApiResponse<ReportOverview>>('/v1/reports/overview');
    return res.data.data;
  },

  async getDeviceReport(): Promise<DeviceComplianceReport> {
    const res = await apiClient.get<ApiResponse<DeviceComplianceReport>>('/v1/reports/devices');
    return res.data.data;
  },

  async getSecurityReport(): Promise<SecurityReport> {
    const res = await apiClient.get<ApiResponse<SecurityReport>>('/v1/reports/security');
    return res.data.data;
  },

  async getApplicationReport(): Promise<ApplicationReport> {
    const res = await apiClient.get<ApiResponse<ApplicationReport>>('/v1/reports/applications');
    return res.data.data;
  },

  async getUserReport(): Promise<UserReport> {
    const res = await apiClient.get<ApiResponse<UserReport>>('/v1/reports/users');
    return res.data.data;
  },

  async getUsageReport(): Promise<UsageReport> {
    const res = await apiClient.get<ApiResponse<UsageReport>>('/v1/reports/usage');
    return res.data.data;
  },

  /** Server-side CSV download (audit-grade export straight from the backend). */
  async downloadCsv(type: ReportExportType): Promise<void> {
    const response = await apiClient.get(`/v1/reports/export/${type}`, {
      responseType: 'blob',
    });
    const disposition = (response.headers['content-disposition'] as string | undefined) ?? '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const filename = match?.[1] ?? `mdm-${type}-report.csv`;

    const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  },
};
