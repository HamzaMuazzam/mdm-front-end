import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Save,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useDevicesQuery } from '@/hooks/useDevices';
import {
  timeRangeService,
  type TimeRangeRecord,
} from '@/api/services/timerange.service';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.replace(/(\.\d{3})\d+/, '$1'));
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

const COMMON_TIMEZONES = [
  'device',
  'UTC',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dubai',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Australia/Sydney',
];

// ── Page ──────────────────────────────────────────────────────────────────────

export function DeviceTimeRangePage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const { data: devicesPage } = useDevicesQuery();

  const device = devicesPage?.content?.find((d: { deviceUuid?: string }) => d.deviceUuid === deviceId);

  const [record, setRecord] = useState<TimeRangeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [timezone, setTimezone] = useState('device');
  const [enabled, setEnabled] = useState(true);

  // ── Load existing config ────────────────────────────────────────────────

  useEffect(() => {
    if (!deviceId) return;
    setLoading(true);
    timeRangeService.get(deviceId)
      .then((r) => {
        setRecord(r);
        setStartTime(r.startTime);
        setEndTime(r.endTime);
        setTimezone(r.timezone);
        setEnabled(r.enabled);
      })
      .catch(() => {
        // 404 = no config yet — that's fine
        setRecord(null);
      })
      .finally(() => setLoading(false));
  }, [deviceId]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!deviceId) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await timeRangeService.assign(deviceId, {
        startTime,
        endTime,
        timezone,
        enabled,
      });
      setRecord(updated);
      setSuccessMsg('Time range saved and pushed to device.');
    } catch {
      setError('Failed to save time range. Check the values and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!deviceId || !record) return;
    try {
      const updated = await timeRangeService.setEnabled(deviceId, !record.enabled);
      setRecord(updated);
      setEnabled(updated.enabled);
      setSuccessMsg(`Time range ${updated.enabled ? 'enabled' : 'disabled'}.`);
    } catch {
      setError('Failed to toggle time range.');
    }
  };

  const handleRemove = async () => {
    if (!deviceId || !record) return;
    if (!window.confirm('Remove the time range? The device will be fully accessible again.')) return;
    setRemoving(true);
    setError(null);
    try {
      await timeRangeService.remove(deviceId);
      setRecord(null);
      setSuccessMsg('Time range removed. Device is now always accessible.');
    } catch {
      setError('Failed to remove time range.');
    } finally {
      setRemoving(false);
    }
  };

  const handleRefresh = () => {
    if (!deviceId) return;
    setLoading(true);
    timeRangeService.get(deviceId)
      .then((r) => { setRecord(r); setStartTime(r.startTime); setEndTime(r.endTime); setTimezone(r.timezone); setEnabled(r.enabled); })
      .catch(() => setRecord(null))
      .finally(() => setLoading(false));
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-page-bg pb-16">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base truncate">Usage Time Range</h1>
          {device && (
            <p className="text-xs text-muted-foreground truncate">
              {(device as { model?: string }).model ?? deviceId}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

        {/* Status banner */}
        {record ? (
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            record.enabled
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            {record.enabled
              ? <ShieldCheck className="h-5 w-5 shrink-0" />
              : <ShieldOff className="h-5 w-5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {record.enabled ? 'Active' : 'Disabled'}
              </p>
              <p className="text-xs opacity-80">
                {record.enabled
                  ? `Allowed: ${record.startTime} – ${record.endTime} (${record.timezone})`
                  : 'Device is always accessible'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleEnabled}
              className="shrink-0 p-1 rounded hover:opacity-70 transition-opacity"
              title={record.enabled ? 'Disable' : 'Enable'}
            >
              {record.enabled
                ? <ToggleRight className="h-6 w-6" />
                : <ToggleLeft  className="h-6 w-6" />}
            </button>
          </div>
        ) : (
          !loading && (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-muted-foreground">
              <Clock className="h-5 w-5 shrink-0" />
              <p className="text-sm">No time range configured. Set one below.</p>
            </div>
          )
        )}

        {/* Toast messages */}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800 text-sm">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {successMsg}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Config form */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-medium text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Configure Time Range
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Start Time (allowed from)
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                End Time (lock after)
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Midnight-crossing hint */}
          {startTime > endTime && (
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              Midnight-crossing range detected: device unlocks at {startTime} and locks at {endTime} next day.
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz === 'device' ? 'Device local timezone' : tz}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              "Device local timezone" follows the device's system clock timezone.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                enabled
                  ? 'border-green-300 bg-green-50 text-green-800 hover:bg-green-100'
                  : 'border-border bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              {enabled ? 'Enabled' : 'Disabled'}
            </button>
            <span className="text-xs text-muted-foreground">
              {enabled ? 'Policy will be enforced on device.' : 'Policy saved but not enforced.'}
            </span>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save & Push to Device'}
            </button>

            {record && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-2.5 text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {removing ? 'Removing…' : 'Remove'}
              </button>
            )}
          </div>
        </div>

        {/* Audit info */}
        {record && (
          <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-2">
            <h2 className="font-medium text-sm">Audit</h2>
            <div className="grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
              <span>Created</span>
              <span className="text-foreground text-right">{fmt(record.createdAt)}</span>
              <span>Last updated</span>
              <span className="text-foreground text-right">{fmt(record.updatedAt)}</span>
              <span>Assigned by</span>
              <span className="text-foreground text-right truncate">{record.assignedByEmail ?? '—'}</span>
            </div>
          </div>
        )}

        {/* Info card */}
        <div className="rounded-xl border border-border bg-muted/30 px-5 py-4 space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground text-sm">How it works</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>During the allowed window the device PIN is removed and the screen is accessible.</li>
            <li>Outside the allowed window the device is locked with the stored PIN.</li>
            <li>The policy survives reboots and timezone changes automatically.</li>
            <li>Midnight-crossing ranges (e.g. 22:00–06:00) are fully supported.</li>
            <li>Manual clock rollback is detected and triggers an immediate lock.</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
