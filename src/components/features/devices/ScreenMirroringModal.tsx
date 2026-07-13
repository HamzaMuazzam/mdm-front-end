import { useEffect, useRef, useState } from 'react';
import { MonitorPlay, X, Play, Square, Loader2, Wifi, WifiOff } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { screenMirroringService, type ScreenQuality } from '@/api/services/screenMirroring.service';
import { useScreenStream } from '@/hooks/useScreenStream';
import { toast } from '@/hooks/useToast';

const QUALITIES: ScreenQuality[] = ['LOW', 'MEDIUM', 'HIGH'];

/** Live screen mirroring viewer: drives the control plane over REST and renders the MQTT frame stream. */
export function ScreenMirroringModal({ device, onClose }: { device: Device; onClose: () => void }) {
  const [streaming, setStreaming] = useState(false);
  const [quality, setQuality] = useState<ScreenQuality>('MEDIUM');
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(false);

  const { frame, fps, connected, receiving } = useScreenStream(device.deviceUuid, streaming);

  const handleStart = async () => {
    setBusy(true);
    try {
      await screenMirroringService.start(device.deviceUuid, quality);
      setStreaming(true);
      startedRef.current = true;
    } catch {
      toast({ variant: 'destructive', title: 'Failed to start', description: 'Could not start screen mirroring.' });
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      await screenMirroringService.stop(device.deviceUuid);
    } catch {
      /* device may have already stopped — ignore */
    } finally {
      setStreaming(false);
      startedRef.current = false;
      setBusy(false);
    }
  };

  const handleQuality = async (q: ScreenQuality) => {
    setQuality(q);
    if (!streaming) return;
    try {
      await screenMirroringService.setQuality(device.deviceUuid, q);
    } catch {
      toast({ variant: 'destructive', title: 'Quality change failed', description: 'Could not update quality.' });
    }
  };

  // Best-effort stop if the operator closes the modal mid-session.
  useEffect(() => {
    return () => {
      if (startedRef.current) {
        screenMirroringService.stop(device.deviceUuid).catch(() => {});
      }
    };
  }, [device.deviceUuid]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-blue-50 p-2">
              <MonitorPlay className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Screen Mirroring</h2>
              <p className="text-xs text-muted-foreground">{device.deviceName || device.deviceUuid}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Screen surface */}
        <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-900 p-2 sm:p-4">
          {streaming && frame ? (
            <img
              src={frame.src}
              alt="Device screen"
              className="h-full max-h-full w-auto max-w-full rounded-md object-contain shadow-lg sm:h-auto sm:max-h-[78vh]"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              {streaming ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Waiting for the device to stream…</p>
                  <p className="text-xs text-slate-500">The device must have the accessibility service enabled.</p>
                </>
              ) : (
                <>
                  <MonitorPlay className="h-10 w-10" />
                  <p className="text-sm">Press Start to begin mirroring this device's screen.</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {!streaming ? (
              <button
                type="button"
                onClick={handleStart}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStop}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                Stop
              </button>
            )}

            {/* Quality selector */}
            <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
              {QUALITIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleQuality(q)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    quality === q ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Live stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              {connected ? <Wifi className="h-3.5 w-3.5 text-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 text-gray-400" />}
              {connected ? 'Stream connected' : 'Stream idle'}
            </span>
            {streaming && (
              <>
                <span className="tabular-nums">{fps.toFixed(1)} fps</span>
                {frame && <span className="tabular-nums">{frame.width}×{frame.height}</span>}
                <span className={receiving ? 'text-emerald-600' : 'text-amber-600'}>
                  {receiving ? 'Receiving' : 'No frames yet'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
