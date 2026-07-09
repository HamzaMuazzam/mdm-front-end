import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';

export type SimEventType = 'INSERTED' | 'REMOVED' | 'SWAPPED' | 'ABSENT' | 'UNKNOWN';

export interface SimChangeEvent {
  id: number;
  deviceUuid: string;
  eventType: SimEventType;
  slotIndex: number | null;
  subscriptionId: number | null;
  carrierName: string | null;
  displayName: string | null;
  countryIso: string | null;
  phoneNumber: string | null;
  iccid: string | null;
  imsi: string | null;
  simState: string | null;
  securityAlert: boolean;
  eventTimestamp: number;
  createdAt: string;
}

export interface SimChangeStats {
  totalEvents: number;
  securityAlerts: number;
  lastChangeAt: number | null;
}

export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export const simChangeService = {
  async getEvents(
    deviceUuid: string,
    page = 0,
    size = 50,
    securityOnly = false
  ): Promise<SpringPage<SimChangeEvent>> {
    const res = await apiClient.get<ApiResponse<SpringPage<SimChangeEvent>>>(
      `/v1/sim-changes/${deviceUuid}/events`,
      { params: { page, size, securityOnly } }
    );
    return res.data.data;
  },

  async getStats(deviceUuid: string): Promise<SimChangeStats> {
    const res = await apiClient.get<ApiResponse<SimChangeStats>>(
      `/v1/sim-changes/${deviceUuid}/stats`
    );
    return res.data.data;
  },
};
