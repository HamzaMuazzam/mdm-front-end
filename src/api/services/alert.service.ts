import { apiClient } from '../client';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';

export interface SendAlertRequest {
  deviceUuid: string;
  title: string;
  message?: string;
  sound?: string;
  duration?: number;
  vibrationPattern?: number[];
}

export interface AlertRecord {
  id: number;
  deviceUuid: string;
  title: string;
  message: string | null;
  sound: string | null;
  duration: number | null;
  vibrationPattern: string | null;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'ACKNOWLEDGED';
  errorMessage: string | null;
  sentByEmail: string | null;
  createdAt: string;
  sentAt: string | null;
  acknowledgedAt: string | null;
}

export const alertService = {
  async sendAlert(request: SendAlertRequest): Promise<AlertRecord> {
    const response = await apiClient.post<ApiResponse<AlertRecord>>('/v1/alerts/send', request);
    return response.data.data;
  },

  async getAlert(id: number): Promise<AlertRecord> {
    const response = await apiClient.get<ApiResponse<AlertRecord>>(`/v1/alerts/${id}`);
    return response.data.data;
  },

  async getAlertsByDevice(deviceUuid: string, page = 0, size = 20): Promise<PaginatedResponse<AlertRecord>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<AlertRecord>>>(
      `/v1/alerts/device/${deviceUuid}`,
      { params: { page, size } }
    );
    return response.data.data;
  },

  async getAllAlerts(page = 0, size = 20): Promise<PaginatedResponse<AlertRecord>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<AlertRecord>>>(
      '/v1/alerts',
      { params: { page, size } }
    );
    return response.data.data;
  },
};
