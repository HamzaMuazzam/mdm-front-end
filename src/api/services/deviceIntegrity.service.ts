import { apiClient } from '../client';
import type { ApiResponse } from '@/types/api.types';

export type IntegrityStatus = 'CLEAN' | 'SUSPICIOUS' | 'COMPROMISED';
export type IntegritySeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IntegrityIndicator {
  type: string;
  severity: string;
  evidence: string | null;
}

export interface IntegrityEvent {
  id: number;
  deviceUuid: string;
  status: IntegrityStatus;
  severity: IntegritySeverity;
  /** JSON string of IntegrityIndicator[] as stored by the backend. */
  indicators: string | null;
  indicatorCount: number;
  attestationStatus: string | null;
  playIntegrityVerdict: string | null;
  scanTrigger: string | null;
  securityAlert: boolean;
  stateChanged: boolean;
  appVersion: string | null;
  osVersion: string | null;
  eventTimestamp: number;
  createdAt: string;
}

export interface IntegrityStats {
  currentStatus: IntegrityStatus;
  currentSeverity: IntegritySeverity;
  totalScans: number;
  compromisedScans: number;
  lastScanAt: number | null;
  lastCompromisedAt: number | null;
  playIntegrityVerdict: string | null;
}

/**
 * Integrity roll-up scoped by the backend to the logged-in user's account hierarchy
 * (own + sub-users' active devices) — not the whole platform.
 */
export interface IntegrityFleetSummary {
  /** Active devices visible to the caller (scanned or not). Absent on pre-scoping backends. */
  totalDevices?: number;
  totalDevicesScanned: number;
  /** Visible devices that have never reported an integrity scan. Absent on pre-scoping backends. */
  notScanned?: number;
  compromised: number;
  suspicious: number;
  clean: number;
}

export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export const deviceIntegrityService = {
  async getEvents(
    deviceUuid: string,
    page = 0,
    size = 50,
    securityOnly = false
  ): Promise<SpringPage<IntegrityEvent>> {
    const res = await apiClient.get<ApiResponse<SpringPage<IntegrityEvent>>>(
      `/v1/device-integrity/${deviceUuid}/events`,
      { params: { page, size, securityOnly } }
    );
    return res.data.data;
  },

  async getStats(deviceUuid: string): Promise<IntegrityStats> {
    const res = await apiClient.get<ApiResponse<IntegrityStats>>(
      `/v1/device-integrity/${deviceUuid}/stats`
    );
    return res.data.data;
  },

  async getFleetSummary(): Promise<IntegrityFleetSummary> {
    const res = await apiClient.get<ApiResponse<IntegrityFleetSummary>>(
      `/v1/device-integrity/fleet-summary`
    );
    return res.data.data;
  },

  async requestScan(deviceUuid: string): Promise<void> {
    await apiClient.post(`/v1/device-integrity/${deviceUuid}/scan`);
  },

  /** Safely parse the stored indicators JSON string into a typed array. */
  parseIndicators(raw: string | null): IntegrityIndicator[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as IntegrityIndicator[]) : [];
    } catch {
      return [];
    }
  },
};
