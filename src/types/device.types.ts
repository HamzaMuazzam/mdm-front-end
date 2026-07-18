export interface Device {
  id: number;
  deviceUuid: string;
  phone: string;
  userEmail: string;
  userName: string;
  deviceName: string;
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
  // Live presence + security snapshot (enriched by the device list API)
  lastSeenAt?: number | null;
  online?: boolean;
  integrityStatus?: string | null;
  integritySeverity?: string | null;
  integrityCompromised?: boolean;
  simEventType?: string | null;
  simAlert?: boolean;
  // OTA update rollout tracking (reported via device state sync)
  appVersionCode?: number | null;
  appVersionName?: string | null;
  latestAppVersionCode?: number | null;
  /** true = on latest release; false = outdated; null/undefined = never reported */
  appUpToDate?: boolean | null;
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
  description?: string;
  phone?: string;
  cpuArchitecture?: string;
  isDeviceAdmin?: boolean;
  canOverlayWindows?: boolean;
  canAccessUsageHistory?: boolean;
  canAccessAccessibility?: boolean;
  model?: string;
  osVersion?: string;
  deviceName: string;
  batteryCharge?: number;
  launcherVariant?: string;
  defaultLauncher?: string;
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
  bluetoothStateId: number;
  bluetoothStateName: string;
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
  kioskModePackageId: string;
  screenAlwaysOn: boolean;
  newServerURL: string | null;
  isParentConfig: boolean;
  deviceAdminCode: string | null;
  isDeviceAdminCodeEnabled: boolean;
  allowToAccessSensitiveSettings: boolean;
  strictAirplaneMode: boolean;
  factoryResetLock: boolean;
  networkResetLock: boolean;
  appsControlLock: boolean;
  devicePassword?: string | null;
  // Root / compromise detection policy
  rootDetectionEnabled?: boolean;
  rootDetectionLockOnCompromise?: boolean;
  rootDetectionWipeOnCompromise?: boolean;
  rootDetectionMinSeverityForAction?: string;
  rootDetectionScanIntervalMinutes?: number;
  // OS Upgrade (System Update) policy
  systemUpdatePolicyType?: SystemUpdatePolicyType | null;
  maintenanceWindowStart?: number | null;
  maintenanceWindowEnd?: number | null;
  freezePeriodStart?: string | null;
  freezePeriodEnd?: string | null;
  // VPN management
  vpnEnabled?: boolean | null;
  vpnServerAddress?: string | null;
  vpnUsername?: string | null;
  vpnSecret?: string | null;
  vpnProtocolTypeId?: number | null;
  vpnProtocolTypeName?: string | null;
  vpnRoutingRules?: string[] | null;
}

export type SystemUpdatePolicyType = 'AUTOMATIC' | 'WINDOWED' | 'POSTPONED' | 'FREEZE';

/** Payload for the unified per-device / bulk policy apply endpoint. */
export interface ApplyDevicePolicyRequest {
  deviceUuids: string[];
  rootDetectionEnabled?: boolean | null;
  rootDetectionLockOnCompromise?: boolean | null;
  rootDetectionWipeOnCompromise?: boolean | null;
  rootDetectionMinSeverityForAction?: string | null;
  rootDetectionScanIntervalMinutes?: number | null;
  systemUpdatePolicyType?: SystemUpdatePolicyType | null;
  maintenanceWindowStart?: number | null;
  maintenanceWindowEnd?: number | null;
  freezePeriodStart?: string | null;
  freezePeriodEnd?: string | null;
  clearSystemUpdatePolicy?: boolean;
  // VPN management
  vpnEnabled?: boolean | null;
  vpnServerAddress?: string | null;
  vpnUsername?: string | null;
  vpnSecret?: string | null;
  vpnProtocolTypeId?: number | null;
  vpnRoutingRules?: string[] | null;
  // Configuration: Connectivity
  wifiStateId?: number | null;
  mobileDataStateId?: number | null;
  gpsStateId?: number | null;
  bluetoothStateId?: number | null;
  pushNotificationProtocolTypeId?: number | null;
  // Configuration: Display & Screen
  useDefaultLauncherTheme?: boolean | null;
  backgroundColor?: string | null;
  applicationNamesColor?: string | null;
  iconSize?: string | null;
  screenAlwaysOn?: boolean | null;
  manageScreenTimeout?: boolean | null;
  screenTimeoutSeconds?: number | null;
  // Configuration: Security & Controls
  enableKioskMode?: boolean | null;
  kioskModePackageId?: string | null;
  enableScreenLock?: boolean | null;
  blockExternalStorage?: boolean | null;
  isDefaultLauncher?: boolean | null;
  isDeviceAdminCodeEnabled?: boolean | null;
  deviceAdminCode?: string | null;
  allowToAccessSensitiveSettings?: boolean | null;
  strictAirplaneMode?: boolean | null;
  factoryResetLock?: boolean | null;
  networkResetLock?: boolean | null;
  appsControlLock?: boolean | null;
  // Configuration: Notifications / Location / Volume / Permissions
  notificationBarStateId?: number | null;
  enableNotifications?: boolean | null;
  hideSystemNotificationBarInLauncher?: boolean | null;
  showLauncherOwnNotificationBar?: boolean | null;
  locationTrackingByTypeId?: number | null;
  lockSystemOrientation?: boolean | null;
  lockLauncherOrientation?: boolean | null;
  lockVolume?: boolean | null;
  volumePercentage?: number | null;
  applicationPermissionGranterTypeId?: number | null;
}

