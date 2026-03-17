import { apiClient } from '../client';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';
import type { DeviceNotification, NotificationQuery, NotificationSettings } from '@/types/notification.types';

export const notificationService = {
  async getNotifications(deviceId: number, params?: NotificationQuery): Promise<PaginatedResponse<DeviceNotification>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<DeviceNotification>>>(`/v1/notifications/${deviceId}`, {
      params,
    });
    return response.data.data;
  },

  async getSettings(deviceId: number): Promise<NotificationSettings> {
    const response = await apiClient.get<ApiResponse<NotificationSettings>>(`/v1/notifications/settings/${deviceId}`);
    return response.data.data;
  },

  async updateSettings(deviceId: number, alertsEnabled: boolean): Promise<NotificationSettings> {
    const response = await apiClient.put<ApiResponse<NotificationSettings>>(`/v1/notifications/settings/${deviceId}`, {
      alertsEnabled,
    });
    return response.data.data;
  },
};
