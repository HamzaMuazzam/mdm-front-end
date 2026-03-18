import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Siren,
  Send,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Volume2,
  Timer,
} from 'lucide-react';
import { useDevicesQuery } from '@/hooks/useDevices';
import { alertService, type AlertRecord } from '@/api/services/alert.service';
import { ROUTES } from '@/utils/constants';
import { usePermissionStore } from '@/store/permissionStore';

/* ─── types ──────────────────────────────────────────────────────────────── */
type AlertStatus = AlertRecord['status'];

/* ─── helpers ────────────────────────────────────────────────────────────── */
const STATUS_META: Record<AlertStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING:      { label: 'Pending',      cls: 'text-amber-700  bg-amber-50  border-amber-200',  icon: <Loader2  className="h-3 w-3 animate-spin" /> },
  SENT:         { label: 'Sent',         cls: 'text-blue-700   bg-blue-50   border-blue-200',   icon: <Clock    className="h-3 w-3" /> },
  FAILED:       { label: 'Failed',       cls: 'text-red-700    bg-red-50    border-red-200',    icon: <XCircle  className="h-3 w-3" /> },
  ACKNOWLEDGED: { label: 'Acknowledged', cls: 'text-green-700  bg-green-50  border-green-200',  icon: <CheckCircle2 className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: AlertStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${m.cls}`}>
      {m.icon}{m.label}
    </span>
  );
}

function fmt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.replace(/(\.\d{3})\d+/, '$1'));
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

/* ─── quick-message presets ──────────────────────────────────────────────── */
const PRESETS = [
  { label: '🚨 Emergency!',     title: 'Emergency Alert!',      message: 'Please respond immediately!' },
  { label: '🏠 Come Home',      title: 'Come Home Now',         message: 'Please head home right away.' },
  { label: '📞 Call Me',        title: 'Call Me Urgently',      message: 'Please call me as soon as possible.' },
  { label: '⚠️ Check In',       title: 'Check-in Required',     message: 'Please confirm you are safe.' },
];

/* ─── history item card ──────────────────────────────────────────────────── */
function HistoryCard({ alert }: { alert: AlertRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{alert.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{fmt(alert.sentAt)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <StatusBadge status={alert.status} />
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 text-sm border-t border-border bg-muted/30">
          {alert.message && (
            <p className="pt-3 text-muted-foreground">{alert.message}</p>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-xs">
            <span className="text-muted-foreground">Sound</span>
            <span>{alert.sound ?? '—'}</span>
            <span className="text-muted-foreground">Duration</span>
            <span>{alert.duration != null ? `${alert.duration}s` : '—'}</span>
            <span className="text-muted-foreground">Sent</span>
            <span>{fmt(alert.sentAt)}</span>
            <span className="text-muted-foreground">Acknowledged</span>
            <span>{fmt(alert.acknowledgedAt)}</span>
            {alert.errorMessage && (
              <>
                <span className="text-red-600">Error</span>
                <span className="text-red-600">{alert.errorMessage}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── page ───────────────────────────────────────────────────────────────── */
export function DeviceAlertPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const hasPermission = usePermissionStore((s) => s.hasPermission);

  const numericId = deviceId ? parseInt(deviceId, 10) : null;
  const { data: devices = [], isLoading } = useDevicesQuery();
  const device = devices.find((d) => d.id === numericId);

  const [title,    setTitle]    = useState('Emergency Alert!');
  const [message,  setMessage]  = useState('');
  const [sound,    setSound]    = useState('alarm_default');
  const [duration, setDuration] = useState(60);

  const [sending,        setSending]        = useState(false);
  const [lastAlert,      setLastAlert]      = useState<AlertRecord | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [sentSuccess,    setSentSuccess]    = useState(false);

  const [history,        setHistory]        = useState<AlertRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded,  setHistoryLoaded]  = useState(false);

  const canSend = hasPermission('device-alerts:send');
  const canRead = hasPermission('device-alerts:read');

  function applyPreset(p: typeof PRESETS[number]) {
    setTitle(p.title);
    setMessage(p.message);
  }

  async function handleSend() {
    if (!device) return;
    setSending(true);
    setError(null);
    setSentSuccess(false);
    try {
      const result = await alertService.sendAlert({
        deviceUuid: device.deviceUuid,
        title,
        message: message || undefined,
        sound,
        duration,
      });
      setLastAlert(result);
      setSentSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send alert');
    } finally {
      setSending(false);
    }
  }

  async function handleRefreshStatus() {
    if (!lastAlert) return;
    try {
      setLastAlert(await alertService.getAlert(lastAlert.id));
    } catch { /* ignore */ }
  }

  async function handleLoadHistory() {
    if (!device) return;
    setLoadingHistory(true);
    try {
      const page = await alertService.getAlertsByDevice(device.deviceUuid);
      setHistory(page.content ?? []);
      setHistoryLoaded(true);
    } catch { /* ignore */ }
    finally { setLoadingHistory(false); }
  }

  /* ── loading / not-found states ── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-8 text-center">
        <XCircle className="h-12 w-12 text-red-400" />
        <p className="text-muted-foreground">Device not found.</p>
        <button
          className="text-sm text-primary underline"
          onClick={() => navigate(ROUTES.DASHBOARD, { state: { activeTab: 'devices' } })}
        >
          Go to device list
        </button>
      </div>
    );
  }

  const deviceLabel = device.deviceName ?? device.deviceUuid.slice(0, 12) + '…';
  const isReady = canSend && title.trim() && !sending;

  /* ── main layout: sticky header + scrollable body + fixed bottom CTA ── */
  return (
    <div className="flex flex-col h-screen bg-background">

      {/* ── sticky top header ────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-20">
        <button
          type="button"
          onClick={() => navigate(ROUTES.DASHBOARD, { state: { activeTab: 'devices' } })}
          className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">Send Alarm</p>
          <p className="text-xs text-muted-foreground truncate">{deviceLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200">
          <Siren className="h-3.5 w-3.5 text-red-600" />
          <span className="text-xs font-semibold text-red-700 whitespace-nowrap">High Priority</span>
        </div>
      </header>

      {/* ── scrollable body ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-36 space-y-5">

          {/* ── success banner ── */}
          {sentSuccess && lastAlert && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800">Alarm sent!</p>
                <p className="text-xs text-green-700 mt-0.5">
                  The device will play the alarm at full volume.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={lastAlert.status} />
                <button
                  type="button"
                  onClick={handleRefreshStatus}
                  className="p-1 rounded-full hover:bg-green-100 text-green-600 transition-colors"
                  aria-label="Refresh status"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── error banner ── */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* ── no-permission banner ── */}
          {!canSend && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <Siren className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">You do not have permission to send alarms.</p>
            </div>
          )}

          {/* ── quick presets ── */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
              Quick Presets
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  disabled={!canSend}
                  className="flex items-center gap-2 px-3 py-3 rounded-xl border border-border bg-card hover:bg-muted active:scale-95 transition-all text-left text-sm font-medium text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {/* ── alert title ── */}
          <section className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Alert Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              disabled={!canSend}
              placeholder="Emergency Alert!"
              className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent disabled:opacity-50 transition-shadow"
            />
          </section>

          {/* ── message ── */}
          <section className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Message <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={!canSend}
              placeholder="Add a message for the child…"
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent disabled:opacity-50 transition-shadow"
            />
          </section>

          {/* ── sound + duration ── */}
          <section className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Volume2 className="h-3.5 w-3.5" /> Sound
              </label>
              <select
                value={sound}
                onChange={(e) => setSound(e.target.value)}
                disabled={!canSend}
                className="w-full h-12 px-3 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 transition-shadow"
              >
                <option value="alarm_default">Default</option>
                <option value="alarm_urgent">Urgent</option>
                <option value="alarm_soft">Soft</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Timer className="h-3.5 w-3.5" /> Duration (s)
              </label>
              <input
                type="number"
                min={5}
                max={300}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={!canSend}
                className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 transition-shadow"
              />
            </div>
          </section>

          {/* ── history ── */}
          {canRead && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Alert History
                </p>
                <button
                  type="button"
                  onClick={handleLoadHistory}
                  disabled={loadingHistory}
                  className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline disabled:opacity-50"
                >
                  {loadingHistory
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Loading…</>
                    : <><RefreshCw className="h-3 w-3" /> {historyLoaded ? 'Refresh' : 'Load history'}</>
                  }
                </button>
              </div>

              {historyLoaded && history.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No alerts sent yet.</p>
              )}

              <div className="space-y-2">
                {history.map((a) => <HistoryCard key={a.id} alert={a} />)}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ── fixed bottom send button ──────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-4 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleSend}
            disabled={!isReady}
            className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base transition-all shadow-lg shadow-red-600/30 active:scale-[0.98]"
          >
            {sending
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Sending alarm…</>
              : <><Send className="h-5 w-5" /> Send Alarm Now</>
            }
          </button>
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            Alarm plays at full volume · overrides silent &amp; DND
          </p>
        </div>
      </div>
    </div>
  );
}
