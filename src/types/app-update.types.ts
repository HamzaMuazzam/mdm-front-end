import type { BulkTarget } from './bulk.types';

export type UpdatePlatform = 'ANDROID' | 'IOS';
export type UpdateType = 'CRITICAL' | 'NORMAL';

export type AppUpdateTargetType = 'ALL' | 'GROUP' | 'DEVICE';

/** A release target: who may install the release (evaluated dynamically by the backend). */
export interface AppUpdateTarget {
  id: number;
  targetType: AppUpdateTargetType;
  /** True for the platform-wide ALL target (every account). */
  platformWide: boolean;
  ownerEmail: string | null;
  groupId: number | null;
  groupName: string | null;
  deviceUuid: string | null;
  deviceName: string | null;
  createdByEmail: string | null;
  createdAt: string;
  /** "All devices (platform-wide)", "Group: Sales", "Device: Counter 12" */
  label: string;
}

export interface AppUpdate {
  id: number;
  versionCode: number;
  type: UpdateType;
  platform: UpdatePlatform;
  downloadUrl: string;
  releaseNotes: string;
  checksum: string;
  fileSize: number;
  isActive: boolean;
  criticalUpdate: boolean;
  createdAt: string;
  updatedAt: string;
  // ── Release targeting (admin-facing responses) ──
  platformWide?: boolean;
  targets?: AppUpdateTarget[];
  /** "Not released yet" / "Platform-wide (every account)" / "Sales, Pilot + 2 devices" */
  targetSummary?: string;
  /** Devices of the caller's account the release currently reaches. */
  targetedDeviceCount?: number;
}

/** "Release to…" request for the active update of a platform. */
export interface ReleaseUpdateRequest {
  platform: UpdatePlatform;
  /** Groups/devices of the caller's account; empty = the whole account. */
  target?: BulkTarget;
  /** Platform administrator only: every device of every account. */
  platformWide?: boolean;
}

export interface ReleaseUpdateResult {
  platform: UpdatePlatform;
  versionCode: number;
  platformWide: boolean;
  targetDescription: string;
  targetsAdded: number;
  devicesNotified: number;
  skippedNotVisible: number;
}

export interface UploadUpdateRequest {
  versionCode: number;
  type: UpdateType;
  platform: UpdatePlatform;
  releaseNotes: string;
  file: File;
}

export interface UpdateHistoryResponse {
  content: AppUpdate[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
