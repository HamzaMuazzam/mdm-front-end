import { apiClient } from '../client';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';
import type {
  ManagedApp,
  AppCommand,
  InstallRequest,
  UninstallRequest,
} from '@/types/app-management.types';

export const appManagementService = {
  async uploadApp(formData: FormData): Promise<ApiResponse<ManagedApp>> {
    const response = await apiClient.post<ApiResponse<ManagedApp>>(
      '/v1/app-management/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  async getAllApps(page = 0, size = 10): Promise<ApiResponse<PaginatedResponse<ManagedApp>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<ManagedApp>>>(
      `/v1/app-management?page=${page}&size=${size}`
    );
    return response.data;
  },

  async getAppById(id: number): Promise<ApiResponse<ManagedApp>> {
    const response = await apiClient.get<ApiResponse<ManagedApp>>(`/v1/app-management/${id}`);
    return response.data;
  },

  async getAppsByPackage(
    packageName: string,
    page = 0,
    size = 10
  ): Promise<ApiResponse<PaginatedResponse<ManagedApp>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<ManagedApp>>>(
      `/v1/app-management/package/${encodeURIComponent(packageName)}?page=${page}&size=${size}`
    );
    return response.data;
  },

  async downloadApp(filename: string): Promise<void> {
    const response = await apiClient.get(`/v1/app-management/download/${encodeURIComponent(filename)}`, {
      responseType: 'blob',
    });
    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  async installApp(data: InstallRequest): Promise<ApiResponse<AppCommand[]>> {
    const response = await apiClient.post<ApiResponse<AppCommand[]>>(
      '/v1/app-management/install',
      data
    );
    return response.data;
  },

  async uninstallApp(data: UninstallRequest): Promise<ApiResponse<AppCommand[]>> {
    const response = await apiClient.post<ApiResponse<AppCommand[]>>(
      '/v1/app-management/uninstall',
      data
    );
    return response.data;
  },

  async getAllCommands(page = 0, size = 10): Promise<ApiResponse<PaginatedResponse<AppCommand>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<AppCommand>>>(
      `/v1/app-management/commands?page=${page}&size=${size}`
    );
    return response.data;
  },

  async getCommandsByDevice(
    deviceUuid: string,
    page = 0,
    size = 10
  ): Promise<ApiResponse<PaginatedResponse<AppCommand>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<AppCommand>>>(
      `/v1/app-management/commands/device/${deviceUuid}?page=${page}&size=${size}`
    );
    return response.data;
  },

  async getCommandsByPackage(
    packageName: string,
    page = 0,
    size = 10
  ): Promise<ApiResponse<PaginatedResponse<AppCommand>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<AppCommand>>>(
      `/v1/app-management/commands/package/${encodeURIComponent(packageName)}?page=${page}&size=${size}`
    );
    return response.data;
  },
};
