import { useEffect, useRef, useState } from 'react';
import mqtt, { type MqttClient, type IClientOptions } from 'mqtt';
import { MQTT_BROKER_URL, WS } from '@/utils/constants';

export interface ScreenFrame {
  /** data: URL ready to drop into an <img src>. */
  src: string;
  width: number;
  height: number;
  ts: number;
}

export interface ScreenStreamState {
  frame: ScreenFrame | null;
  fps: number;
  connected: boolean;
  /** True once at least one frame has arrived. */
  receiving: boolean;
}

/**
 * Subscribes (over MQTT-WS, a dedicated client scoped to this viewer) to
 * `device/{deviceUuid}/screenStream` and exposes the latest decoded frame + a rolling FPS.
 * Frames are `{ ts, w, h, format:"jpeg", data:<base64> }`.
 */
export function useScreenStream(deviceUuid: string | null, active: boolean): ScreenStreamState {
  const [frame, setFrame] = useState<ScreenFrame | null>(null);
  const [fps, setFps] = useState(0);
  const [connected, setConnected] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const frameTimes = useRef<number[]>([]);

  useEffect(() => {
    if (!active || !deviceUuid) return;

    const topic = `device/${deviceUuid}/screenStream`;
    let client: MqttClient | null = null;

    try {
      client = mqtt.connect(MQTT_BROKER_URL, {
        clientId: `mdm-web-screen-${deviceUuid}-${Date.now()}`,
        clean: true,
        protocol: WS as IClientOptions['protocol'],
        reconnectPeriod: 4000,
        connectTimeout: 10000,
      });
    } catch {
      return;
    }

    client.on('connect', () => {
      setConnected(true);
      client!.subscribe(topic, { qos: 0 });
    });
    client.on('close', () => setConnected(false));
    client.on('error', () => setConnected(false));

    client.on('message', (_topic, payload) => {
      try {
        const msg = JSON.parse(payload.toString());
        if (!msg?.data) return;
        const fmt = msg.format || 'jpeg';
        setFrame({
          src: `data:image/${fmt};base64,${msg.data}`,
          width: Number(msg.w) || 0,
          height: Number(msg.h) || 0,
          ts: Number(msg.ts) || Date.now(),
        });
        setReceiving(true);

        // Rolling FPS over the last ~2s window.
        const now = Date.now();
        const times = frameTimes.current;
        times.push(now);
        while (times.length && now - times[0] > 2000) times.shift();
        setFps(times.length / 2);
      } catch {
        /* ignore malformed frames */
      }
    });

    return () => {
      try {
        client?.unsubscribe(topic);
        client?.end(true);
      } catch {
        /* noop */
      }
      frameTimes.current = [];
      setFrame(null);
      setReceiving(false);
      setFps(0);
      setConnected(false);
    };
  }, [deviceUuid, active]);

  return { frame, fps, connected, receiving };
}
