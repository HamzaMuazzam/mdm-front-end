import { apiClient } from '../client';
import type { BulkTarget } from '@/types/bulk.types';
import type { ApiResponse } from '@/types/api.types';

// ── History ───────────────────────────────────────────────────────────────────
//
// Speed-unit contract: every `speed` / `*Kmh` value the tracking API returns is already km/h
// (the Android agent converts Location.getSpeed() m/s exactly once; the backend stores it as-is).
// Display it with a "km/h" label — never multiply by 3.6 on this side.

export interface HistoryPoint {
  id: number;
  latitude: number;
  longitude: number;
  /** km/h as reported by the agent. */
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

// ── Tracking config: bulk assignment ──────────────────────────────────────────

/** Safe bounds for the heartbeat interval (seconds). Mirrors backend TrackingConfigBounds. */
export const HEARTBEAT_MIN_SECONDS = 30;
export const HEARTBEAT_MAX_SECONDS = 86400;

/** Omitted fields are left untouched on each target device. */
export interface TrackingConfigBulkRequest {
  /** Legacy explicit list — prefer `target`. */
  deviceUuids?: string[];
  /** Groups and/or devices to apply the timers to. */
  target?: BulkTarget;
  heartbeatTimer?: number;
  configurationTimer?: number;
  uploadTimer?: number;
}

export interface TrackingConfigBulkResult {
  deviceUuid: string;
  success: boolean;
  heartbeatTimer: number | null;
  message: string;
}

// ── Tracking bulk create ──────────────────────────────────────────────────────

export interface TrackingUploadPoint {
  availableSatellite: number; connectedSatellite: number;
  reason: string; deviceRDT: string; gpsRDT: string;
  igStatus: number; localPrimaryId: number;
  latitude: number; longitude: number; speed: number; // speed in km/h
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
  /** km/h at the time of the event (null for events without a fix). */
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

  /**
   * Apply the same tracking timers (e.g. heartbeat) to many devices at once.
   * The backend persists per device and pushes each one over MQTT.
   */
  async bulkUpdateConfig(req: TrackingConfigBulkRequest): Promise<TrackingConfigBulkResult[]> {
    const res = await apiClient.put<ApiResponse<TrackingConfigBulkResult[]>>(
      '/v1/tracking-config/bulk', req
    );
    return res.data.data ?? [];
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

  // Device groups moved to api/services/deviceGroup.service.ts
};
