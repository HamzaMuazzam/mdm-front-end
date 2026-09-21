/**
 * Remote App Control — clear cache / clear data / runtime permissions / force stop for apps that
 * are already installed on managed devices. Mirrors the backend `modules/appcontrol` contracts.
 */
import type { BulkTarget } from './bulk.types';

export type AppControlAction = 'CLEAR_CACHE' | 'CLEAR_DATA' | 'SET_PERMISSIONS' | 'FORCE_STOP';

export type AppControlStatus =
  | 'PENDING'
  | 'SENT'
  | 'SUCCESS'
  | 'PARTIAL'
  | 'FAILED'
  | 'NOT_SUPPORTED'
  | 'NOT_INSTALLED'
  | 'PROTECTED'
  | 'SKIPPED'
  | 'EXPIRED';

export type PermissionGrantState = 'GRANT' | 'DENY' | 'DEFAULT';
export type PermissionSelectionMode = 'ALL_REQUESTED' | 'SELECTED';

export interface AppControlPermissionSpec {
  mode: PermissionSelectionMode;
  /** Full android permission names; only for mode = SELECTED. */
  names?: string[];
  state: PermissionGrantState;
}

export interface AppControlRequest {
  action: AppControlAction;
  appPackageIds?: string[];
  /** Every non-system app of each target device (Clear Cache / Force Stop only). */
  allUserApps?: boolean;
  permissions?: AppControlPermissionSpec;
  target: BulkTarget;
}

export interface AppControlPreviewApp {
  appPackageId: string;
  appName: string | null;
  installedOn: number;
  protectedPackage: boolean;
}

export interface AppControlPreview {
  targetDescription: string;
  deviceCount: number;
  commandsToSend: number;
  devicesWithWork: number;
  skippedNotInstalled: number;
  protectedPackages: string[];
  devicesLikelyUnsupported: number;
  unsupportedReason: string | null;
  apps: AppControlPreviewApp[];
}

export interface AppControlBatch {
  id: number;
  action: AppControlAction;
  packageIds: string[];
  permissions?: AppControlPermissionSpec;
  targetDescription: string | null;
  initiatedByEmail: string | null;
  deviceCount: number;
  commandCount: number;
  expiresAt: string | null;
  createdAt: string;
  statusCounts: Partial<Record<AppControlStatus, number>>;
  openCount: number;
  retryableCount: number;
}

export interface AppControlCommand {
  id: number;
  batchId: number;
  deviceUuid: string;
  deviceName: string | null;
  packageName: string;
  appName: string | null;
  action: AppControlAction;
  status: AppControlStatus;
  method?: string | null;
  resultDetail?: Record<string, any> | null;
  errorMessage?: string | null;
  attempts?: number | null;
  sentAt?: string | null;
  executedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export const APP_CONTROL_PERMISSIONS = {
  read: 'app-control:read',
  execute: 'app-control:execute',
  clearData: 'app-control:clear-data',
} as const;

export const APP_CONTROL_ACTION_LABELS: Record<AppControlAction, string> = {
  CLEAR_CACHE: 'Clear cache',
  CLEAR_DATA: 'Clear data',
  SET_PERMISSIONS: 'Permissions',
  FORCE_STOP: 'Force stop',
};

export const APP_CONTROL_METHOD_LABELS: Record<string, string> = {
  DEVICE_OWNER: 'Device Owner',
  PRIVILEGED: 'System app',
  ROOT: 'Root',
  ACCESSIBILITY: 'Accessibility',
  INSTALL_TIME: 'Install-time',
  BACKGROUND_KILL: 'Background only',
};

/** How each status is shown. `tone` maps to the colour classes in AppControlResults. */
export const APP_CONTROL_STATUS_META: Record<
  AppControlStatus,
  { label: string; tone: 'ok' | 'wait' | 'warn' | 'bad' | 'muted'; hint: string }
> = {
  PENDING: { label: 'Queued', tone: 'wait', hint: 'Will be delivered when the device connects' },
  SENT: { label: 'Waiting for device', tone: 'wait', hint: 'Sent — the device has not answered yet (it may be offline)' },
  SUCCESS: { label: 'Done', tone: 'ok', hint: 'Completed on the device' },
  PARTIAL: { label: 'Partly done', tone: 'warn', hint: 'Only part of the action could be completed' },
  FAILED: { label: 'Failed', tone: 'bad', hint: 'The device tried and failed — can be retried' },
  NOT_SUPPORTED: { label: 'Not supported', tone: 'warn', hint: 'This device has no way to do this action' },
  NOT_INSTALLED: { label: 'Not installed', tone: 'muted', hint: 'The app is not on this device' },
  PROTECTED: { label: 'Protected app', tone: 'muted', hint: 'Android does not allow this for the app' },
  SKIPPED: { label: 'Skipped', tone: 'muted', hint: 'Not sent' },
  EXPIRED: { label: 'Expired', tone: 'bad', hint: 'The device stayed offline until the command expired — can be retried' },
};
