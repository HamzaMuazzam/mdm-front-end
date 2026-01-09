import { apiClient } from '../client';
import type { Device, CreateDeviceRequest, UpdateDeviceRequest } from '@/types/device.types';
import type { ApiResponse } from '@/types/api.types';

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

  async deleteDevice(id: number): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(`/v1/devices/${id}`);
    return response.data;
  },
};
