export type AuditCategory =
  | 'AUTH' | 'ACCESS' | 'USER_MGMT' | 'SECURITY' | 'DEVICE' | 'DEVICE_COMMAND' | 'DEVICE_EVENT'
  | 'CONFIGURATION' | 'APPS' | 'DATA_ACCESS' | 'ATTENDANCE' | 'TRACKING' | 'EXPORT' | 'AUDIT' | 'SYSTEM';
export type AuditSeverity = 'INFO' | 'NOTICE' | 'HIGH' | 'CRITICAL';
export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'DENIED' | 'PENDING' | 'ACKED' | 'TIMEOUT';
export type AuditActorType = 'USER' | 'DEVICE' | 'SYSTEM' | 'ANONYMOUS';

export interface AuditEvent {
  id: number;
  eventTime: string;
  ownerId: number | null;
  actorType: AuditActorType;
  actorId: number | null;
  actorLabel: string | null;
  actorSecurityGroup: string | null;
  category: AuditCategory;
  action: string;
  severity: AuditSeverity;
  outcome: AuditOutcome;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  deviceId: number | null;
  deviceUuid: string | null;
  httpMethod: string | null;
  pathTemplate: string | null;
  httpStatus: number | null;
  durationMs: number | null;
  clientIp: string | null;
  userAgent: string | null;
  requestId: string | null;
  correlationId: string | null;
  permissionRequired: string | null;
  details: Record<string, unknown> | null;
  prevHash: string | null;
  rowHash: string | null;
}

export interface AuditFilter {
  from?: string;
  to?: string;
  category?: string[];
  action?: string[];
  outcome?: string[];
  severity?: string[];
  actorType?: string;
  actor?: string;
  deviceId?: number;
  targetType?: string;
  targetId?: string;
  ip?: string;
  permission?: string;
  q?: string;
  ownerId?: string;
  page?: number;
  size?: number;
}

export interface AuditSummary {
  from: string;
  to: string;
  total: number;
  byOutcome: Record<string, number>;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  loginFailures: number;
  denied: number;
  pendingCommands: number;
  exports: number;
  topActors: { label: string; n: number }[];
  topDevices: { id: number; label: string | null; n: number }[];
  perHour: { hour: string; n: number }[];
}

export interface AuditFacets {
  actions: string[];
  actors: { type: AuditActorType; id: number | null; label: string }[];
  targetTypes: string[];
  permissions: string[];
  categories: AuditCategory[];
  outcomes: AuditOutcome[];
  severities: AuditSeverity[];
}

export interface AuditHealth {
  queueDepth: number;
  queueCapacity: number;
  written: number;
  failedWrites: number;
  lastWriteAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  running: boolean;
}

export interface AuditVerifyResult {
  result: 'PASS' | 'FAIL';
  rowsChecked: number;
  rowsInRange: number;
  firstBadRowId: number | null;
  reason: string | null;
}

export interface AuditSettings {
  retentionDays: Record<string, number>;
  defaultRetentionDays: number;
  alertEmails: string[];
  alertOnCritical: boolean;
  alertOnLockout: boolean;
  alertOnPermissionChange: boolean;
  alertOnIntegrityFail: boolean;
  syslogHost: string | null;
  syslogPort: number;
  syslogProtocol: 'UDP' | 'TCP';
  syslogMinSeverity: AuditSeverity;
  dailyExportEnabled: boolean;
  dailyExportDir: string;
  lockoutThreshold: number;
  lockoutMinutes: number;
}

export interface AuditExportJob {
  id: number;
  requestedBy: string | null;
  format: 'csv' | 'jsonl';
  status: 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED' | 'EXPIRED';
  rowCount: number | null;
  sha256: string | null;
  fileSize: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  expiresAt: string | null;
}
