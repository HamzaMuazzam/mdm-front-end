import { apiClient } from '../client';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';
import type {
  AuditEvent, AuditExportJob, AuditFacets, AuditFilter, AuditHealth, AuditSettings, AuditSummary, AuditVerifyResult,
} from '@/types/audit.types';

function toParams(f: AuditFilter): Record<string, string | number | string[]> {
  const p: Record<string, string | number | string[]> = {};
  (Object.keys(f) as (keyof AuditFilter)[]).forEach((k) => {
    const v = f[k];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return;
    p[k] = v as string | number | string[];
  });
  return p;
}

// Spring binds List<String> from repeated params: ?category=A&category=B
const paramsSerializer = { indexes: null as null };

export const auditService = {
  async search(filter: AuditFilter): Promise<PaginatedResponse<AuditEvent>> {
    const res = await apiClient.get<ApiResponse<PaginatedResponse<AuditEvent>>>('/v1/audit-logs', {
      params: toParams(filter), paramsSerializer,
    });
    return res.data.data;
  },

  async byDevice(deviceId: number, filter: AuditFilter): Promise<PaginatedResponse<AuditEvent>> {
    const res = await apiClient.get<ApiResponse<PaginatedResponse<AuditEvent>>>(`/v1/audit-logs/device/${deviceId}`, {
      params: toParams(filter), paramsSerializer,
    });
    return res.data.data;
  },

  async get(id: number, ownerId?: string): Promise<{ event: AuditEvent; timeline: AuditEvent[] }> {
    const res = await apiClient.get<ApiResponse<{ event: AuditEvent; timeline: AuditEvent[] }>>(`/v1/audit-logs/${id}`, {
      params: ownerId ? { ownerId } : {},
    });
    return res.data.data;
  },

  async summary(filter: AuditFilter): Promise<AuditSummary> {
    const res = await apiClient.get<ApiResponse<AuditSummary>>('/v1/audit-logs/summary', { params: toParams(filter), paramsSerializer });
    return res.data.data;
  },

  async facets(filter: AuditFilter): Promise<AuditFacets> {
    const res = await apiClient.get<ApiResponse<AuditFacets>>('/v1/audit-logs/facets', { params: toParams(filter), paramsSerializer });
    return res.data.data;
  },

  async health(): Promise<AuditHealth> {
    const res = await apiClient.get<ApiResponse<AuditHealth>>('/v1/audit-logs/health');
    return res.data.data;
  },

  async verify(from: string, to: string, ownerId?: string): Promise<AuditVerifyResult> {
    const res = await apiClient.post<ApiResponse<AuditVerifyResult>>('/v1/audit-logs/verify', null, {
      params: { from, to, ...(ownerId ? { ownerId } : {}) },
    });
    return res.data.data;
  },

  /**
   * Server-streamed CSV / JSON Lines of the current filter (the export itself is audited).
   * Returns the job when the server queued an async export instead (HTTP 202, large result sets).
   */
  async download(filter: AuditFilter, format: 'csv' | 'jsonl'): Promise<AuditExportJob | null> {
    const response = await apiClient.get('/v1/audit-logs/export', {
      params: { ...toParams(filter), format }, paramsSerializer, responseType: 'blob',
    });
    if (response.status === 202) {
      const text = await (response.data as Blob).text();
      const parsed = JSON.parse(text) as ApiResponse<AuditExportJob>;
      return parsed.data;
    }
    const disposition = (response.headers['content-disposition'] as string | undefined) ?? '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const filename = match?.[1] ?? `audit-logs.${format}`;
    const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: format === 'csv' ? 'text/csv' : 'application/x-ndjson' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
    return null;
  },

  async exportJobs(): Promise<AuditExportJob[]> {
    const res = await apiClient.get<ApiResponse<AuditExportJob[]>>('/v1/audit-logs/export/jobs');
    return res.data.data;
  },

  async downloadJob(job: AuditExportJob): Promise<void> {
    const response = await apiClient.get(`/v1/audit-logs/export/jobs/${job.id}/download`, { responseType: 'blob' });
    const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/gzip' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', `audit-export-${job.id}.${job.format}.gz`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  async getSettings(): Promise<AuditSettings> {
    const res = await apiClient.get<ApiResponse<AuditSettings>>('/v1/audit-logs/settings');
    return res.data.data;
  },

  async updateSettings(s: AuditSettings): Promise<AuditSettings> {
    const res = await apiClient.put<ApiResponse<AuditSettings>>('/v1/audit-logs/settings', s);
    return res.data.data;
  },
};
