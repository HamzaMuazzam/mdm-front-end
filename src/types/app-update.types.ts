export type UpdatePlatform = 'ANDROID' | 'IOS';
export type UpdateType = 'CRITICAL' | 'NORMAL';

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
