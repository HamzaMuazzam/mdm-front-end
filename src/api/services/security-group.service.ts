import { apiClient } from '../client';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';
import type { SecurityGroup, CreateSecurityGroupRequest, SecurityGroupPermissionMatrix, MoveSecurityGroupUsersRequest, MoveSecurityGroupUsersResponse } from '@/types/security-group.types';
import type { User } from '@/types/auth.types';

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

  async getUserPermissions(userId: number): Promise<SecurityGroupPermissionMatrix> {
    const response = await apiClient.get<ApiResponse<SecurityGroupPermissionMatrix>>(
      `/v1/security-group-permissions/user/${userId}`
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

  /** Users assigned to the group (scoped to the caller's account). */
  async getMembers(securityGroupId: number, page = 0, size = 200): Promise<User[]> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<User>>>(
      `/v1/security-groups/${securityGroupId}/users`, { params: { page, size } }
    );
    return response.data.data.content;
  },

  /** Users under the caller that are not yet in the group — for the "Add users" picker. */
  async getEligibleUsers(securityGroupId: number): Promise<User[]> {
    const response = await apiClient.get<ApiResponse<User[]>>(`/v1/security-groups/${securityGroupId}/eligible-users`);
    return response.data.data;
  },

  /** Bulk move / add / unassign. Pass the group's own id as target to add users to it. */
  async moveUsers(securityGroupId: number, data: MoveSecurityGroupUsersRequest): Promise<MoveSecurityGroupUsersResponse> {
    const response = await apiClient.patch<ApiResponse<MoveSecurityGroupUsersResponse>>(
      `/v1/security-groups/${securityGroupId}/users`, data
    );
    return response.data.data;
  },

  async removePermission(permissionId: number, securityGroupId: number): Promise<ApiResponse<unknown>> {
    const response = await apiClient.delete<ApiResponse<unknown>>(
      `/v1/security-group-permissions/${permissionId}?securityGroupId=${securityGroupId}`
    );
    return response.data;
  },
};
