import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';

export interface SslPinningPolicy {
  id: number;
  targetDomain: string;
  pinValue: string;
  isEnabled: boolean;
  deviceUuid: string | null;
  groupId: number | null;
  scope: 'DEVICE' | 'GROUP';
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SslPinningPolicyRequest {
  id?: number;
  targetDomain: string;
  pinValue: string;
  isEnabled?: boolean;
  deviceUuid?: string;
  groupId?: number;
}

export interface SslPinEntryInput {
  targetDomain: string;
  pinValue: string;
  isEnabled?: boolean;
}

export interface SslPinningBulkRequest {
  deviceUuids: string[];
  pins: SslPinEntryInput[];
}

export interface SslPinningBulkResult {
  deviceUuid: string;
  success: boolean;
  added: number;
  skipped: number;
  message: string;
}

const BASE = '/v1/mdm/ssl-pinning';

export const sslPinningService = {
  async listByDevice(deviceUuid: string): Promise<SslPinningPolicy[]> {
    const res = await apiClient.get<ApiResponse<SslPinningPolicy[]>>(`${BASE}/device/${deviceUuid}`);
    return res.data.data;
  },

  async createOrUpdate(payload: SslPinningPolicyRequest): Promise<SslPinningPolicy> {
    const res = await apiClient.post<ApiResponse<SslPinningPolicy>>(`${BASE}/config`, payload);
    return res.data.data;
  },

  async toggle(id: number, enabled: boolean): Promise<SslPinningPolicy> {
    const res = await apiClient.post<ApiResponse<SslPinningPolicy>>(
      `${BASE}/${id}/toggle`,
      null,
      { params: { enabled } }
    );
    return res.data.data;
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
  },

  async bulkAssign(payload: SslPinningBulkRequest): Promise<SslPinningBulkResult[]> {
    const res = await apiClient.post<ApiResponse<SslPinningBulkResult[]>>(`${BASE}/bulk`, payload);
    return res.data.data;
  },
};
