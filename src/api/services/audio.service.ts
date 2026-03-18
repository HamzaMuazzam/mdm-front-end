import { apiClient } from '../client';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';

export interface AudioSessionRecord {
  id: number;
  deviceUuid: string;
  status: 'ACTIVE' | 'STOPPED' | 'ERROR';
  startedByEmail: string | null;
  startedAt: string;
  stoppedAt: string | null;
  durationSeconds: number | null;
}

export const audioService = {
  async startListen(deviceUuid: string): Promise<AudioSessionRecord> {
    const response = await apiClient.post<ApiResponse<AudioSessionRecord>>('/v1/audio/start', { deviceUuid });
    return response.data.data;
  },

  async stopListen(deviceUuid: string): Promise<AudioSessionRecord> {
    const response = await apiClient.post<ApiResponse<AudioSessionRecord>>('/v1/audio/stop', { deviceUuid });
    return response.data.data;
  },

  async isActive(deviceUuid: string): Promise<boolean> {
    const response = await apiClient.get<ApiResponse<boolean>>(`/v1/audio/status/${deviceUuid}`);
    return response.data.data;
  },

  async getSessions(deviceUuid: string, page = 0, size = 20): Promise<PaginatedResponse<AudioSessionRecord>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<AudioSessionRecord>>>(
      `/v1/audio/sessions/device/${deviceUuid}`,
      { params: { page, size } }
    );
    return response.data.data;
  },
};
