import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';
import type { SpringPage } from '@/types/bulk.types';
import type {
  AppControlAction,
  AppControlBatch,
  AppControlCommand,
  AppControlPreview,
  AppControlRequest,
  AppControlStatus,
} from '@/types/appControl.types';

const BASE = '/v1/app-control';

/** Remote App Control: one request shape for one app on one device up to many apps on a fleet. */
export const appControlService = {
  /** Dry run — nothing is sent to any device. */
  async preview(req: AppControlRequest): Promise<AppControlPreview> {
    const res = await apiClient.post<ApiResponse<AppControlPreview>>(`${BASE}/preview`, req);
    return res.data.data;
  },

  async execute(req: AppControlRequest): Promise<AppControlBatch> {
    const res = await apiClient.post<ApiResponse<AppControlBatch>>(`${BASE}/commands`, req);
    return res.data.data;
  },

  async retry(batchId: number): Promise<AppControlBatch> {
    const res = await apiClient.post<ApiResponse<AppControlBatch>>(`${BASE}/batches/${batchId}/retry`);
    return res.data.data;
  },

  async listBatches(params: { page?: number; size?: number; action?: AppControlAction }): Promise<SpringPage<AppControlBatch>> {
    const res = await apiClient.get<ApiResponse<SpringPage<AppControlBatch>>>(`${BASE}/batches`, { params });
    return res.data.data;
  },

  async getBatch(batchId: number): Promise<AppControlBatch> {
    const res = await apiClient.get<ApiResponse<AppControlBatch>>(`${BASE}/batches/${batchId}`);
    return res.data.data;
  },

  async listBatchCommands(
    batchId: number,
    params: { page?: number; size?: number; status?: AppControlStatus[] }
  ): Promise<SpringPage<AppControlCommand>> {
    const res = await apiClient.get<ApiResponse<SpringPage<AppControlCommand>>>(`${BASE}/batches/${batchId}/commands`, {
      params: { page: params.page, size: params.size, status: params.status?.length ? params.status.join(',') : undefined },
    });
    return res.data.data;
  },

  async listDeviceCommands(deviceUuid: string, params: { page?: number; size?: number }): Promise<SpringPage<AppControlCommand>> {
    const res = await apiClient.get<ApiResponse<SpringPage<AppControlCommand>>>(
      `${BASE}/device/${encodeURIComponent(deviceUuid)}/commands`,
      { params }
    );
    return res.data.data;
  },
};
