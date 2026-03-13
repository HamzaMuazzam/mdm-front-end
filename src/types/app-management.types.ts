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
  deviceUuids: string[];
  managedAppId: number;
}

export interface UninstallRequest {
  deviceUuids: string[];
  packageName: string;
}
