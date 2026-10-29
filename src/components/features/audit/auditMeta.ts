import type { AuditCategory, AuditOutcome, AuditSeverity } from '@/types/audit.types';

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  AUTH: 'Authentication', ACCESS: 'API access', USER_MGMT: 'User management', SECURITY: 'Security',
  DEVICE: 'Device', DEVICE_COMMAND: 'Device command', DEVICE_EVENT: 'Device event', CONFIGURATION: 'Configuration',
  APPS: 'Apps', DATA_ACCESS: 'Data access', ATTENDANCE: 'Attendance', TRACKING: 'Tracking', EXPORT: 'Export',
  AUDIT: 'Audit', SYSTEM: 'System',
};

export const OUTCOME_CLASS: Record<AuditOutcome, string> = {
  SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ACKED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  TIMEOUT: 'bg-orange-50 text-orange-700 border-orange-200',
  FAILURE: 'bg-red-50 text-red-700 border-red-200',
  DENIED: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const SEVERITY_STRIPE: Record<AuditSeverity, string> = {
  INFO: 'bg-gray-300', NOTICE: 'bg-blue-400', HIGH: 'bg-amber-500', CRITICAL: 'bg-red-600',
};

export const SEVERITY_CLASS: Record<AuditSeverity, string> = {
  INFO: 'bg-gray-50 text-gray-600 border-gray-200',
  NOTICE: 'bg-blue-50 text-blue-700 border-blue-200',
  HIGH: 'bg-amber-50 text-amber-800 border-amber-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
};

/** "DEVICE_WIPE" → "Device wipe"; "HTTP_POST" → "HTTP POST". */
export function humanAction(action: string): string {
  if (action.startsWith('HTTP_')) return action.replace('_', ' ');
  if (action === 'API_READ') return 'API read';
  const words = action.toLowerCase().split('_');
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1)
    .replace(/\bmqtt\b/g, 'MQTT').replace(/\bota\b/g, 'OTA').replace(/\bsim\b/g, 'SIM').replace(/\bsos\b/g, 'SOS')
    .replace(/\bssl\b/g, 'SSL').replace(/\bapi\b/g, 'API').replace(/\bapp\b/g, 'app');
}

export function fmtTime(ts: string | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(d);
}

export function fmtTimeFull(ts: string | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.toLocaleString()} (UTC ${d.toISOString()})`;
}

export const RANGE_PRESETS: { key: string; label: string; hours: number }[] = [
  { key: '1h', label: 'Last hour', hours: 1 },
  { key: '24h', label: 'Last 24 h', hours: 24 },
  { key: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { key: '30d', label: 'Last 30 days', hours: 24 * 30 },
  { key: '90d', label: 'Last 90 days', hours: 24 * 90 },
];
