import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';
import type { AppUpdate, UpdateHistoryResponse, UpdatePlatform } from '@/types/app-update.types';

export const appUpdateService = {
  async uploadUpdate(formData: FormData): Promise<ApiResponse<AppUpdate>> {
    const response = await apiClient.post<ApiResponse<AppUpdate>>('/v1/updates/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async notifyUsers(platform: UpdatePlatform): Promise<ApiResponse<void>> {
    const response = await apiClient.post<ApiResponse<void>>('/v1/updates/notify', { platform });
    return response.data;
  },

  async getLatestUpdate(platform: UpdatePlatform): Promise<ApiResponse<AppUpdate>> {
    const response = await apiClient.get<ApiResponse<AppUpdate>>(`/v1/updates/latest?platform=${platform}`);
    return response.data;
  },

  async getUpdateHistory(
    platform: UpdatePlatform,
    page: number = 0,
    size: number = 10
  ): Promise<ApiResponse<UpdateHistoryResponse>> {
    const response = await apiClient.get<ApiResponse<UpdateHistoryResponse>>(
      `/v1/updates/history?platform=${platform}&page=${page}&size=${size}`
    );
    return response.data;
  },

  async downloadUpdate(downloadUrl: string, filename: string): Promise<void> {
    const url = new URL(downloadUrl);
    const response = await apiClient.get(url.pathname, { responseType: 'blob' });
    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  },
};
