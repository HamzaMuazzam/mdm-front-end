import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';
import type { DeviceGroup, DeviceGroupMembersRequest, DeviceGroupRequest } from '@/types/bulk.types';

const BASE = '/v1/device-groups';

/** Account-scoped device groups (the system "All" group is always first). */
export const deviceGroupService = {
  async list(): Promise<DeviceGroup[]> {
    const res = await apiClient.get<ApiResponse<DeviceGroup[]>>(BASE);
    return res.data.data;
  },

  async get(id: number): Promise<DeviceGroup> {
    const res = await apiClient.get<ApiResponse<DeviceGroup>>(`${BASE}/${id}`);
    return res.data.data;
  },

  /** Custom-group ids one device belongs to. */
  async groupIdsOfDevice(deviceUuid: string): Promise<number[]> {
    const res = await apiClient.get<ApiResponse<number[]>>(`${BASE}/device/${encodeURIComponent(deviceUuid)}`);
    return res.data.data;
  },

  async create(req: DeviceGroupRequest): Promise<DeviceGroup> {
    const res = await apiClient.post<ApiResponse<DeviceGroup>>(BASE, req);
    return res.data.data;
  },

  async update(id: number, req: DeviceGroupRequest): Promise<DeviceGroup> {
    const res = await apiClient.put<ApiResponse<DeviceGroup>>(`${BASE}/${id}`, req);
    return res.data.data;
  },

  /** Incremental add/remove — preferred over `update` for membership changes. */
  async updateMembers(id: number, req: DeviceGroupMembersRequest): Promise<DeviceGroup> {
    const res = await apiClient.patch<ApiResponse<DeviceGroup>>(`${BASE}/${id}/devices`, req);
    return res.data.data;
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(`${BASE}/${id}`);
  },
};
