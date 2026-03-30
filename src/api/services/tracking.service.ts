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

// ── Tracking config ───────────────────────────────────────────────────────────

export interface TrackingConfigResponse {
  id: number;
  configurationTimer: number;
  uploadTimer: number;
  retryCounter: number;
  angleThreshold: number;
  overSpeedingThreshold: number;
  distanceThreshold: number;
  movingTimer: number;
  stopTimer: number;
  heartbeatTimer: number;
  baseURL: string;
  setMinUpdateIntervalMillis: number;
  setMinUpdateDistanceMeters: number;
}

export interface TrackingConfigRequest {
  configurationTimer?: number;
  uploadTimer?: number;
  movingTimer?: number;
  stopTimer?: number;
  heartbeatTimer?: number;
  angleThreshold?: number;
  overSpeedingThreshold?: number;
  distanceThreshold?: number;
  retryCounter?: number;
  setMinUpdateIntervalMillis?: number;
  setMinUpdateDistanceMeters?: number;
  baseURL?: string;
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

// ── Trips (Module 1) ──────────────────────────────────────────────────────────

export type TripStatus = 'ACTIVE' | 'COMPLETED';

export interface Trip {
  id: number;
  deviceUuid: string;
  startTime: string;
  endTime: string | null;
  startLat: number;
  startLng: number;
  endLat: number | null;
  endLng: number | null;
  totalDistanceMeters: number;
  durationSeconds: number | null;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  pointCount: number;
  status: TripStatus;
  createdAt: string;
}

export interface TripPage {
  totalPages: number; totalElements: number; content: Trip[];
  first: boolean; last: boolean; number: number;
}

// ── Tracking Events / Alerts (Module 2) ───────────────────────────────────────

export type TrackingEventType =
  | 'OVERSPEEDING' | 'HARSH_BRAKING' | 'SHARP_TURN'
  | 'DEVICE_OFFLINE' | 'BATTERY_LOW' | 'GPS_LOST' | 'SOS'
  | 'TRIP_STARTED' | 'TRIP_ENDED';

export interface TrackingEventData {
  id: number;
  deviceUuid: string;
  eventType: TrackingEventType;
  latitude: number;
  longitude: number;
  speed: number | null;
  bearing: number | null;
  metadata: string | null;
  eventTime: string;
  createdAt: string;
}

export interface TrackingEventPage {
  totalPages: number; totalElements: number; content: TrackingEventData[];
  first: boolean; last: boolean; number: number;
}

// ── Analytics (Module 9) ──────────────────────────────────────────────────────

export interface DailyDistancePoint {
  date: string;
  distanceMeters: number;
  tripCount: number;
  drivingSeconds: number;
}

export interface VisitedPlace {
  latitude: number;
  longitude: number;
  visitCount: number;
  label: string | null;
}

export interface AnalyticsData {
  totalDistanceMeters: number;
  totalDrivingSeconds: number;
  totalTrips: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  dailyDistance: DailyDistancePoint[];
  eventCounts: Record<string, number>;
  mostVisitedPlaces: VisitedPlace[];
}

// ── Device Groups (Module 5) ──────────────────────────────────────────────────

export interface DeviceGroup {
  id: number;
  name: string;
  description: string | null;
  deviceUuids: string[];
  deviceCount: number;
  createdAt: string;
}

export interface DeviceGroupRequest {
  name: string;
  description?: string;
  deviceUuids: string[];
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

  async getConfig(deviceUuid: string): Promise<ApiResponse<TrackingConfigResponse>> {
    const res = await apiClient.get<ApiResponse<TrackingConfigResponse>>(
      `/v1/tracking/${deviceUuid}/config`
    );
    return res.data;
  },

  async updateConfig(deviceUuid: string, req: TrackingConfigRequest): Promise<ApiResponse<TrackingConfigResponse>> {
    const res = await apiClient.put<ApiResponse<TrackingConfigResponse>>(
      `/v1/tracking/${deviceUuid}/config`, req
    );
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

  // ── Trips (Module 1) ───────────────────────────────────────────────────────
  async getTrips(
    deviceUuid: string,
    params: { from?: string; to?: string; page?: number; size?: number } = {}
  ): Promise<ApiResponse<TripPage>> {
    const res = await apiClient.get<ApiResponse<TripPage>>(
      `/v1/tracking/${deviceUuid}/trips`,
      { params: { page: params.page ?? 0, size: params.size ?? 20, from: params.from, to: params.to } }
    );
    return res.data;
  },

  async getTrip(deviceUuid: string, id: number): Promise<ApiResponse<Trip>> {
    const res = await apiClient.get<ApiResponse<Trip>>(`/v1/tracking/${deviceUuid}/trips/${id}`);
    return res.data;
  },

  // ── Tracking Events / Alerts (Module 2) ───────────────────────────────────
  async getTrackingEvents(
    deviceUuid: string,
    params: { type?: string; from?: string; to?: string; page?: number; size?: number } = {}
  ): Promise<ApiResponse<TrackingEventPage>> {
    const res = await apiClient.get<ApiResponse<TrackingEventPage>>(
      `/v1/tracking/${deviceUuid}/events`,
      { params: { page: params.page ?? 0, size: params.size ?? 50, ...params } }
    );
    return res.data;
  },

  // ── Analytics (Module 9) ───────────────────────────────────────────────────
  async getAnalytics(
    deviceUuid: string,
    params: { from?: string; to?: string } = {}
  ): Promise<ApiResponse<AnalyticsData>> {
    const res = await apiClient.get<ApiResponse<AnalyticsData>>(
      `/v1/tracking/${deviceUuid}/analytics`,
      { params }
    );
    return res.data;
  },

  // ── Device Groups (Module 5) ───────────────────────────────────────────────
  async getDeviceGroups(): Promise<ApiResponse<DeviceGroup[]>> {
    const res = await apiClient.get<ApiResponse<DeviceGroup[]>>('/v1/device-groups');
    return res.data;
  },

  async createDeviceGroup(req: DeviceGroupRequest): Promise<ApiResponse<DeviceGroup>> {
    const res = await apiClient.post<ApiResponse<DeviceGroup>>('/v1/device-groups', req);
    return res.data;
  },

  async updateDeviceGroup(id: number, req: DeviceGroupRequest): Promise<ApiResponse<DeviceGroup>> {
    const res = await apiClient.put<ApiResponse<DeviceGroup>>(`/v1/device-groups/${id}`, req);
    return res.data;
  },

  async deleteDeviceGroup(id: number): Promise<ApiResponse<void>> {
    const res = await apiClient.delete<ApiResponse<void>>(`/v1/device-groups/${id}`);
    return res.data;
  },
};
