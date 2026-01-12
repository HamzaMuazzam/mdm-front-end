export interface Device {
  id: number;
  deviceUuid: string;
  phone: string;
  userEmail: string;
  model: string;
  osVersion: string;
  userId: number;
  description?: string;
  cpuArchitecture?: string;
  isDeviceAdmin?: boolean;
  canOverlayWindows?: boolean;
  canAccessUsageHistory?: boolean;
  canAccessAccessibility?: boolean;
  batteryCharge?: number;
  launcherVariant?: string;
  defaultLauncher?: string;
}

export interface CreateDeviceRequest {
  deviceUuid: string;
  phone: string;
  userEmail: string;
  model: string;
  osVersion: string;
  description?: string;
  userId: number;
}

export interface UpdateDeviceRequest {
  description?: string;
  phone?: string;
  cpuArchitecture?: string;
  isDeviceAdmin?: boolean;
  canOverlayWindows?: boolean;
  canAccessUsageHistory?: boolean;
  canAccessAccessibility?: boolean;
  model?: string;
  osVersion?: string;
  batteryCharge?: number;
  launcherVariant?: string;
  defaultLauncher?: string;
  userId?: number;
}
