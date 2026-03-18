import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Mic,
  MicOff,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { useDevicesQuery } from '@/hooks/useDevices';
import { useAudioStream } from '@/hooks/useAudioStream';
import { audioService, type AudioSessionRecord } from '@/api/services/audio.service';
import { ROUTES } from '@/utils/constants';
import { usePermissionStore } from '@/store/permissionStore';

/* ─── types ──────────────────────────────────────────────────────────────── */
type SessionStatus = AudioSessionRecord['status'];

const STATUS_META: Record<SessionStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  ACTIVE:  { label: 'Active',   cls: 'text-green-700 bg-green-50  border-green-200',  icon: <Mic      className="h-3 w-3" /> },
  STOPPED: { label: 'Stopped',  cls: 'text-blue-700  bg-blue-50   border-blue-200',   icon: <Clock    className="h-3 w-3" /> },
  ERROR:   { label: 'Error',    cls: 'text-red-700   bg-red-50    border-red-200',     icon: <XCircle  className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: SessionStatus }) {
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

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/* ─── waveform visualizer (simple bars using analyser) ───────────────────── */
function Waveform({ active }: { active: boolean }) {
  const bars = Array.from({ length: 20 }, (_, i) => i);
  return (
    <div className="flex items-end justify-center gap-1 h-16">
      {bars.map((i) => (
        <div
          key={i}
          className={`w-2 rounded-full transition-all duration-150 ${active ? 'bg-green-500' : 'bg-muted'}`}
          style={{
            height: active
              ? `${20 + Math.abs(Math.sin((Date.now() / 300 + i * 0.8))) * 44}%`
              : '20%',
          }}
        />
      ))}
    </div>
  );
}

/* ─── history card ───────────────────────────────────────────────────────── */
function HistoryCard({ session }: { session: AudioSessionRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">
            {fmtDuration(session.durationSeconds)} session
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{fmt(session.startedAt)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <StatusBadge status={session.status} />
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-1 text-sm border-t border-border bg-muted/30">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-3 text-xs">
            <span className="text-muted-foreground">Started</span>
            <span>{fmt(session.startedAt)}</span>
            <span className="text-muted-foreground">Stopped</span>
            <span>{fmt(session.stoppedAt)}</span>
            <span className="text-muted-foreground">Duration</span>
            <span>{fmtDuration(session.durationSeconds)}</span>
            <span className="text-muted-foreground">By</span>
            <span>{session.startedByEmail ?? '—'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── live timer ─────────────────────────────────────────────────────────── */
function useLiveTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      setSeconds(0);
      const id = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
      return () => clearInterval(id);
    } else {
      setSeconds(0);
    }
  }, [running]);

  return fmtDuration(seconds);
}

/* ─── page ───────────────────────────────────────────────────────────────── */
export function DeviceAudioPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const hasPermission = usePermissionStore((s) => s.hasPermission);

  const numericId = deviceId ? parseInt(deviceId, 10) : null;
  const { data: devices = [], isLoading } = useDevicesQuery();
  const device = devices.find((d) => d.id === numericId);

  const [active,         setActive]         = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<AudioSessionRecord | null>(null);

  const [history,        setHistory]        = useState<AudioSessionRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const canListen = hasPermission('device-audio:listen');
  const canRead   = hasPermission('device-audio:read');

  const liveTimer = useLiveTimer(active);

  // Subscribe to MQTT audio stream while active
  useAudioStream(device?.deviceUuid ?? null, active);

  // Check for an already-active session on mount
  useEffect(() => {
    if (!device) return;
    audioService.isActive(device.deviceUuid).then((isActive) => {
      setActive(isActive);
    }).catch(() => {/* ignore */});
  }, [device]);

  async function handleStart() {
    if (!device) return;
    setLoading(true);
    setError(null);
    try {
      const session = await audioService.startListen(device.deviceUuid);
      setCurrentSession(session);
      setActive(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start audio session');
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    if (!device) return;
    setLoading(true);
    setError(null);
    try {
      const session = await audioService.stopListen(device.deviceUuid);
      setCurrentSession(session);
      setActive(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to stop audio session');
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    if (!device) return;
    setLoadingHistory(true);
    try {
      const page = await audioService.getSessions(device.deviceUuid);
      setHistory(page.content ?? []);
    } catch { /* ignore */ } finally {
      setLoadingHistory(false);
    }
  }

  function goBack() {
    navigate(ROUTES.DASHBOARD, { state: { activeTab: 'devices' } });
  }

  /* ─── loading state ─────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ─── render ────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen bg-page-bg">

      {/* ── sticky header ── */}
      <div className="shrink-0 bg-card border-b border-border px-4">
        <div className="flex items-center gap-3 h-14">
          <button
            type="button"
            onClick={goBack}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate leading-tight">
              {device?.deviceName ?? 'Unknown Device'}
            </p>
            <p className="text-xs text-muted-foreground truncate">{device?.deviceUuid}</p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${active ? 'text-green-700 bg-green-50 border-green-200' : 'text-muted-foreground bg-muted border-transparent'}`}>
            {active ? 'Live' : 'Idle'}
          </span>
        </div>
      </div>

      {/* ── scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">

        {/* ── waveform + timer ── */}
        <div className="rounded-2xl bg-card border border-border px-5 py-6 flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full flex items-center justify-center
                          bg-green-100 text-green-600">
            {active ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
          </div>
          <Waveform active={active} />
          {active && (
            <p className="text-2xl font-mono font-semibold text-foreground tracking-wider">
              {liveTimer}
            </p>
          )}
          {!active && (
            <p className="text-sm text-muted-foreground">
              {canListen ? 'Tap the button below to start listening' : 'You do not have permission to listen'}
            </p>
          )}
        </div>

        {/* ── current session info ── */}
        {currentSession && (
          <div className={`rounded-xl border px-4 py-3 ${currentSession.status === 'ERROR' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`h-4 w-4 ${currentSession.status === 'ERROR' ? 'text-red-600' : 'text-green-600'}`} />
              <p className={`text-sm font-medium ${currentSession.status === 'ERROR' ? 'text-red-700' : 'text-green-700'}`}>
                {currentSession.status === 'STOPPED'
                  ? `Session ended · ${fmtDuration(currentSession.durationSeconds)}`
                  : currentSession.status === 'ACTIVE'
                    ? 'Session is live'
                    : 'Session error'}
              </p>
            </div>
          </div>
        )}

        {/* ── error banner ── */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ── session history ── */}
        {canRead && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Session History</h2>
              <button
                type="button"
                onClick={loadHistory}
                disabled={loadingHistory}
                className="text-xs text-primary font-medium disabled:opacity-50"
              >
                {loadingHistory ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            {history.length === 0 && !loadingHistory && (
              <p className="text-sm text-muted-foreground text-center py-6">No sessions yet.</p>
            )}
            <div className="space-y-2">
              {history.map((s) => <HistoryCard key={s.id} session={s} />)}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-2">
          Audio streamed one-way · microphone only · TLS encrypted
        </p>
      </div>

      {/* ── bottom CTA ── */}
      {canListen && (
        <div className="shrink-0 px-4 pt-3 pb-5 bg-card border-t border-border">
          <button
            type="button"
            onClick={active ? handleStop : handleStart}
            disabled={loading || !device}
            className={`w-full h-14 rounded-2xl flex items-center justify-center gap-3
                        font-semibold text-base transition-all disabled:opacity-50
                        ${active
                          ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-lg shadow-red-500/30'
                          : 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white shadow-lg shadow-green-500/30'
                        }`}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : active ? (
              <><MicOff className="h-5 w-5" /> Stop Listening</>
            ) : (
              <><Mic className="h-5 w-5" /> Start Listening</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
