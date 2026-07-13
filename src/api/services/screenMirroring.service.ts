import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';

export type ScreenQuality = 'LOW' | 'MEDIUM' | 'HIGH';
export type ScreenSessionStatus = 'ACTIVE' | 'STOPPED' | 'ERROR';

export interface ScreenSession {
  id: number;
  deviceUuid: string;
  status: ScreenSessionStatus;
  qualityLevel: string | null;
  startedByEmail: string | null;
  startedAt: string;
  stoppedAt: string | null;
  durationSeconds: number | null;
}

export interface ScreenSessionPage {
  content: ScreenSession[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

const BASE = '/v1/screen-mirroring';

export const screenMirroringService = {
  async start(deviceUuid: string, quality: ScreenQuality): Promise<ScreenSession> {
    const res = await apiClient.post<ApiResponse<ScreenSession>>(`${BASE}/start`, { deviceUuid, quality });
    return res.data.data;
  },

  async stop(deviceUuid: string): Promise<ScreenSession> {
    const res = await apiClient.post<ApiResponse<ScreenSession>>(`${BASE}/stop`, { deviceUuid });
    return res.data.data;
  },

  async setQuality(deviceUuid: string, quality: ScreenQuality): Promise<ScreenSession> {
    const res = await apiClient.patch<ApiResponse<ScreenSession>>(
      `${BASE}/quality/${deviceUuid}`,
      null,
      { params: { quality } }
    );
    return res.data.data;
  },

  async status(deviceUuid: string): Promise<boolean> {
    const res = await apiClient.get<ApiResponse<boolean>>(`${BASE}/status/${deviceUuid}`);
    return res.data.data;
  },

  async sessions(deviceUuid: string, page = 0, size = 20): Promise<ScreenSessionPage> {
    const res = await apiClient.get<ApiResponse<ScreenSessionPage>>(
      `${BASE}/sessions/device/${deviceUuid}`,
      { params: { page, size } }
    );
    return res.data.data;
  },
};
