import { useEffect, useRef, useState, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { MQTT_BROKER_URL, WS } from '@/utils/constants';

function float32ToBase64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
  }
  const bytes = new Uint8Array(int16.buffer);
  // chunk to avoid call-stack overflow on large arrays
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Push-to-talk hook.
 * Connects a dedicated MQTT client and captures the browser mic while holding.
 * Publishes 16-kHz mono PCM chunks to device/{deviceUuid}/voiceCmd.
 */
export function useVoicePushToTalk(deviceUuid: string | null, enabled: boolean) {
  const mqttRef      = useRef<MqttClient | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const [isHolding, setIsHolding]   = useState(false);
  const [pttError,  setPttError]    = useState<string | null>(null);

  // Maintain a dedicated MQTT connection while the feature is enabled
  useEffect(() => {
    if (!enabled || !deviceUuid) return;

    const emailRaw = (() => {
      try { return JSON.parse(localStorage.getItem('user') ?? '{}')?.email ?? 'web'; }
      catch { return 'web'; }
    })();

    const client = mqtt.connect(MQTT_BROKER_URL, {
      clientId: `mdm-ptt-${emailRaw}-${Date.now()}`,
      clean: true,
      protocol: WS as 'wss' | 'ws',
      reconnectPeriod: 3000,
      connectTimeout: 10000,
    });
    mqttRef.current = client;

    return () => {
      client.end(true);
      mqttRef.current = null;
    };
  }, [enabled, deviceUuid]);

  const startTalking = useCallback(async () => {
    if (!deviceUuid || !enabled) return;
    setPttError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      const source    = ctx.createMediaStreamSource(stream);
      // 2048 samples @ 16kHz = 128 ms per chunk — responsive for PTT
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      const topic = `device/${deviceUuid}/voiceCmd`;

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        try {
          const b64     = float32ToBase64(float32);
          const payload = JSON.stringify({ audio: b64, ts: Date.now() });
          mqttRef.current?.publish(topic, payload, { qos: 0 });
        } catch { /* drop chunk on encode error */ }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setIsHolding(true);
    } catch (err) {
      setPttError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [deviceUuid, enabled]);

  const stopTalking = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsHolding(false);
  }, []);

  // Clean up if enabled is toggled off while holding
  useEffect(() => {
    if (!enabled) stopTalking();
  }, [enabled, stopTalking]);

  return { isHolding, startTalking, stopTalking, pttError };
}
