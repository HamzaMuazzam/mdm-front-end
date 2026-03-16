// ── File node (mirrors Android FileNode data class) ───────────────────────────

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  extension: string;
  mimeType: string;
  lastModified: number; // epoch ms
  children: FileNode[];
}

// ── Command types ─────────────────────────────────────────────────────────────

export type FileCommandType =
  | 'LIST_FILES'
  | 'DELETE_FILE'
  | 'DOWNLOAD_FILE'
  | 'UPLOAD_FILE'
  | 'MOVE_FILE'
  | 'GET_METADATA';

export type FileCommandStatus = 'PENDING' | 'SENT' | 'COMPLETED' | 'FAILED';

// ── REST DTOs ─────────────────────────────────────────────────────────────────

export interface SendFileCommandRequest {
  deviceUuid: string;
  commandType: FileCommandType;
  path?: string;
  sourcePath?: string;
  destinationPath?: string;
  fileName?: string;
  fileData?: string; // base-64
}

export interface FileCommandResponse {
  id: number;
  deviceUuid: string;
  commandType: FileCommandType;
  status: FileCommandStatus;
  requestPayload: string | null;
  responsePayload: string | null;
  errorMessage: string | null;
  initiatedByEmail: string | null;
  createdAt: string;
  sentAt: string | null;
  completedAt: string | null;
}

export interface FileEventResponse {
  id: number;
  deviceUuid: string;
  eventType: 'CREATED' | 'DELETED' | 'MODIFIED';
  filePath: string;
  deviceTimestamp: number | null;
  receivedAt: string;
}

// ── HTTP File Transfer (replaces Base64-over-MQTT for download/upload) ───────

export interface FileTransferResponse {
  id: string;
  deviceUuid: string;
  transferType: 'DOWNLOAD' | 'UPLOAD';
  devicePath: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
}

// ── Parsed device response (from responsePayload JSON) ───────────────────────

export interface DeviceFileResponse {
  status: 'success' | 'error';
  data?: FileNode | FileNode[];
  message?: string;
  // DOWNLOAD_FILE extras
  name?: string;
  path?: string;
  size?: number;
  mimeType?: string;
  fileData?: string; // base-64 content
}
