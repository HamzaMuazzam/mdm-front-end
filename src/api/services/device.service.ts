import { apiClient } from '../client';
import type { Device, CreateDeviceRequest, UpdateDeviceRequest, DeviceConfiguration, UpdateDeviceConfigurationRequest, ConfigEnumItem, DeviceApplication, UpdateDeviceApplicationRequest, BlockedAppRequest, BlockedAppReviewRequest, DeviceDashboardAnalytics, DeviceMonitorStateDashboard, DeviceAppUsageHistoryItem, DeviceAppUsageHistoryQuery, ApplyDevicePolicyRequest, ApplyPolicyResult } from '@/types/device.types';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';

export const deviceService = {
  async getAllDevices(): Promise<Device[]> {
    const response = await apiClient.get<ApiResponse<Device[]>>('/v1/devices/get-all-devices');
    return response.data.data;
  },

  async createDevice(data: CreateDeviceRequest): Promise<ApiResponse<Device>> {
    const response = await apiClient.post<ApiResponse<Device>>('/v1/devices', data);
    return response.data;
  },

  async updateDevice(id: number, data: UpdateDeviceRequest): Promise<ApiResponse<Device>> {
    const response = await apiClient.put<ApiResponse<Device>>(`/v1/devices/${id}`, data);
    return response.data;
  },

  async toggleDeviceStatus(id: number, isActive: boolean): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(`/v1/devices/${id}?isActive=${isActive}`);
    return response.data;
  },

  async getDeviceConfiguration(deviceId: number): Promise<DeviceConfiguration> {
    const response = await apiClient.get<ApiResponse<DeviceConfiguration>>(`/v1/configurations/device/${deviceId}`);
    return response.data.data;
  },

  async updateDeviceConfiguration(configId: number, data: UpdateDeviceConfigurationRequest): Promise<ApiResponse<DeviceConfiguration>> {
    const response = await apiClient.put<ApiResponse<DeviceConfiguration>>(`/v1/configurations/${configId}`, data);
    return response.data;
  },

  /** Apply root-detection / OS-upgrade policy to one or many devices (per-device or bulk). */
  async applyDevicePolicy(payload: ApplyDevicePolicyRequest): Promise<ApplyPolicyResult[]> {
    const response = await apiClient.post<ApiResponse<ApplyPolicyResult[]>>('/v1/configurations/policy', payload);
    return response.data.data;
  },

  // Configuration Enum APIs
  async getApplicationPermissionGranters(): Promise<ConfigEnumItem[]> {
    const response = await apiClient.get<ApiResponse<ConfigEnumItem[]>>('/v1/configurations/enums/application-permission-granters');
    return response.data.data;
  },

  async getFeatureStates(): Promise<ConfigEnumItem[]> {
    const response = await apiClient.get<ApiResponse<ConfigEnumItem[]>>('/v1/configurations/enums/feature-states');
    return response.data.data;
  },

  async getLocationTrackingTypes(): Promise<ConfigEnumItem[]> {
    const response = await apiClient.get<ApiResponse<ConfigEnumItem[]>>('/v1/configurations/enums/location-tracking-types');
    return response.data.data;
  },

  async getPushNotificationProtocols(): Promise<ConfigEnumItem[]> {
    const response = await apiClient.get<ApiResponse<ConfigEnumItem[]>>('/v1/configurations/enums/push-notification-protocols');
    return response.data.data;
  },

  async getParentConfiguration(): Promise<DeviceConfiguration> {
    const response = await apiClient.get<ApiResponse<DeviceConfiguration>>('/v1/configurations/parent/admin');
    return response.data.data;
  },

  async getDeviceApplications(deviceId: number): Promise<DeviceApplication[]> {
    const response = await apiClient.get<ApiResponse<DeviceApplication[]>>(`/v1/device-applications/device/${deviceId}`);
    return response.data.data;
  },

  async updateDeviceApplication(appId: number, data: UpdateDeviceApplicationRequest): Promise<ApiResponse<DeviceApplication>> {
    try {
      const response = await apiClient.put<ApiResponse<DeviceApplication>>(`/v1/device-applications/${appId}`, data);
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404 || status === 405) {
        const fallbackResponse = await apiClient.put<ApiResponse<DeviceApplication>>('/v1/device-applications', data);
        return fallbackResponse.data;
      }
      throw error;
    }
  },

  async getBlockedAppRequests(deviceId: number): Promise<BlockedAppRequest[]> {
    const response = await apiClient.get<ApiResponse<BlockedAppRequest[]>>(`/v1/blocked-app-requests/device/${deviceId}`);
    return response.data.data;
  },

  async reviewBlockedAppRequest(requestId: number, data: BlockedAppReviewRequest): Promise<ApiResponse<BlockedAppRequest>> {
    const response = await apiClient.put<ApiResponse<BlockedAppRequest>>(`/v1/blocked-app-requests/${requestId}/review`, data);
    return response.data;
  },

  async getDashboardAnalytics(): Promise<DeviceDashboardAnalytics> {
    const response = await apiClient.get<ApiResponse<DeviceDashboardAnalytics>>('/v1/devices/dashboard/analytics');
    return response.data.data;
  },

  async getDeviceMonitorStateDashboard(deviceUuid: string): Promise<DeviceMonitorStateDashboard> {
    const response = await apiClient.get<ApiResponse<DeviceMonitorStateDashboard>>(
      `/v1/devices/monit/${deviceUuid}/state/dashboard`
    );
    return response.data.data;
  },

  async getDeviceAppUsageHistory(
    deviceUuid: string,
    params?: DeviceAppUsageHistoryQuery
  ): Promise<PaginatedResponse<DeviceAppUsageHistoryItem>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<DeviceAppUsageHistoryItem>>>(
      `/v1/devices/monit/${deviceUuid}/app-usage/history`,
      { params }
    );
    return response.data.data;
  },
};
