import { apiClient } from '../client';
import type { BulkTarget } from '@/types/bulk.types';
import type { ApiResponse } from '@/types/api.types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimeRangeRequest {
  startTime: string;   // "HH:mm" 24-hour
  endTime: string;     // "HH:mm" 24-hour
  timezone?: string;   // IANA tz or "device" (default)
  enabled?: boolean;
}

export interface TimeRangeBulkRequest {
  /** Legacy explicit list — prefer `target`. */
  deviceUuids?: string[];
  /** Groups and/or devices to assign the time range to. */
  target?: BulkTarget;
  startTime: string;
  endTime: string;
  timezone?: string;
  enabled?: boolean;
}

export interface TimeRangeRecord {
  id: number;
  deviceUuid: string;
  startTime: string;
  endTime: string;
  timezone: string;
  enabled: boolean;
  assignedByEmail: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const timeRangeService = {
  /**
   * Assign (or update) a time range for a single device.
   */
  async assign(deviceUuid: string, request: TimeRangeRequest): Promise<TimeRangeRecord> {
    const response = await apiClient.post<ApiResponse<TimeRangeRecord>>(
      `/v1/time-range/${deviceUuid}`,
      request
    );
    return response.data.data;
  },

  /**
   * Bulk assign the same time range to multiple devices.
   */
  async bulkAssign(request: TimeRangeBulkRequest): Promise<TimeRangeRecord[]> {
    const response = await apiClient.post<ApiResponse<TimeRangeRecord[]>>(
      '/v1/time-range/bulk',
      request
    );
    return response.data.data;
  },

  /**
   * Get the current time range config for a device.
   */
  async get(deviceUuid: string): Promise<TimeRangeRecord> {
    const response = await apiClient.get<ApiResponse<TimeRangeRecord>>(
      `/v1/time-range/${deviceUuid}`
    );
    return response.data.data;
  },

  /**
   * List all time ranges across all devices.
   */
  async listAll(): Promise<TimeRangeRecord[]> {
    const response = await apiClient.get<ApiResponse<TimeRangeRecord[]>>('/v1/time-range');
    return response.data.data;
  },

  /**
   * Remove a device's time range (device returns to always-accessible).
   */
  async remove(deviceUuid: string): Promise<void> {
    await apiClient.delete(`/v1/time-range/${deviceUuid}`);
  },

  /**
   * Enable or disable a time range without deleting it.
   */
  async setEnabled(deviceUuid: string, enabled: boolean): Promise<TimeRangeRecord> {
    const response = await apiClient.patch<ApiResponse<TimeRangeRecord>>(
      `/v1/time-range/${deviceUuid}/enabled`,
      { enabled }
    );
    return response.data.data;
  },
};
