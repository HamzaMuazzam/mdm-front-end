import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';

export interface DeviceContact {
  id: number;
  deviceUuid: string;
  name: string;
  phoneNumber: string;
  normalizedPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceSms {
  id: number;
  deviceUuid: string;
  address: string;
  body: string | null;
  bodyHash: string;
  messageTimestamp: number;
  smsType: 'INBOX' | 'SENT';
  createdAt: string;
}

export interface DeviceCallLog {
  id: number;
  deviceUuid: string;
  phoneNumber: string;
  callType: 'INCOMING' | 'OUTGOING' | 'MISSED' | 'REJECTED' | 'UNKNOWN';
  duration: number;
  callTimestamp: number;
  createdAt: string;
}

export interface DeviceDataStats {
  contactCount: number;
  smsCount: number;
  callLogCount: number;
}

export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export type SyncType = 'sync_contacts' | 'sync_sms' | 'sync_calls' | 'sync_all';

export const deviceDataService = {
  async triggerSync(deviceUuid: string, type: SyncType): Promise<void> {
    await apiClient.post(`/v1/device-data/${deviceUuid}/sync`, { type });
  },

  async getStats(deviceUuid: string): Promise<DeviceDataStats> {
    const res = await apiClient.get<ApiResponse<DeviceDataStats>>(`/v1/device-data/${deviceUuid}/stats`);
    return res.data.data;
  },

  async getContacts(deviceUuid: string, page = 0, size = 50): Promise<SpringPage<DeviceContact>> {
    const res = await apiClient.get<ApiResponse<SpringPage<DeviceContact>>>(
      `/v1/device-data/${deviceUuid}/contacts`,
      { params: { page, size } }
    );
    return res.data.data;
  },

  async getSms(deviceUuid: string, page = 0, size = 50): Promise<SpringPage<DeviceSms>> {
    const res = await apiClient.get<ApiResponse<SpringPage<DeviceSms>>>(
      `/v1/device-data/${deviceUuid}/sms`,
      { params: { page, size } }
    );
    return res.data.data;
  },

  async getCalls(deviceUuid: string, page = 0, size = 50): Promise<SpringPage<DeviceCallLog>> {
    const res = await apiClient.get<ApiResponse<SpringPage<DeviceCallLog>>>(
      `/v1/device-data/${deviceUuid}/calls`,
      { params: { page, size } }
    );
    return res.data.data;
  },
};
