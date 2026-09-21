import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';

export type DeviceLogStatus =
  | 'REQUESTED'
  | 'CAPTURING'
  | 'UPLOADING'
  | 'COMPLETED'
  | 'FAILED';

export interface DeviceLogRequest {
  id: string;
  deviceUuid: string;
  status: DeviceLogStatus;
  /** Directory the OS app wrote the raw capture to on the device. */
  capturePath: string | null;
  /** Files inside that directory, as counted on the device. */
  fileCount: number | null;
  /** Uncompressed size on the device, in bytes. */
  rawSize: number | null;
  fileName: string | null;
  /** Size of the stored zip bundle, in bytes. */
  fileSize: number | null;
  errorMessage: string | null;
  requestedByEmail: string | null;
  createdAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
}

export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

const BASE = '/v1/device-logs';

export const deviceLogsService = {
  /** Ask a device to capture its OS system logs. Resolves as soon as the command is queued. */
  async collect(deviceUuid: string): Promise<DeviceLogRequest> {
    const res = await apiClient.post<ApiResponse<DeviceLogRequest>>(
      `${BASE}/${deviceUuid}/collect`
    );
    return res.data.data;
  },

  async list(deviceUuid: string, page = 0, size = 20): Promise<SpringPage<DeviceLogRequest>> {
    const res = await apiClient.get<ApiResponse<SpringPage<DeviceLogRequest>>>(
      `${BASE}/${deviceUuid}`,
      { params: { page, size } }
    );
    return res.data.data;
  },

  async get(requestId: string): Promise<DeviceLogRequest> {
    const res = await apiClient.get<ApiResponse<DeviceLogRequest>>(
      `${BASE}/requests/${requestId}`
    );
    return res.data.data;
  },

  async remove(requestId: string): Promise<void> {
    await apiClient.delete(`${BASE}/requests/${requestId}`);
  },

  /** Streams the bundle through the authenticated client, then saves it from the blob. */
  async download(requestId: string, fileName: string): Promise<void> {
    const response = await apiClient.get(`${BASE}/requests/${requestId}/download`, {
      responseType: 'blob',
    });

    const blobUrl = window.URL.createObjectURL(
      new Blob([response.data], { type: 'application/zip' })
    );
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName || `device-logs-${requestId}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  },
};
