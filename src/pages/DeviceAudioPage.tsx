import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Mic,
  MicOff,
  Radio,
  Moon,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { useDevicesQuery } from '@/hooks/useDevices';
import { useAudioStream } from '@/hooks/useAudioStream';
import { useVoicePushToTalk } from '@/hooks/useVoicePushToTalk';
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

/* ─── toggle row ─────────────────────────────────────────────────────────── */
function ToggleRow({
  icon, label, description, checked, onChange, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${disabled ? 'opacity-40' : ''}`}>
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none
          ${checked ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform
            ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}

/* ─── waveform visualizer ─────────────────────────────────────────────────── */
function Waveform({ active, sending }: { active: boolean; sending: boolean }) {
  const color = sending ? 'bg-blue-500' : active ? 'bg-green-500' : 'bg-muted';
  return (
    <div className="flex items-end justify-center gap-1 h-16">
      {Array.from({ length: 20 }, (_, i) => (
        <div
          key={i}
          className={`w-2 rounded-full transition-all duration-150 ${color}`}
          style={{
            height: (active || sending)
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
          <p className="font-medium text-sm text-foreground">{fmtDuration(session.durationSeconds)} session</p>
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
            <span className="text-muted-foreground">Started</span><span>{fmt(session.startedAt)}</span>
            <span className="text-muted-foreground">Stopped</span><span>{fmt(session.stoppedAt)}</span>
            <span className="text-muted-foreground">Duration</span><span>{fmtDuration(session.durationSeconds)}</span>
            <span className="text-muted-foreground">By</span><span>{session.startedByEmail ?? '—'}</span>
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
  const navigate     = useNavigate();
  const hasPermission = usePermissionStore((s) => s.hasPermission);

  const numericId = deviceId ? parseInt(deviceId, 10) : null;
  const { data: devices = [], isLoading } = useDevicesQuery();
  const device = devices.find((d) => d.id === numericId);

  // ── session state ──
  const [active,         setActive]         = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<AudioSessionRecord | null>(null);

  // ── options ──
  const [listenInDark, setListenInDark] = useState(false);
  const [sendVoice,    setSendVoice]    = useState(false);

  // ── history ──
  const [history,        setHistory]        = useState<AudioSessionRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const canListen = hasPermission('device-audio:listen');
  const canRead   = hasPermission('device-audio:read');

  const liveTimer = useLiveTimer(active);

  // Subscribe to device audio stream while listening
  const { screenOnStop } = useAudioStream(device?.deviceUuid ?? null, active);

  // Device stopped the session because screen turned on (listenInDark mode)
  useEffect(() => {
    if (screenOnStop && active) {
      setActive(false);
      setCurrentSession(null);
      setError('Session ended — device screen turned on.');
    }
  }, [screenOnStop, active]);

  // Push-to-talk
  const { isHolding, startTalking, stopTalking, pttError } = useVoicePushToTalk(
    device?.deviceUuid ?? null,
    sendVoice && canListen,
  );

  // Check for already-active session on mount
  useEffect(() => {
    if (!device) return;
    audioService.isActive(device.deviceUuid)
      .then(setActive)
      .catch(() => {/* ignore */});
  }, [device]);

  async function handleStart() {
    if (!device) return;
    setLoading(true);
    setError(null);
    try {
      const session = await audioService.startListen(device.deviceUuid, listenInDark);
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

  /* ─── loading ─────────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ─── render ──────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen bg-page-bg">

      {/* ── header ── */}
      <div className="shrink-0 bg-card border-b border-border px-4">
        <div className="flex items-center gap-3 h-14">
          <button type="button" onClick={goBack} className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate leading-tight">{device?.deviceName ?? 'Unknown Device'}</p>
            <p className="text-xs text-muted-foreground truncate">{device?.deviceUuid}</p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
            active ? 'text-green-700 bg-green-50 border-green-200' : 'text-muted-foreground bg-muted border-transparent'
          }`}>
            {active ? 'Live' : 'Idle'}
          </span>
        </div>
      </div>

      {/* ── scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

        {/* ── waveform + timer ── */}
        <div className="rounded-2xl bg-card border border-border px-5 py-6 flex flex-col items-center gap-4">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center
            ${isHolding ? 'bg-blue-100' : active ? 'bg-green-100' : 'bg-muted'}`}>
            {isHolding
              ? <Radio className="h-4 w-4 text-blue-600" />
              : active
                ? <Mic className="h-4 w-4 text-green-600" />
                : <MicOff className="h-4 w-4 text-muted-foreground" />}
          </div>
          <Waveform active={active} sending={isHolding} />
          {(active || isHolding) && (
            <p className="text-2xl font-mono font-semibold text-foreground tracking-wider">
              {isHolding ? 'Sending…' : liveTimer}
            </p>
          )}
          {!active && !isHolding && (
            <p className="text-sm text-muted-foreground">
              {canListen ? 'Tap the button below to start listening' : 'You do not have permission to listen'}
            </p>
          )}
        </div>

        {/* ── options card ── */}
        {canListen && (
          <div className="rounded-2xl bg-card border border-border px-4 py-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Session Options</p>

            <ToggleRow
              icon={<Moon className="h-4 w-4" />}
              label="Listen in Dark"
              description="Only start if device screen is off"
              checked={listenInDark}
              onChange={setListenInDark}
              disabled={active}
            />

            <div className="h-px bg-border" />

            <ToggleRow
              icon={<Radio className="h-4 w-4" />}
              label="Send Voice Command"
              description="Hold button to speak live to device"
              checked={sendVoice}
              onChange={setSendVoice}
            />
          </div>
        )}

        {/* ── session feedback ── */}
        {currentSession && (
          <div className={`rounded-xl border px-4 py-3 ${currentSession.status === 'ERROR' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`h-4 w-4 ${currentSession.status === 'ERROR' ? 'text-red-600' : 'text-green-600'}`} />
              <p className={`text-sm font-medium ${currentSession.status === 'ERROR' ? 'text-red-700' : 'text-green-700'}`}>
                {currentSession.status === 'STOPPED'
                  ? `Session ended · ${fmtDuration(currentSession.durationSeconds)}`
                  : currentSession.status === 'ACTIVE' ? 'Session is live' : 'Session error'}
              </p>
            </div>
          </div>
        )}

        {/* ── error banners ── */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {pttError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{pttError}</p>
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
          Audio streamed one-way · TLS encrypted
        </p>
      </div>

      {/* ── bottom actions ── */}
      {canListen && (
        <div className="shrink-0 bg-card border-t border-border px-4 pt-3 pb-5 space-y-3">

          {/* Push-to-talk button — only when Send Voice is enabled */}
          {sendVoice && (
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); startTalking(); }}
              onPointerUp={stopTalking}
              onPointerLeave={stopTalking}
              onPointerCancel={stopTalking}
              disabled={!device}
              className={`w-full h-12 rounded-2xl flex items-center justify-center gap-2
                          font-semibold text-sm transition-all select-none touch-none disabled:opacity-50
                          ${isHolding
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 scale-[0.98]'
                            : 'bg-blue-100 text-blue-700 border-2 border-blue-300 hover:bg-blue-200'
                          }`}
            >
              <Radio className="h-4 w-4" />
              {isHolding ? 'Speaking…' : 'Hold to Speak'}
            </button>
          )}

          {/* Start / Stop listening */}
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
