import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';

export interface HistoryPoint {
  id: number;
  latitude: number;
  longitude: number;
  speed: number;
  accuracy: number;
  bearing: number;
  altitude: number;
  availableSatellite: number;
  connectedSatellite: number;
  deviceRdt: string;
  gpsRdt: string;
  receivedAt: string;
  uploadRetryCount: number;
  provider: string;
  versionNo: string;
  igStatus: number;
  reason: string;
  localPrimaryId: number;
}

export interface HistoryPageable {
  paged: boolean;
  unpaged: boolean;
  pageNumber: number;
  pageSize: number;
  offset: number;
  sort: { sorted: boolean; unsorted: boolean; empty: boolean };
}

export interface HistoryPage {
  totalPages: number;
  totalElements: number;
  pageable: HistoryPageable;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  size: number;
  content: HistoryPoint[];
  number: number;
  sort: { sorted: boolean; unsorted: boolean; empty: boolean };
  empty: boolean;
}

export const trackingService = {
  async getHistory(
    deviceUuid: string,
    params: {
      from?: string;
      to?: string;
      page?: number;
      size?: number;
    }
  ): Promise<ApiResponse<HistoryPage>> {
    // Build URL manually so colons in datetime are NOT percent-encoded by Axios.
    // Spring's ISO_LOCAL_DATE_TIME formatter accepts "yyyy-MM-dd'T'HH:mm" (seconds optional).
    let url = `/v1/tracking/${deviceUuid}/history?page=${params.page ?? 0}&size=${params.size ?? 50}`;
    if (params.from) url += `&from=${params.from.slice(0, 16)}`; // "2026-03-25T00:00"
    if (params.to)   url += `&to=${params.to.slice(0, 16)}`;
    const res = await apiClient.get<ApiResponse<HistoryPage>>(url);
    return res.data;
  },
};
