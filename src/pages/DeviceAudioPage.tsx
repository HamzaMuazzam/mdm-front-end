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
  RefreshCw,
  Shield,
} from 'lucide-react';
import { useDevicesQuery } from '@/hooks/useDevices';
import { useAudioStream } from '@/hooks/useAudioStream';
import { useVoicePushToTalk } from '@/hooks/useVoicePushToTalk';
import { audioService, type AudioSessionRecord } from '@/api/services/audio.service';
import { ROUTES } from '@/utils/constants';
import { usePermissionStore } from '@/store/permissionStore';

/* ─── CSS keyframe injector ──────────────────────────────────────────────── */
const AUDIO_STYLES = `
  @keyframes bar-bounce {
    0%, 100% { transform: scaleY(0.15); }
    50%       { transform: scaleY(1); }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: 0.6; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes pulse-ring-2 {
    0%   { transform: scale(1);   opacity: 0.4; }
    100% { transform: scale(1.7); opacity: 0; }
  }
  @keyframes glow-breathe {
    0%, 100% { box-shadow: none; }
    50%       { box-shadow: none; }
  }
  @keyframes fade-slide-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .audio-bar {
    width: 3px;
    border-radius: 9999px;
    transform-origin: bottom;
    transform: scaleY(0.15);
    transition: background-color 0.4s ease;
  }
  .audio-bar.active {
    animation: bar-bounce var(--dur, 0.8s) ease-in-out infinite;
    animation-delay: var(--delay, 0s);
  }
  .pulse-ring {
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    animation: pulse-ring 1.8s ease-out infinite;
  }
  .pulse-ring-2 {
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    animation: pulse-ring-2 1.8s ease-out infinite;
    animation-delay: 0.6s;
  }
  .glow-btn {
    animation: glow-breathe 2.5s ease-in-out infinite;
  }
  .fade-in {
    animation: fade-slide-up 0.3s ease both;
  }
`;

function StyleInjector() {
  return <style>{AUDIO_STYLES}</style>;
}

/* ─── types ──────────────────────────────────────────────────────────────── */
type SessionStatus = AudioSessionRecord['status'];

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

/* ─── animated waveform ──────────────────────────────────────────────────── */
const BARS = 28;
const BAR_SPEEDS = Array.from({ length: BARS }, () => 0.5 + Math.random() * 0.9);
const BAR_DELAYS = Array.from({ length: BARS }, () => -(Math.random() * 1.0));

