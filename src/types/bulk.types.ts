/**
 * Shared types for device groups, bulk targeting and the bulk-operations audit log.
 * Mirrors the backend `modules/bulk` + `DeviceGroup` contracts.
 */

/** Who a bulk operation applies to — sent next to the legacy `deviceUuids` list. */
export interface BulkTarget {
  /** Whole groups; the account's system "All" group expands to the fleet. */
  groupIds?: number[];
  /** Individually picked devices (any group or none). */
  deviceUuids?: string[];
  /** Shortcut for the account's "All" group. */
  allDevices?: boolean;
}

export type DeviceGroupType = 'ALL' | 'CUSTOM';

export interface DeviceGroup {
  id: number;
  name: string;
  description: string | null;
  groupType: DeviceGroupType;
  /** True for the account's system "All" group (computed membership, read-only). */
  system: boolean;
  /** Active member uuids visible to the caller (for "All": every active device). */
  deviceUuids: string[];
  deviceCount: number;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface DeviceGroupRequest {
  name?: string;
  description?: string;
  /** Full replacement of the members the caller can see (create/update). */
  deviceUuids?: string[];
}

export interface DeviceGroupMembersRequest {
  addDeviceUuids?: string[];
  removeDeviceUuids?: string[];
}

export type BulkModule =
  | 'CONFIG_POLICY'
  | 'TIME_RANGE'
  | 'SSL_PINNING'
  | 'TRACKING_CONFIG'
  | 'APP_BLOCK'
  | 'APP_INSTALL'
  | 'APP_UNINSTALL'
  | 'APP_UPDATE_RELEASE'
  | 'DEVICE_GROUP';

export const BULK_MODULE_LABELS: Record<BulkModule, string> = {
  CONFIG_POLICY: 'Configuration / Policy',
  TIME_RANGE: 'Usage Time Range',
  SSL_PINNING: 'SSL Pinning',
  TRACKING_CONFIG: 'Heartbeat / Tracking',
  APP_BLOCK: 'App Block / Unblock',
  APP_INSTALL: 'App Install',
  APP_UNINSTALL: 'App Uninstall',
  APP_UPDATE_RELEASE: 'App Update Release',
  DEVICE_GROUP: 'Device Group',
};

export interface BulkTargetSummary {
  description?: string;
  allDevices?: boolean;
  groupIds?: number[];
  groupNames?: string[];
  explicitDeviceCount?: number;
  requestedCount?: number;
  resolvedCount?: number;
  skippedNotVisible?: number;
  skippedInactive?: number;
  notFoundUuids?: string[];
}

export interface BulkOperationLog {
  id: number;
  module: BulkModule;
  action: string;
  performedByEmail: string | null;
  targetDescription: string | null;
  targetSummary: BulkTargetSummary | null;
  requestedCount: number | null;
  resolvedCount: number | null;
  successCount: number | null;
  failedCount: number | null;
  skippedNotVisible: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface BulkOperationLogQuery {
  page?: number;
  size?: number;
  module?: BulkModule;
  from?: string;
  to?: string;
}

/** Spring `Page<T>` shape as returned inside the ApiResponse envelope. */
export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

/** True when the target would resolve to nothing. */
export function isBulkTargetEmpty(target: BulkTarget | null | undefined): boolean {
  if (!target) return true;
  return !target.allDevices && !(target.groupIds?.length) && !(target.deviceUuids?.length);
}
