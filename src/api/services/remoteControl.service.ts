import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';

export type RemoteControlStatusValue = 'ACTIVE' | 'ENDED' | 'ERROR';
export type VideoMode = 'WEBRTC' | 'JPEG' | 'UNKNOWN';

export interface IceServer {
  urls: string[];
  username?: string | null;
  credential?: string | null;
}

export interface RemoteControlSession {
  id: number;
  sessionId: string;
  deviceUuid: string;
  deviceName: string | null;
  status: RemoteControlStatusValue;
  videoMode: VideoMode;
  inputEventCount: number | null;
  qualityLevel: string | null;
  initiatedByEmail: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  endReason: string | null;
  /** Present only on start(). */
  iceServers?: IceServer[];
}

export interface RemoteControlSessionPage {
  content: RemoteControlSession[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

const BASE = '/v1/remote-control';

export const remoteControlService = {
  async start(deviceUuid: string, quality: 'LOW' | 'MEDIUM' | 'HIGH'): Promise<RemoteControlSession> {
    const res = await apiClient.post<ApiResponse<RemoteControlSession>>(`${BASE}/start`, { deviceUuid, quality });
    return res.data.data;
  },
  async stop(deviceUuid: string): Promise<RemoteControlSession> {
    const res = await apiClient.post<ApiResponse<RemoteControlSession>>(`${BASE}/stop`, { deviceUuid });
    return res.data.data;
  },
  async status(deviceUuid: string): Promise<boolean> {
    const res = await apiClient.get<ApiResponse<boolean>>(`${BASE}/status/${deviceUuid}`);
    return res.data.data;
  },
  async sessions(deviceUuid: string, page = 0, size = 20): Promise<RemoteControlSessionPage> {
    const res = await apiClient.get<ApiResponse<RemoteControlSessionPage>>(`${BASE}/sessions/device/${deviceUuid}`, {
      params: { page, size },
    });
    return res.data.data;
  },
};
