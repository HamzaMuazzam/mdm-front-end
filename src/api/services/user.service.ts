import { apiClient } from '../client';
import type { Manager, CreateManagerRequest, UpdateManagerRequest } from '@/types/user.types';
import type { ApiResponse } from '@/types/api.types';

export const userService = {
  async getAllManagers(): Promise<Manager[]> {
    const response = await apiClient.get<ApiResponse<Manager[]>>(
      '/v1/users/get-all-managers-by-user-id'
    );
    return response.data.data;
  },

  async createManager(data: CreateManagerRequest): Promise<ApiResponse<Manager>> {
    const response = await apiClient.post<ApiResponse<Manager>>('/v1/users/create-manager', data);
    return response.data;
  },

  async updateUser(id: number, data: UpdateManagerRequest): Promise<ApiResponse<Manager>> {
    const response = await apiClient.put<ApiResponse<Manager>>(`/v1/users/${id}`, data);
    return response.data;
  },

  async deleteUser(id: number): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(`/v1/users/${id}`);
    return response.data;
  },
};
