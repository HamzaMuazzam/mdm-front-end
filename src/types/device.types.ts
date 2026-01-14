export interface Device {
  id: number;
  deviceUuid: string;
  phone: string;
  userEmail: string;
  userName: string;
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
  deletedAt?: string | null;
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

export interface DeviceConfiguration {
  id: number;
  userId: number;
  deviceId: number;
  configName: string;
  description: string | null;
  unlockPassword: string | null;
  locationTrackingByTypeId: number;
  locationTrackingByTypeName: string;
  applicationPermissionGranterTypeId: number;
  applicationPermissionGranterTypeName: string;
  pushNotificationProtocolTypeId: number;
  pushNotificationProtocolTypeName: string;
  wifiStateId: number;
  wifiStateName: string;
  gpsStateId: number;
  gpsStateName: string;
  notificationBarStateId: number;
  notificationBarStateName: string;
  mobileDataStateId: number;
  mobileDataStateName: string;
  blockExternalStorage: boolean;
  manageScreenTimeout: boolean;
  screenTimeoutSeconds: number;
  lockVolume: boolean;
  volumePercentage: number;
  isDefaultLauncher: boolean;
  isInstalledAsDeviceOwner: boolean;
  useDefaultLauncherTheme: boolean;
  backgroundColor: string;
  applicationNamesColor: string;
  backgroundImageUrl: string | null;
  iconSize: string;
  lockSystemOrientation: boolean;
  lockLauncherOrientation: boolean;
  launcherOrientation: boolean;
  hideSystemNotificationBarInLauncher: boolean;
  showLauncherOwnNotificationBar: boolean;
  enableHomeButton: boolean;
  enableRecentsButton: boolean;
  enableNotifications: boolean;
  enableStatusBarInfo: boolean;
  enableScreenLock: boolean;
  lockPowerButton: boolean;
  enableKioskMode: boolean;
  screenAlwaysOn: boolean;
  newServerURL: string | null;
  isParentConfig: boolean;
}

export interface ConfigEnumItem {
  id: number;
  name: string;
  title: string;
  description: string;
}

export interface UpdateDeviceConfigurationRequest {
  userId?: number;
  deviceId?: number;
  configName?: string;
  description?: string;
  unlockPassword?: string;
  locationTrackingByTypeId?: number;
  applicationPermissionGranterTypeId?: number;
  pushNotificationProtocolTypeId?: number;
  wifiStateId?: number;
  gpsStateId?: number;
  notificationBarStateId?: number;
  mobileDataStateId?: number;
  blockExternalStorage?: boolean;
  manageScreenTimeout?: boolean;
  screenTimeoutSeconds?: number;
  lockVolume?: boolean;
  volumePercentage?: number;
  isDefaultLauncher?: boolean;
  isInstalledAsDeviceOwner?: boolean;
  useDefaultLauncherTheme?: boolean;
  backgroundColor?: string;
  applicationNamesColor?: string;
  backgroundImageUrl?: string;
  iconSize?: string;
  lockSystemOrientation?: boolean;
  lockLauncherOrientation?: boolean;
  launcherOrientation?: boolean;
  hideSystemNotificationBarInLauncher?: boolean;
  showLauncherOwnNotificationBar?: boolean;
  enableHomeButton?: boolean;
  enableRecentsButton?: boolean;
  enableNotifications?: boolean;
  enableStatusBarInfo?: boolean;
  enableScreenLock?: boolean;
  lockPowerButton?: boolean;
  enableKioskMode?: boolean;
  screenAlwaysOn?: boolean;
  newServerURL?: string;
}
