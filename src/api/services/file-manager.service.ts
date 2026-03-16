import { apiClient } from '../client';
import type { ApiResponse, PaginatedResponse } from '@/types/api.types';
import type {
  FileCommandResponse,
  FileEventResponse,
  FileTransferResponse,
  SendFileCommandRequest,
} from '@/types/file-manager.types';

const BASE = '/v1/file-manager';

export const fileManagerService = {
  /** Dispatch a file command to a managed device. Returns 202 with the log entry. */
  async sendCommand(data: SendFileCommandRequest): Promise<ApiResponse<FileCommandResponse>> {
    const response = await apiClient.post<ApiResponse<FileCommandResponse>>(
      `${BASE}/command`,
      data
    );
    return response.data;
  },

  /** Poll this until status === 'COMPLETED' or 'FAILED'. */
  async getCommand(id: number): Promise<ApiResponse<FileCommandResponse>> {
    const response = await apiClient.get<ApiResponse<FileCommandResponse>>(
      `${BASE}/commands/${id}`
    );
    return response.data;
  },

  async listCommands(
    page = 0,
    size = 20
  ): Promise<ApiResponse<PaginatedResponse<FileCommandResponse>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<FileCommandResponse>>>(
      `${BASE}/commands?page=${page}&size=${size}`
    );
    return response.data;
  },

  async listCommandsByDevice(
    deviceUuid: string,
    page = 0,
    size = 20
  ): Promise<ApiResponse<PaginatedResponse<FileCommandResponse>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<FileCommandResponse>>>(
      `${BASE}/commands/device/${deviceUuid}?page=${page}&size=${size}`
    );
    return response.data;
  },

  async listEventsByDevice(
    deviceUuid: string,
    page = 0,
    size = 50
  ): Promise<ApiResponse<PaginatedResponse<FileEventResponse>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<FileEventResponse>>>(
      `${BASE}/events/device/${deviceUuid}?page=${page}&size=${size}`
    );
    return response.data;
  },

  /** Admin requests a file FROM the device */
  async requestDownload(deviceUuid: string, filePath: string): Promise<ApiResponse<FileTransferResponse>> {
    const response = await apiClient.post<ApiResponse<FileTransferResponse>>(
      `/v1/file-transfer/request-download?deviceUuid=${encodeURIComponent(deviceUuid)}&filePath=${encodeURIComponent(filePath)}`
    );
    return response.data;
  },

  /** Poll transfer status */
  async getTransferStatus(transferId: string): Promise<ApiResponse<FileTransferResponse>> {
    const response = await apiClient.get<ApiResponse<FileTransferResponse>>(
      `/v1/file-transfer/${transferId}/status`
    );
    return response.data;
  },

  /** Admin sends a file TO the device */
  async uploadToDevice(deviceUuid: string, destinationPath: string, file: File): Promise<ApiResponse<FileTransferResponse>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('deviceUuid', deviceUuid);
    formData.append('destinationPath', destinationPath);
    const response = await apiClient.post<ApiResponse<FileTransferResponse>>(
      `/v1/file-transfer/upload-to-device`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  /** Download URL for a completed DOWNLOAD transfer - returns the URL directly */
  getDownloadUrl(transferId: string): string {
    return `/v1/file-transfer/${transferId}/download`;
  },
};
