import { apiClient } from '../client';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';
import type { SecurityGroup, CreateSecurityGroupRequest, SecurityGroupPermissionMatrix } from '@/types/security-group.types';

export const securityGroupService = {
  async getAll(page = 0, size = 100): Promise<SecurityGroup[]> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<SecurityGroup>>>(
      `/v1/security-groups?page=${page}&size=${size}&sort=groupName,asc`
    );
    return response.data.data.content;
  },

  async create(data: CreateSecurityGroupRequest): Promise<ApiResponse<SecurityGroup>> {
    const response = await apiClient.post<ApiResponse<SecurityGroup>>('/v1/security-groups', data);
    return response.data;
  },

  async update(id: number, data: CreateSecurityGroupRequest): Promise<ApiResponse<SecurityGroup>> {
    const response = await apiClient.put<ApiResponse<SecurityGroup>>(`/v1/security-groups/${id}`, data);
    return response.data;
  },

  async getPermissions(securityGroupId: number): Promise<SecurityGroupPermissionMatrix> {
    const response = await apiClient.get<ApiResponse<SecurityGroupPermissionMatrix>>(
      `/v1/security-group-permissions/security-group/${securityGroupId}`
    );
    return response.data.data;
  },

  async addPermission(securityGroupId: number, permissionId: number): Promise<ApiResponse<unknown>> {
    const response = await apiClient.post<ApiResponse<unknown>>('/v1/security-group-permissions', {
      securityGroupId,
      permissionId,
    });
    return response.data;
  },

  async removePermission(permissionId: number, securityGroupId: number): Promise<ApiResponse<unknown>> {
    const response = await apiClient.delete<ApiResponse<unknown>>(
      `/v1/security-group-permissions/${permissionId}?securityGroupId=${securityGroupId}`
    );
    return response.data;
  },
};
