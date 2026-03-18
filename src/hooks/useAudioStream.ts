import { useEffect, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { MQTT_BROKER_URL, WS } from '@/utils/constants';

/**
 * Subscribes to device/{deviceUuid}/audioStream, decodes base64 PCM chunks,
 * and plays them via the Web Audio API with a small jitter buffer.
 *
 * Returns a cleanup function — call it to disconnect and close the AudioContext.
 */
export function useAudioStream(deviceUuid: string | null, enabled: boolean) {
  const clientRef   = useRef<MqttClient | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Schedule the next buffer to play starting at this AudioContext time
  const nextTimeRef = useRef<number>(0);
  const JITTER_SECONDS = 0.05; // 50 ms initial buffer

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

  useEffect(() => {
    if (!enabled || !deviceUuid) {
      stop();
      return;
    }

    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;
    nextTimeRef.current = audioCtx.currentTime + JITTER_SECONDS;

    const topic = `device/${deviceUuid}/audioStream`;
    const emailRaw = (() => {
      try { return JSON.parse(localStorage.getItem('user') ?? '{}')?.email ?? 'web'; }
      catch { return 'web'; }
    })();

    const client = mqtt.connect(MQTT_BROKER_URL, {
      clientId: `mdm-audio-${emailRaw}-${Date.now()}`,
      clean: true,
      protocol: WS as 'wss' | 'ws',
      reconnectPeriod: 3000,
      connectTimeout: 10000,
    });
    clientRef.current = client;

    client.on('connect', () => {
      client.subscribe(topic, { qos: 0 });
    });

    client.on('message', (_t: string, payload: Buffer) => {
      try {
        const { audio } = JSON.parse(payload.toString()) as { audio: string };
        if (!audio) return;

        // Decode base64 → Int16Array → Float32Array
        const binary = atob(audio);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const int16  = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

        const ctx = audioCtxRef.current;
        if (!ctx) return;

        const buffer = ctx.createBuffer(1, float32.length, 16000);
        buffer.copyToChannel(float32, 0);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        // Schedule right after previous chunk, clamping to "now" if we fall behind
        const startAt = Math.max(ctx.currentTime, nextTimeRef.current);
        source.start(startAt);
        nextTimeRef.current = startAt + buffer.duration;
      } catch {
        // silently ignore malformed chunks
      }
    });

    return stop;
  }, [enabled, deviceUuid, stop]);

  return { stop };
}
