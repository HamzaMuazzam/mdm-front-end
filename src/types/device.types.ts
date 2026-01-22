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
  deviceVerificationCode?: number;
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

export interface DeviceApplication {
  id: number;
  deviceId: number;
  deviceUuid: string;
  userId: number;
  userEmail: string;
  appName: string;
  appPackageId: string;
  appVersion: string;
  isAllowed: boolean;
  showIcon: boolean;
  orderNumberInLauncher: number;
  installUpdate: boolean;
  appIconBase64?: string;
  isSystemApp: boolean;
  applicationCategory: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigEnumItem {
  id: number;
  name: string;
  title: string;
  description: string;
}

export interface UpdateDeviceApplicationRequest {
  deviceId?: number;
  userId?: number;
  appName?: string;
  appPackageId?: string;
  appVersion?: string;
  isAllowed?: boolean;
  showIcon?: boolean;
  orderNumberInLauncher?: number;
  installUpdate?: boolean;
  appIconBase64?: string;
}

export enum ApplicationCategory {
  CATEGORY_UNDEFINED = -1,
  CATEGORY_GAME = 0,
  CATEGORY_AUDIO = 1,
  CATEGORY_VIDEO = 2,
  CATEGORY_IMAGE = 3,
  CATEGORY_SOCIAL = 4,
  CATEGORY_NEWS = 5,
  CATEGORY_MAPS = 6,
  CATEGORY_PRODUCTIVITY = 7,
  CATEGORY_ACCESSIBILITY = 8,
}

export const ApplicationCategoryInfo: Record<ApplicationCategory, { label: string; description: string }> = {
  [ApplicationCategory.CATEGORY_UNDEFINED]: { label: 'Others', description: 'Apps that do not fall into a specific category' },
  [ApplicationCategory.CATEGORY_GAME]: { label: 'Games', description: 'Apps designed for entertainment and gaming experiences' },
  [ApplicationCategory.CATEGORY_AUDIO]: { label: 'Audio & Music', description: 'Apps for listening to music, podcasts, and audio content' },
  [ApplicationCategory.CATEGORY_VIDEO]: { label: 'Video', description: 'Apps for watching videos, movies, and streaming content' },
  [ApplicationCategory.CATEGORY_IMAGE]: { label: 'Photos', description: 'Apps for viewing, editing, and managing photos' },
  [ApplicationCategory.CATEGORY_SOCIAL]: { label: 'Social Apps', description: 'Apps for communication and social networking' },
  [ApplicationCategory.CATEGORY_NEWS]: { label: 'News', description: 'Apps that provide news, articles, and current updates' },
  [ApplicationCategory.CATEGORY_MAPS]: { label: 'Maps & Navigations', description: 'Apps for navigation, maps, and location services' },
  [ApplicationCategory.CATEGORY_PRODUCTIVITY]: { label: 'Tools & Productivity', description: 'Apps that help improve productivity and manage tasks' },
  [ApplicationCategory.CATEGORY_ACCESSIBILITY]: { label: 'Accessibility', description: 'Apps designed to assist users with accessibility needs' },
};

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
