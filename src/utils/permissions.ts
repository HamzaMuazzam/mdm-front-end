/**
 * Single source of truth for permission names used by the portal.
 * Every value must match a permissionName seeded by the backend
 * (TW-MDM-Backend → constants/PermissionConstants.java).
 *
 * Keep feature gates here rather than as raw strings in components so a rename
 * is a one-line change and `tsc` catches every usage.
 */
export const PERMISSIONS = {
  // Users / analytics
  USER_READ: 'user:read',
  USER_ANALYTICS: 'user:analytics',

  // Devices
  DEVICES_READ: 'devices:read',
  DEVICES_CREATE: 'devices:create',
  DEVICES_UPDATE: 'devices:update',
  DEVICES_DELETE: 'devices:delete',
  DEVICES_REMOTE_CONTROL: 'devices:remote-control',
  DEVICES_CONFIGURATIONS_READ: 'devices:configurations:read',
  DEVICES_CONFIGURATIONS_UPDATE: 'devices:configurations:update',
  DEVICES_APPLICATIONS_READ: 'devices:applications:read',

  // Device Groups (page + per-device "Manage Groups")
  DEVICE_GROUPS_READ: 'device-groups:read',
  DEVICE_GROUPS_MANAGE: 'device-groups:manage',

  // Screen Monitoring — monitor dashboard + live screen mirroring (one gate)
  SCREEN_MONITORING_ACCESS: 'screen-monitoring:access',

  // App Control
  APP_CONTROL_READ: 'app-control:read',
  APP_CONTROL_EXECUTE: 'app-control:execute',
  APP_CONTROL_CLEAR_DATA: 'app-control:clear-data',
  APP_CONTROL_CLEAR_CACHE_ALL: 'app-control:clear-cache-all',

  // Audio (one-way listen-in)
  DEVICE_AUDIO_LISTEN: 'device-audio:listen',
  DEVICE_AUDIO_READ: 'device-audio:read',

  // Device data
  DEVICE_DATA_READ: 'device-data:read',
  CONTACTS_READ: 'contacts:read',
  SMS_READ: 'sms:read',
  CALL_LOGS_READ: 'call-logs:read',

  // SIM change / system logs / integrity
  SIM_CHANGE_READ: 'sim-changes:read',
  DEVICE_LOGS_READ: 'device-logs:read',
  DEVICE_INTEGRITY_READ: 'device-integrity:read',

  // Notifications / alerts
  NOTIFICATIONS_VIEW_HISTORY: 'notifications:view-history',
  NOTIFICATIONS_MANAGE_ALERTS: 'notifications:manage-alerts',
  DEVICE_ALERT_SEND: 'device-alerts:send',
  DEVICE_ALERT_READ: 'device-alerts:read',

  // Audit Logs
  AUDIT_LOGS_READ: 'audit-logs:read',
  AUDIT_LOGS_EXPORT: 'audit-logs:export',
  AUDIT_LOGS_READ_ALL: 'audit-logs:read-all-accounts',
  AUDIT_LOGS_SETTINGS: 'audit-logs:settings',

  // Tracking
  TRACKING_HISTORY: 'tracking:history',
  TRACKING_LIVE: 'tracking:live-tracking',

  // Configuration / security groups / subscriptions
  CONFIGURATION_READ: 'configuration:read',
  CONFIGURATION_UPDATE: 'configuration:update',
  SECURITY_GROUP_READ: 'security-group:read',
  SUBSCRIPTIONS_READ: 'subscriptions:read',

  // App updates / management / file manager
  APP_UPDATES_UPLOAD: 'app-updates:upload',
  APP_MANAGEMENT_READ: 'app-management:read',
  APP_MANAGEMENT_UPLOAD: 'app-management:upload',
  APP_MANAGEMENT_DEPLOY: 'app-management:deploy',
  FILE_MANAGER_READ: 'file-manager:read',
  FILE_MANAGER_COMMAND: 'file-manager:command',

  // Attendance
  ATTENDANCE_RECORDS_READ: 'attendance:records:read',
  ATTENDANCE_ROSTERS_READ: 'attendance:rosters:read',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** A gate is satisfied when the user holds ANY of the listed permissions. */
export type PermissionGate = PermissionName | readonly PermissionName[];

export function gateSatisfied(gate: PermissionGate | undefined, has: (name: string) => boolean): boolean {
  if (!gate) return true;
  return Array.isArray(gate) ? gate.some((p) => has(p)) : has(gate as string);
}

/**
 * Which permission(s) unlock each dashboard tab. Used by Sidebar, BottomNav and
 * DashboardPage (to reject a ?tab= the user may not open) so the three never drift.
 */
export const TAB_PERMISSIONS = {
  analytics: PERMISSIONS.USER_ANALYTICS,
  reports: PERMISSIONS.USER_ANALYTICS,
  users: PERMISSIONS.USER_READ,
  subscriptions: PERMISSIONS.SUBSCRIPTIONS_READ,
  devices: PERMISSIONS.DEVICES_READ,
  'device-groups': PERMISSIONS.DEVICE_GROUPS_READ,
  attendance: [PERMISSIONS.ATTENDANCE_RECORDS_READ, PERMISSIONS.ATTENDANCE_ROSTERS_READ],
  configuration: PERMISSIONS.CONFIGURATION_READ,
  'security-groups': PERMISSIONS.SECURITY_GROUP_READ,
  'app-update': PERMISSIONS.APP_UPDATES_UPLOAD,
  'app-management': [PERMISSIONS.APP_MANAGEMENT_READ, PERMISSIONS.APP_MANAGEMENT_UPLOAD, PERMISSIONS.APP_MANAGEMENT_DEPLOY],
  'file-manager': [PERMISSIONS.FILE_MANAGER_READ, PERMISSIONS.FILE_MANAGER_COMMAND],
  'audit-logs': PERMISSIONS.AUDIT_LOGS_READ,
} as const satisfies Record<string, PermissionGate>;

export type DashboardTab = keyof typeof TAB_PERMISSIONS;

/** Order in which to fall back when the requested tab is not allowed. */
export const TAB_FALLBACK_ORDER: readonly DashboardTab[] = [
  'analytics', 'devices', 'reports', 'users', 'device-groups', 'attendance', 'subscriptions',
  'configuration', 'security-groups', 'app-update', 'app-management', 'file-manager', 'audit-logs',
];
