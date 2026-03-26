import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';

// ── History ───────────────────────────────────────────────────────────────────

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
  paged: boolean; unpaged: boolean; pageNumber: number; pageSize: number;
  offset: number; sort: { sorted: boolean; unsorted: boolean; empty: boolean };
}
export interface HistoryPage {
  totalPages: number; totalElements: number; pageable: HistoryPageable;
  numberOfElements: number; first: boolean; last: boolean; size: number;
  content: HistoryPoint[]; number: number;
  sort: { sorted: boolean; unsorted: boolean; empty: boolean }; empty: boolean;
}

// ── Geofences ─────────────────────────────────────────────────────────────────

export type GeoType = 'CIRCLE' | 'POLYGON' | 'LINE';

export interface GeofenceTypeEnum {
  id: number;
  name: GeoType;
  title: string;
  description: string;
}

// What the server returns
export interface GeofenceData {
  id: number;
  name: string;
  type: GeoType;
  centerLat: number | null;
  centerLng: number | null;
  radiusMeters: number | null;
  polygonPoints: string | null;
  bufferMeters: number | null;
  active: boolean;
  createdAt: string;
  deviceUuid: string;
}

export interface GeofencePage {
  totalPages: number; totalElements: number; first: boolean; last: boolean;
  size: number; content: GeofenceData[]; number: number; empty: boolean;
}

// What we send to the server
export interface GeofenceRequest {
  name: string;
  typeId: number;            // 1=CIRCLE, 2=POLYGON, 3=LINE
  centerLat?: number | null;
  centerLng?: number | null;
  radiusMeters?: number | null;
  polygonPoints?: string | null;
  bufferMeters?: number | null;
}

// ── Geofence events ───────────────────────────────────────────────────────────

export interface GeofenceEventData {
  id: number;
  eventType: 'ENTER' | 'EXIT';
  latitude: number;
  longitude: number;
  eventTime: string;
  deviceUuid: string;
  geofenceId: number;
  geofenceName: string;
}

export interface GeofenceEventPage {
  totalPages: number;
  totalElements: number;
  content: GeofenceEventData[];
  first: boolean;
  last: boolean;
  number: number;
}

// ── Tracking bulk create ──────────────────────────────────────────────────────

export interface TrackingUploadPoint {
  availableSatellite: number; connectedSatellite: number;
  reason: string; deviceRDT: string; gpsRDT: string;
  igStatus: number; localPrimaryId: number;
  latitude: number; longitude: number; speed: number;
  accuracy: number; altitude: number; bearing: number;
  provider: string; versionNo: string; uploadRetryCount: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const trackingService = {
  // Geofence type enums
  async getGeofenceTypes(deviceUuid: string): Promise<ApiResponse<GeofenceTypeEnum[]>> {
    const res = await apiClient.get<ApiResponse<GeofenceTypeEnum[]>>(
      `/v1/tracking/${deviceUuid}/enums/geofence-types`
    );
    return res.data;
  },

  // History
  async getHistory(
    deviceUuid: string,
    params: { from?: string; to?: string; page?: number; size?: number }
  ): Promise<ApiResponse<HistoryPage>> {
    let url = `/v1/tracking/${deviceUuid}/history?page=${params.page ?? 0}&size=${params.size ?? 50}`;
    if (params.from) url += `&from=${params.from.slice(0, 16)}`;
    if (params.to)   url += `&to=${params.to.slice(0, 16)}`;
    const res = await apiClient.get<ApiResponse<HistoryPage>>(url);
    return res.data;
  },

  // Bulk create tracking points
  async bulkCreateTrackingPoints(
    deviceUuid: string,
    points: TrackingUploadPoint[]
  ): Promise<ApiResponse<unknown>> {
    const res = await apiClient.post<ApiResponse<unknown>>(`/v1/tracking/${deviceUuid}/create`, points);
    return res.data;
  },

  // Geofences
  async getGeofences(
    deviceUuid: string,
    params: { page?: number; size?: number } = {}
  ): Promise<ApiResponse<GeofencePage>> {
    const res = await apiClient.get<ApiResponse<GeofencePage>>(
      `/v1/tracking/${deviceUuid}/geofences`,
      { params: { page: params.page ?? 0, size: params.size ?? 200 } }
    );
    return res.data;
  },

  async createGeofence(deviceUuid: string, req: GeofenceRequest): Promise<ApiResponse<GeofenceData>> {
    const res = await apiClient.post<ApiResponse<GeofenceData>>(
      `/v1/tracking/${deviceUuid}/geofences`, req
    );
    return res.data;
  },

  async updateGeofence(deviceUuid: string, id: number, req: GeofenceRequest): Promise<ApiResponse<GeofenceData>> {
    const res = await apiClient.put<ApiResponse<GeofenceData>>(
      `/v1/tracking/${deviceUuid}/geofences/${id}`, req
    );
    return res.data;
  },

  async deleteGeofence(deviceUuid: string, id: number): Promise<ApiResponse<unknown>> {
    const res = await apiClient.delete<ApiResponse<unknown>>(`/v1/tracking/${deviceUuid}/geofences/${id}`);
    return res.data;
  },

  async getGeofenceEvents(
    deviceUuid: string,
    params: { page?: number; size?: number } = {}
  ): Promise<ApiResponse<GeofenceEventPage>> {
    const res = await apiClient.get<ApiResponse<GeofenceEventPage>>(
      `/v1/tracking/${deviceUuid}/geofenceEvents`,
      { params: { page: params.page ?? 0, size: params.size ?? 30 } }
    );
    return res.data;
  },
};
