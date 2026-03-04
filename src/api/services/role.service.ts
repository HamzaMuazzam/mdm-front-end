import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';
import type { Role, CreateRoleRequest } from '@/types/role.types';

export const roleService = {
  async getAll(): Promise<Role[]> {
    const response = await apiClient.get<ApiResponse<Role[]>>('/v1/roles/list');
    return response.data.data;
  },

  async create(data: CreateRoleRequest): Promise<ApiResponse<Role>> {
    const response = await apiClient.post<ApiResponse<Role>>('/v1/roles', data);
    return response.data;
  },

  async updateSecurityGroup(roleId: number, securityGroupId: number): Promise<ApiResponse<Role>> {
    const response = await apiClient.put<ApiResponse<Role>>(
      `/v1/roles/${roleId}/security-group/${securityGroupId}`
    );
    return response.data;
  },
};
