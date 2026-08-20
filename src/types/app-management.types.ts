import type { BulkTarget } from './bulk.types';

export interface ManagedApp {
  id: number;
  packageName: string;
  versionName: string;
  versionCode: number;
  downloadUrl: string;
  fileSize: number;
  checksum: string;
  description: string;
  isActive: boolean;
  uploadedByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export type CommandStatus = 'PENDING' | 'SENT' | 'SUCCESS' | 'FAILED';
export type CommandType = 'INSTALL_APP' | 'UNINSTALL_APP';

export interface AppCommand {
  id: number;
  deviceUuid: string;
  deviceName: string;
  managedAppId: number;
  commandType: CommandType;
  packageName: string;
  versionName: string;
  status: CommandStatus;
  initiatedByEmail: string;
  errorMessage: string;
  sentAt: string;
  executedAt: string;
  createdAt: string;
}

export interface InstallRequest {
  /** Legacy explicit list — prefer `target`. */
  deviceUuids?: string[];
  /** Groups and/or devices to install on. */
  target?: BulkTarget;
  managedAppId: number;
}

export interface UninstallRequest {
  /** Legacy explicit list — prefer `target`. */
  deviceUuids?: string[];
  /** Groups and/or devices to uninstall from. */
  target?: BulkTarget;
  packageName: string;
}
