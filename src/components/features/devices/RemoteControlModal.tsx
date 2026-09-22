import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader2, MousePointerClick, Eye, ArrowLeft, Home, Square, Bell, Lock, Unlock, Send, Wifi, WifiOff } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { remoteControlService, type IceServer } from '@/api/services/remoteControl.service';
import { useRemoteScreen, type RemoteInput } from '@/hooks/useRemoteScreen';
import { useScreenStream } from '@/hooks/useScreenStream';
import { toast } from '@/hooks/useToast';

const TAP_MOVE = 0.02;       // normalised movement below this = a tap, not a swipe
const LONGPRESS_MS = 500;

/**
 * Remote Screen: view AND control a device live. WebRTC video when it connects, JPEG stream as the
 * automatic fallback. Pointer maps to touch, keyboard to text/keys; a toolbar covers the system
 * buttons. Silent/unattended — the device shows its own "remote control active" banner.
 */
export function RemoteControlModal({ device, onClose }: { device: Device; onClose: () => void }) {
  const deviceUuid = device.deviceUuid;
  const [starting, setStarting] = useState(true);
  const [ice, setIce] = useState<IceServer[] | undefined>(undefined);
  const [active, setActive] = useState(false);
  const [control, setControl] = useState(true);
  const [textToSend, setTextToSend] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const pointer = useRef<{ x: number; y: number; t: number } | null>(null);

  const { stream, webrtcConnected, sendInput } = useRemoteScreen(deviceUuid, active, ice);
  const { frame, fps, receiving } = useScreenStream(deviceUuid, active && !webrtcConnected);

  // Start / stop the session with the modal lifecycle.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await remoteControlService.start(deviceUuid, 'MEDIUM');
        if (cancelled) return;
        setIce(s.iceServers);
        setActive(true);
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Could not start remote control', description: e?.response?.data?.message || 'Please try again.' });
        onClose();
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      remoteControlService.stop(deviceUuid).catch(() => { /* best effort */ });
    };
  }, [deviceUuid, onClose]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const norm = useCallback((clientX: number, clientY: number) => {
    const el = surfaceRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
    };
  }, []);

  const onDown = (e: React.PointerEvent) => {
    if (!control) return;
    const p = norm(e.clientX, e.clientY);
    pointer.current = { ...p, t: Date.now() };
  };
  const onUp = (e: React.PointerEvent) => {
    if (!control || !pointer.current) return;
    const start = pointer.current;
    pointer.current = null;
    const end = norm(e.clientX, e.clientY);
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const dur = Date.now() - start.t;
    let input: RemoteInput;
    if (dist < TAP_MOVE) {
      input = dur >= LONGPRESS_MS ? { type: 'longpress', x: start.x, y: start.y } : { type: 'tap', x: start.x, y: start.y };
    } else {
      input = { type: 'swipe', x: start.x, y: start.y, x2: end.x, y2: end.y, durationMs: Math.min(600, Math.max(80, dur)) };
    }
    sendInput(input);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!control) return;
    const p = norm(e.clientX, e.clientY);
    const dy = e.deltaY > 0 ? 0.25 : -0.25;
    sendInput({ type: 'scroll', x: p.x, y: p.y, x2: p.x, y2: Math.min(1, Math.max(0, p.y + dy)), durationMs: 200 });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!control) return;
    if (e.key === 'Backspace') { e.preventDefault(); sendInput({ type: 'key', key: 'BACK' }); return; }
    if (e.key.length === 1) { e.preventDefault(); sendInput({ type: 'text', text: e.key }); }
  };

  const key = (k: string) => sendInput({ type: 'key', key: k });
  const sendText = () => { if (textToSend) { sendInput({ type: 'text', text: textToSend }); setTextToSend(''); } };

  const mode = webrtcConnected ? 'WebRTC' : receiving ? 'JPEG (fallback)' : 'connecting…';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 lg:p-4">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-blue-600" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Remote Screen — {device.deviceName || deviceUuid}</h2>
              <p className="text-[11px] text-muted-foreground">
                {webrtcConnected ? <Wifi className="mr-1 inline h-3 w-3 text-green-600" /> : <WifiOff className="mr-1 inline h-3 w-3 text-amber-500" />}
                {mode}{!webrtcConnected && receiving ? ` · ${fps.toFixed(0)} fps` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setControl((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium ${control ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-300 bg-white text-gray-600'}`}
            >
              {control ? <MousePointerClick className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {control ? 'Controlling' : 'View only'}
            </button>
            <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {control && (
          <div className="shrink-0 bg-blue-600 px-4 py-1 text-center text-[11px] font-medium text-white">
            You are controlling this device — it shows a "remote control active" banner.
          </div>
        )}

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-gray-900 p-3">
          <div
            ref={surfaceRef}
            tabIndex={0}
            onPointerDown={onDown}
            onPointerUp={onUp}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
            className={`relative flex max-h-full items-center justify-center outline-none ${control ? 'cursor-crosshair' : 'cursor-default'}`}
            style={{ touchAction: 'none' }}
          >
            {starting ? (
              <div className="flex items-center gap-2 py-16 text-sm text-gray-300"><Loader2 className="h-4 w-4 animate-spin" /> Starting…</div>
            ) : webrtcConnected ? (
              <video ref={videoRef} autoPlay playsInline muted className="max-h-[70vh] max-w-full rounded" />
            ) : frame ? (
              <img src={frame.src} alt="device screen" className="max-h-[70vh] max-w-full rounded" draggable={false} />
            ) : (
              <div className="flex items-center gap-2 py-16 text-sm text-gray-300"><Loader2 className="h-4 w-4 animate-spin" /> Waiting for the device…</div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
          <button type="button" onClick={() => key('BACK')} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
          <button type="button" onClick={() => key('HOME')} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"><Home className="h-3.5 w-3.5" /> Home</button>
          <button type="button" onClick={() => key('RECENTS')} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"><Square className="h-3.5 w-3.5" /> Recents</button>
          <button type="button" onClick={() => key('NOTIFICATIONS')} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"><Bell className="h-3.5 w-3.5" /> Notif</button>
          <button type="button" onClick={() => key('LOCK')} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"><Lock className="h-3.5 w-3.5" /> Lock</button>
          <button type="button" onClick={() => sendInput({ type: 'unlock' })} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"><Unlock className="h-3.5 w-3.5" /> Wake</button>
          <div className="ml-auto flex items-center gap-1.5">
            <input
              value={textToSend}
              onChange={(e) => setTextToSend(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendText(); }}
              placeholder="Type text to send…"
              className="h-8 w-44 rounded-md border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button type="button" onClick={sendText} disabled={!textToSend} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"><Send className="h-3.5 w-3.5" /> Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
