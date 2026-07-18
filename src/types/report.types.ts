// Types for the fleet Reporting module (mirrors backend /v1/reports DTOs)

export interface ReportTrendPoint {
  date: string; // yyyy-MM-dd
  value: number;
}

export interface ReportNameCount {
  name: string;
  count: number;
}

export interface ReportOverview {
  generatedAt: string;
  // fleet
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  onlinePercent: number;
  enrolledLast30Days: number;
  // compliance
  avgComplianceScore: number;
  compliantDevices: number;
  atRiskDevices: number;
  nonCompliantDevices: number;
  // security
  cleanDevices: number;
  suspiciousDevices: number;
  compromisedDevices: number;
  notScannedDevices: number;
  integrityAlerts: number;
  simAlerts: number;
  // users
  totalUsers: number;
  activeUsers: number;
  // apps
  distinctApps: number;
  blockedInstallations: number;
  // ota
  upToDateDevices: number;
  outdatedDevices: number;
  // policy adoption
  kioskModeDevices: number;
  rootDetectionDevices: number;
  factoryResetLockedDevices: number;
  vpnEnabledDevices: number;
  // charts
  enrollmentTrendLast30Days: ReportTrendPoint[];
  osDistribution: ReportNameCount[];
  appVersionDistribution: ReportNameCount[];
  modelDistribution: ReportNameCount[];
}

export type ComplianceStatus = 'COMPLIANT' | 'AT_RISK' | 'NON_COMPLIANT';

export interface DeviceComplianceRow {
  deviceUuid: string;
  deviceName: string | null;
  model: string | null;
  osVersion: string | null;
  appVersionName: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  online: boolean;
  batteryCharge: number | null;
  enrollTime: string | null;
  lastStateSyncTime: string | null;
  verified: boolean | null;
  deviceAdmin: boolean | null;
  kioskMode: boolean | null;
  integrityStatus: string | null;
  integritySeverity: string | null;
  simAlerts: number;
  complianceScore: number;
  complianceStatus: ComplianceStatus;
  issues: string[];
}

export interface DeviceComplianceReport {
  generatedAt: string;
  totalDevices: number;
  compliantDevices: number;
  atRiskDevices: number;
  nonCompliantDevices: number;
  avgComplianceScore: number;
  rows: DeviceComplianceRow[];
}

export interface IntegrityEventRow {
  deviceUuid: string | null;
  deviceName: string | null;
  status: string | null;
  severity: string | null;
  indicatorCount: number | null;
  playIntegrityVerdict: string | null;
  securityAlert: boolean | null;
  eventTime: string | null;
}

export interface SimEventRow {
  deviceUuid: string | null;
  deviceName: string | null;
  eventType: string | null;
  carrierName: string | null;
  phoneNumber: string | null;
  securityAlert: boolean | null;
  eventTime: string | null;
}

export interface SecurityReport {
  generatedAt: string;
  devicesScanned: number;
  cleanDevices: number;
  suspiciousDevices: number;
  compromisedDevices: number;
  notScannedDevices: number;
  severityDistribution: ReportNameCount[];
  totalIntegrityEvents: number;
  integrityAlerts: number;
  recentIntegrityEvents: IntegrityEventRow[];
  totalSimEvents: number;
  simAlerts: number;
  recentSimEvents: SimEventRow[];
  screenSessionsTotal: number;
  screenSessionsActive: number;
}

export interface AppCatalogRow {
  packageId: string;
  appName: string;
  deviceCount: number;
  blockedCount: number;
}

export interface AppUsageRow {
  packageId: string;
  appName: string;
  foregroundMillis: number;
  foregroundHours: number;
}

export interface ApplicationReport {
  generatedAt: string;
  distinctApps: number;
  totalInstallations: number;
  blockedInstallations: number;
  topApps: AppCatalogRow[];
  blockedApps: AppCatalogRow[];
  topUsedApps: AppUsageRow[];
}

export interface UserReportRow {
  userId: number;
  fullName: string | null;
  email: string;
  role: string | null;
  active: boolean | null;
  devicesOwned: number;
  createdAt: string | null;
}

export interface UserReport {
  generatedAt: string;
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  rows: UserReportRow[];
}

export interface UsageDataRow {
  deviceUuid: string;
  deviceName: string | null;
  wifiBytes: number;
  mobileBytes: number;
  totalBytes: number;
  batteryCharge: number | null;
  lastStateSyncTime: string | null;
}

export interface UsageReport {
  generatedAt: string;
  totalWifiBytes: number;
  totalMobileBytes: number;
  totalBytes: number;
  topDataConsumers: UsageDataRow[];
  avgBatteryPercent: number;
  lowBatteryDevices: number;
  chargingDevices: number;
  syncedLast24h: number;
  staleDevices: number;
  neverSyncedDevices: number;
}

export type ReportExportType = 'devices' | 'security' | 'applications' | 'users' | 'usage';
