import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';
import type {
  AppUpdate,
  AppUpdateTarget,
  ReleaseUpdateRequest,
  ReleaseUpdateResult,
  UpdateHistoryResponse,
  UpdatePlatform,
} from '@/types/app-update.types';

export const appUpdateService = {
  async uploadUpdate(formData: FormData): Promise<ApiResponse<AppUpdate>> {
    const response = await apiClient.post<ApiResponse<AppUpdate>>('/v1/updates/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * "Release to…": records the targets against the active release and nudges the resolved devices.
   * Devices outside the targets never receive the release (their periodic check honours the same targets).
   */
  async release(request: ReleaseUpdateRequest): Promise<ApiResponse<ReleaseUpdateResult[]>> {
    const response = await apiClient.post<ApiResponse<ReleaseUpdateResult[]>>('/v1/updates/notify', request);
    return response.data;
  },

  /** Legacy helper — releases to the caller's whole account. */
  async notifyUsers(platform: UpdatePlatform): Promise<ApiResponse<ReleaseUpdateResult[]>> {
    return this.release({ platform });
  },

  /** Device-facing check (target-filtered; admin screens should use getCurrentRelease). */
  async getLatestUpdate(platform: UpdatePlatform): Promise<ApiResponse<AppUpdate>> {
    const response = await apiClient.get<ApiResponse<AppUpdate>>(`/v1/updates/latest?platform=${platform}`);
    return response.data;
  },

  /** Admin: the active release of a platform with its release targets. */
  async getCurrentRelease(platform: UpdatePlatform): Promise<ApiResponse<AppUpdate | null>> {
    const response = await apiClient.get<ApiResponse<AppUpdate | null>>(`/v1/updates/current?platform=${platform}`);
    return response.data;
  },

  async getTargets(updateId: number): Promise<ApiResponse<AppUpdateTarget[]>> {
    const response = await apiClient.get<ApiResponse<AppUpdateTarget[]>>(`/v1/updates/${updateId}/targets`);
    return response.data;
  },

  async removeTarget(updateId: number, targetId: number): Promise<ApiResponse<AppUpdateTarget[]>> {
    const response = await apiClient.delete<ApiResponse<AppUpdateTarget[]>>(`/v1/updates/${updateId}/targets/${targetId}`);
    return response.data;
  },

  async getUpdateHistory(
    platform: UpdatePlatform,
    page: number = 0,
    size: number = 10
  ): Promise<ApiResponse<UpdateHistoryResponse>> {
    const response = await apiClient.get<ApiResponse<UpdateHistoryResponse>>(
      `/v1/updates/history?platform=${platform}&page=${page}&size=${size}`
    );
    return response.data;
  },

  async downloadUpdate(downloadUrl: string, filename: string): Promise<void> {
    const url = new URL(downloadUrl);
    const response = await apiClient.get(url.pathname, { responseType: 'blob' });
    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  },
};
