export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DeviceNotification {
  id: number;
  deviceId: number;
  deviceUuid: string;
  packageName: string;
  appName: string | null;
  title: string | null;
  message: string | null;
  priority: NotificationPriority;
  category: string | null;
  isSensitive: boolean;
  receivedAt: string;
  createdAt: string;
}

export interface NotificationSettings {
  deviceId: number;
  alertsEnabled: boolean;
  updatedAt: string | null;
}

export interface NotificationQuery {
  from?: string;
  to?: string;
  priority?: NotificationPriority;
  packageName?: string;
  page?: number;
  size?: number;
}
