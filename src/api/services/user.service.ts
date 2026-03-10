import { apiClient } from '../client';
import type { UpdateUserRequest, ResetUserPasswordRequest } from '@/types/user.types';
import type { RegisterRequest } from '@/types/auth.types';
import type { User } from '@/types/auth.types';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';

export const userService = {
  async getAll(): Promise<User[]> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<User>>>('/v1/users');
    return response.data.data.content;
  },

  async createUser(data: RegisterRequest): Promise<ApiResponse<User>> {
    const response = await apiClient.post<ApiResponse<User>>('/v1/users', data);
    return response.data;
  },

  async updateUser(id: number, data: Omit<UpdateUserRequest, 'id'>): Promise<ApiResponse<User>> {
    const response = await apiClient.put<ApiResponse<User>>(`/v1/users/${id}`, data);
    return response.data;
  },

  async deleteUser(id: number, status: boolean): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(`/v1/users/${id}?status=${status}`);
    return response.data;
  },

  async resetUserPassword(data: ResetUserPasswordRequest): Promise<ApiResponse<void>> {
    const response = await apiClient.post<ApiResponse<void>>('/v1/users/reset_password', data);
    return response.data;
  },
};
