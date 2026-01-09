export interface Device {
  id: number;
  deviceUuid: string;
  phone: string;
  userEmail: string;
  model: string;
  osVersion: string;
  userId: number;
  description?: string;
}

export interface CreateDeviceRequest {
  deviceUuid: string;
  phone: string;
  userEmail: string;
  model: string;
  osVersion: string;
  description?: string;
}

export interface UpdateDeviceRequest {
  id: number;
  deviceUuid?: string;
  phone?: string;
  userEmail?: string;
  model?: string;
  osVersion?: string;
  description?: string;
}
