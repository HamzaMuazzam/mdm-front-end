import { useEffect, useRef, useCallback, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { MQTT_BROKER_URL, WS } from '@/utils/constants';

/**
 * Subscribes to:
 *   device/{deviceUuid}/audioStream  — plays incoming PCM chunks via Web Audio API
 *   device/{deviceUuid}/audioAck     — listens for device-side stop events
 *
 * Returns `screenOnStop: true` when the device stopped the session because
 * the screen turned on (listenInDark mode). The caller should reset `active`
 * state and show a notification when this becomes true.
 */
export function useAudioStream(deviceUuid: string | null, enabled: boolean) {
  const clientRef   = useRef<MqttClient | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextTimeRef = useRef<number>(0);
  const JITTER_SECONDS = 0.05;

  const [screenOnStop, setScreenOnStop] = useState(false);

  const stop = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    nextTimeRef.current = 0;
  }, []);

  // Reset screenOnStop whenever a new session starts
  useEffect(() => {
    if (enabled) setScreenOnStop(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !deviceUuid) {
      stop();
      return;
    }

    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;
    nextTimeRef.current = audioCtx.currentTime + JITTER_SECONDS;

    const streamTopic = `device/${deviceUuid}/audioStream`;
    const ackTopic    = `device/${deviceUuid}/audioAck`;

    const emailRaw = (() => {
      try { return JSON.parse(localStorage.getItem('user') ?? '{}')?.email ?? 'web'; }
      catch { return 'web'; }
    })();

    const client = mqtt.connect(MQTT_BROKER_URL, {
      clientId: `mdm-audio-${emailRaw}-${Date.now()}`,
      clean: true,
      protocol: WS,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
    });
    clientRef.current = client;

    client.on('connect', () => {
      client.subscribe(streamTopic, { qos: 0 });
      client.subscribe(ackTopic,    { qos: 1 });
    });

    client.on('message', (t: string, payload: Buffer) => {
      // ── ack channel: screen turned on → signal the page ──────────────────
      if (t === ackTopic) {
        try {
          const data = JSON.parse(payload.toString()) as { status?: string };
          if (data.status === 'screen_on') {
            setScreenOnStop(true);
          }
        } catch { /* ignore */ }
        return;
      }

      // ── audio stream: decode base64 PCM and play ─────────────────────────
      try {
        const { audio } = JSON.parse(payload.toString()) as { audio: string };
        if (!audio) return;

        const binary  = atob(audio);
        const bytes   = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const int16   = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

        const ctx = audioCtxRef.current;
        if (!ctx) return;

        const buffer = ctx.createBuffer(1, float32.length, 16000);
        buffer.copyToChannel(float32, 0);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        const startAt = Math.max(ctx.currentTime, nextTimeRef.current);
        source.start(startAt);
        nextTimeRef.current = startAt + buffer.duration;
      } catch {
        // silently ignore malformed chunks
      }
    });

    return stop;
  }, [enabled, deviceUuid, stop]);

  return { stop, screenOnStop };
}