export interface ApplyPolicyResult {
  deviceUuid: string;
  success: boolean;
  message: string;
}

/** Bulk block/unblock apps by package id on one or many devices. */
export interface BulkAppBlockRequest {
  deviceUuids: string[];
  appPackageIds: string[];
  /** false → block, true → unblock (allow) */
  isAllowed: boolean;
}

export interface BulkAppBlockResult {
  deviceUuid: string;
  success: boolean;
  updated: number;
  skipped: number;
  message: string;
}

/** One distinct app across the fleet (app picker for bulk block). */
export interface AppCatalogItem {
  appPackageId: string;
  appName: string;
  appIconBase64: string | null;
  isSystemApp: boolean;
  deviceCount: number;
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
  appCategory?: number;
  isTimeLimited?: boolean;
  isTimeLimitDailyAllowed?: boolean;
  allowedTimeLimitTillDate?: string | null;
  timeLimit?: number;
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
  isSystemApp?: boolean;
  isAllowed?: boolean;
  showIcon?: boolean;
  orderNumberInLauncher?: number;
  appCategory?: number;
  installUpdate?: boolean;
  appIconBase64?: string | null;
  isTimeLimited?: boolean;
  isTimeLimitDailyAllowed?: boolean;
  allowedTimeLimitTillDate?: string | null;
  timeLimit?: number;
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

export interface BlockedAppRequest {
  id: number;
  deviceId: number;
  deviceUuid: string;
  isIncludingRequest: boolean;
  isSensitiveSettings: boolean;
  packageId: string;
  deviceApplicationId: number;
  appName: string;
  reviewStatus: string;
  reviewedById: number | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewRemarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlockedAppReviewRequest {
  status: 'APPROVED' | 'REJECTED';
  reviewRemarks: string;
}

export interface DashboardTrendPoint {
  date: string;
  value: number;
}

export interface DashboardPlanAnalytics {
  totalPlansBought: number;
  activePlans: number;
  expiredPlans: number;
  expiringThisWeek: number;
  expiringThisMonth: number;
}

export interface DashboardSubscriptionAnalytics {
  subscriptionId: number;
  subscriptionName: string;
  packageExpiryDate: string;
  packageDaysRemaining: number;
  packageExpired: boolean;
  allowedDevices: number;
  devicesInUse: number;
  devicesRemaining: number;
  utilizationPercent: number;
}

export interface DashboardDevicesAnalytics {
  totalDevicesAdded: number;
  activeDevices: number;
  inactiveDevices: number;
  verifiedDevices: number;
  unverifiedDevices: number;
}

export interface DashboardUsersAnalytics {
  totalUsersAdded: number;
  activeUsers: number;
  inactiveUsers: number;
}

export interface DashboardConnectivityAnalytics {
  onlineDevices: number;
  offlineDevices: number;
  onlinePercent: number;
}

export interface DashboardSyncAnalytics {
  syncedInLast24Hours: number;
  staleSyncDevices: number;
  neverSyncedDevices: number;
}

export interface DeviceDashboardAnalytics {
  generatedAt: string;
  subscription?: DashboardSubscriptionAnalytics | null;
  devices: DashboardDevicesAnalytics;
  users?: DashboardUsersAnalytics;
  connectivity: DashboardConnectivityAnalytics;
  sync: DashboardSyncAnalytics;
  planAnalytics?: DashboardPlanAnalytics | null;
  enrollmentTrendLast7Days: DashboardTrendPoint[];
  syncTrendLast7Days: DashboardTrendPoint[];
}

export interface DeviceMonitorStateDashboard {
  deviceUuid: string;
  batteryCharge: number;
  isCharging: boolean;
  wifiEnabled: boolean;
  mobileDataEnabled: boolean;
  bluetoothEnabled: boolean;
  gpsEnabled: boolean;
  accessibilityEnabled: boolean;
  totalWifiDataBytes: number;
  totalMobileDataBytes: number;
  lastStateSyncTime: string;
  lastUpdate: string;
}

export interface DeviceAppUsageHistoryItem {
  id: number | null;
  packageName: string;
  appName: string;
  foregroundTimeMillis: number;
  usageStart: string;
  usageEnd: string;
  recordDate: string;
  createdAt: string | null;
}

export interface DeviceAppUsageHistoryQuery {
  from?: string;
  to?: string;
  page?: number;
  size?: number;
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
  bluetoothStateId?: number;
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
  kioskModePackageId?: string;
  deviceAdminCode?: string;
  isDeviceAdminCodeEnabled?: boolean;
  allowToAccessSensitiveSettings?: boolean;
  strictAirplaneMode?: boolean;
  factoryResetLock?: boolean;
  networkResetLock?: boolean;
  appsControlLock?: boolean;
  devicePassword?: string;
  // Root / compromise detection policy
  rootDetectionEnabled?: boolean;
  rootDetectionLockOnCompromise?: boolean;
  rootDetectionWipeOnCompromise?: boolean;
  rootDetectionMinSeverityForAction?: string;
  rootDetectionScanIntervalMinutes?: number;
  // OS Upgrade (System Update) policy
  systemUpdatePolicyType?: SystemUpdatePolicyType | null;
  maintenanceWindowStart?: number | null;
  maintenanceWindowEnd?: number | null;
  freezePeriodStart?: string | null;
  freezePeriodEnd?: string | null;
  // VPN management
  vpnEnabled?: boolean | null;
  vpnServerAddress?: string | null;
  vpnUsername?: string | null;
  vpnSecret?: string | null;
  vpnProtocolTypeId?: number | null;
  vpnRoutingRules?: string[] | null;
}