function Waveform({ active, sending }: { active: boolean; sending: boolean }) {
  const isOn = active || sending;
  const color = sending
    ? 'var(--blue-bar, #2563eb)'
    : active
    ? 'var(--green-bar, #2563eb)'
    : 'var(--idle-bar, #e5e7eb)';

  return (
    <div
      className="flex items-center justify-center gap-[3px]"
      style={{ height: '72px' }}
    >
      {Array.from({ length: BARS }, (_, i) => (
        <div
          key={i}
          className={`audio-bar ${isOn ? 'active' : ''}`}
          style={{
            height: '72px',
            backgroundColor: color,
            '--dur': `${BAR_SPEEDS[i]}s`,
            '--delay': `${BAR_DELAYS[i]}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ─── pulsing icon ───────────────────────────────────────────────────────── */
function PulsingIcon({ active, sending }: { active: boolean; sending: boolean }) {
  const ringColor = sending ? '#2563eb33' : '#2563eb33';
  const bgColor   = sending ? 'bg-blue-50' : 'bg-blue-50';
  const iconColor = sending ? 'text-blue-600' : 'text-blue-600';
  const idleColor = 'text-gray-400';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
      {(active || sending) && (
        <>
          <div className="pulse-ring" style={{ backgroundColor: ringColor }} />
          <div className="pulse-ring-2" style={{ backgroundColor: ringColor }} />
        </>
      )}
      <div
        className={`relative z-10 flex items-center justify-center rounded-full transition-all duration-500
          ${(active || sending) ? `${bgColor} border border-blue-200` : 'bg-gray-100 border border-gray-200'}`}
        style={{ width: 64, height: 64 }}
      >
        {sending
          ? <Radio className={`h-7 w-7 ${iconColor}`} />
          : active
          ? <Mic className={`h-7 w-7 ${iconColor}`} />
          : <MicOff className={`h-7 w-7 ${idleColor}`} />}
      </div>
    </div>
  );
}

/* ─── glass toggle row ───────────────────────────────────────────────────── */
function ToggleRow({
  icon, label, description, checked, onChange, disabled, accentColor = '#2563eb',
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  accentColor?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 transition-opacity ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
    >
      <div className="h-9 w-9 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 text-gray-600">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-tight">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative shrink-0 w-12 h-6 rounded-full transition-all duration-300 focus:outline-none"
        style={{ backgroundColor: checked ? accentColor : '#d1d5db', border: '1px solid rgba(0,0,0,0.05)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300"
          style={{ transform: checked ? 'translateX(24px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}

/* ─── status badge ───────────────────────────────────────────────────────── */
const STATUS_META: Record<SessionStatus, { label: string; dot: string; text: string }> = {
  ACTIVE:  { label: 'Active',  dot: 'bg-green-500', text: 'text-green-700' },
  STOPPED: { label: 'Stopped', dot: 'bg-gray-400',  text: 'text-gray-600' },
  ERROR:   { label: 'Error',   dot: 'bg-red-500',   text: 'text-red-700' },
};

function StatusBadge({ status }: { status: SessionStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

/* ─── history card ───────────────────────────────────────────────────────── */
function HistoryCard({ session }: { session: AudioSessionRecord }) {
  const [open, setOpen] = useState(false);
  const accentColor =
    session.status === 'ACTIVE' ? 'bg-green-500' :
    session.status === 'ERROR'  ? 'bg-red-500' : 'bg-gray-400';

  return (
    <div className="rounded-lg bg-white border border-gray-200 shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className={`h-2 w-2 rounded-full shrink-0 ${accentColor}`} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900">{fmtDuration(session.durationSeconds)} session</p>
          <p className="text-xs text-gray-500 mt-0.5">{fmt(session.startedAt)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={session.status} />
          <div className="text-gray-400">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 fade-in">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 text-xs">
            {[
              ['Started',  fmt(session.startedAt)],
              ['Stopped',  fmt(session.stoppedAt)],
              ['Duration', fmtDuration(session.durationSeconds)],
              ['Started by', session.startedByEmail ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-gray-700 font-medium truncate">{value}</p>
              </div>
            ))}
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
  const navigate      = useNavigate();
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

  const { screenOnStop } = useAudioStream(device?.deviceUuid ?? null, active);

  useEffect(() => {
    if (screenOnStop && active) {
      setActive(false);
      setCurrentSession(null);
      setError('Session ended — device screen turned on.');
    }
  }, [screenOnStop, active]);

  const { isHolding, startTalking, stopTalking, pttError } = useVoicePushToTalk(
    device?.deviceUuid ?? null,
    sendVoice && canListen,
  );

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

  /* ─── loading ──────────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  /* ─── derived visuals ──────────────────────────────────────────────────── */
  const heroGradient = isHolding
    ? 'bg-blue-50'
    : active
    ? 'bg-blue-50'
    : 'bg-white';

  const mainBtnGlow = active
    ? { '--glow-color': 'transparent' } as React.CSSProperties
    : { '--glow-color': 'transparent' } as React.CSSProperties;

  /* ─── render ───────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      <StyleInjector />

      {/* ── header ── */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-4 z-10">
        <div className="flex items-center gap-3 h-14">
          <button
            type="button"
            onClick={goBack}
            className="p-2 -ml-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate leading-tight text-sm">
              {device?.deviceName ?? 'Unknown Device'}
            </p>
            <p className="text-[10px] text-gray-500 truncate font-mono">{device?.deviceUuid}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {active && (
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            )}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-all
              ${active
                ? 'text-red-700 border-red-200 bg-red-50'
                : 'text-gray-600 border-gray-200 bg-gray-100'}`}>
              {active ? 'Live' : 'Idle'}
            </span>
          </div>
        </div>
      </div>

      {/* ── scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── hero card ── */}
        <div className={`${heroGradient} border-b border-gray-200 transition-all duration-700 px-5 pt-8 pb-10`}>
          <div className="flex flex-col items-center gap-5">

            <PulsingIcon active={active} sending={isHolding} />

            <Waveform active={active} sending={isHolding} />

            <div className="flex flex-col items-center gap-1.5 min-h-[3rem] justify-center">
              {active && !isHolding && (
                <p className="text-3xl font-mono font-semibold text-gray-900 tracking-wider fade-in tabular-nums">
                  {liveTimer}
                </p>
              )}
              {isHolding && (
                <div className="flex items-center gap-2 fade-in">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <p className="text-sm font-semibold text-blue-700 tracking-wide uppercase">Transmitting…</p>
                </div>
              )}
              {!active && !isHolding && (
                <p className="text-sm text-gray-500 text-center">
                  {canListen ? 'Tap Start Listening to begin' : 'No permission to listen'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-5 space-y-4">

          {/* ── alerts ── */}
          {(error || pttError) && (
            <div className="space-y-2 fade-in">
              {error && (
                <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {pttError && (
                <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{pttError}</p>
                </div>
              )}
            </div>
          )}

          {/* ── session feedback ── */}
          {currentSession && currentSession.status !== 'ACTIVE' && (
            <div className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 fade-in
              ${currentSession.status === 'ERROR'
                ? 'bg-red-50 border-red-200'
                : 'bg-green-50 border-green-200'}`}>
              <CheckCircle2 className={`h-4 w-4 shrink-0 ${currentSession.status === 'ERROR' ? 'text-red-600' : 'text-green-600'}`} />
              <p className={`text-sm font-medium ${currentSession.status === 'ERROR' ? 'text-red-700' : 'text-green-700'}`}>
                {currentSession.status === 'STOPPED'
                  ? `Session ended · ${fmtDuration(currentSession.durationSeconds)}`
                  : 'Session error'}
              </p>
            </div>
          )}

          {/* ── options card ── */}
          {canListen && (
            <div className="rounded-lg bg-white border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Session Options</p>
              </div>
              <div className="px-4 pb-4 space-y-4">
                <ToggleRow
                  icon={<Moon className="h-4 w-4" />}
                  label="Listen in Dark"
                  description="Only start if device screen is off"
                  checked={listenInDark}
                  onChange={setListenInDark}
                  disabled={active}
                  accentColor="#2563eb"
                />
                <div className="h-px bg-gray-200" />
                <ToggleRow
                  icon={<Radio className="h-4 w-4" />}
                  label="Send Voice Command"
                  description="Hold button to speak live to device"
                  checked={sendVoice}
                  onChange={setSendVoice}
                  accentColor="#2563eb"
                />
              </div>
            </div>
          )}

          {/* ── push-to-talk inline ── */}
          {canListen && sendVoice && (
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); startTalking(); }}
              onPointerUp={stopTalking}
              onPointerLeave={stopTalking}
              onPointerCancel={stopTalking}
              disabled={!device}
              className={`w-full h-14 rounded-md flex items-center justify-center gap-2.5 font-semibold text-sm
                          transition-all select-none touch-none disabled:opacity-40
                          ${isHolding
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-white border border-gray-300 text-blue-600 hover:bg-gray-50 shadow-sm'}`}
              style={isHolding ? { boxShadow: 'none' } : {}}
            >
              <Radio className="h-4 w-4" />
              {isHolding ? 'Transmitting…' : 'Hold to Speak'}
            </button>
          )}

          {/* ── session history ── */}
          {canRead && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-base font-semibold text-gray-900">Session History</p>
                <button
                  type="button"
                  onClick={loadHistory}
                  disabled={loadingHistory}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                  {loadingHistory ? 'Loading…' : 'Refresh'}
                </button>
              </div>

              {history.length === 0 && !loadingHistory ? (
                <div className="rounded-lg bg-white border border-gray-200 py-10 flex flex-col items-center gap-2">
                  <Clock className="h-6 w-6 text-gray-400" />
                  <p className="text-sm text-gray-500">No sessions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((s) => <HistoryCard key={s.id} session={s} />)}
                </div>
              )}
            </div>
          )}

          {/* ── footer note ── */}
          <div className="flex items-center justify-center gap-1.5 py-3">
            <Shield className="h-3 w-3 text-gray-400" />
            <p className="text-xs text-gray-500">One-way audio · TLS encrypted</p>
          </div>
        </div>
      </div>

      {/* ── sticky bottom action ── */}
      {canListen && (
        <div className="shrink-0 bg-white border-t border-gray-200 px-5 pt-4 pb-6">
          <button
            type="button"
            onClick={active ? handleStop : handleStart}
            disabled={loading || !device}
            className={`w-full h-14 rounded-md flex items-center justify-center gap-3 font-semibold text-base
                        shadow-sm transition-colors disabled:opacity-40
                        ${active
                          ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white'
                          : 'bg-primary hover:bg-primary-hover text-white'}`}
            style={loading ? {} : (active || !loading) ? { ...(active
              ? { boxShadow: 'none' }
              : { boxShadow: 'none' }), ...mainBtnGlow } : {}}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : active ? (
              <><MicOff className="h-5 w-5" />Stop Listening</>
            ) : (
              <><Mic className="h-5 w-5" />Start Listening</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
