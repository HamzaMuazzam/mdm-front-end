import mqtt, { MqttClient } from 'mqtt';
import { MQTT_BROKER_URL } from '@/utils/constants';

export interface DeviceStatusEvent {
  clientId: string;
  deviceId: string;
  status: 'online' | 'offline';
  timestamp: string;
  deviceInfo?: Record<string, unknown>;
}

type DeviceStatusCallback = (event: DeviceStatusEvent) => void;

let client: MqttClient | null = null;
let subscribedTopic: string | null = null;
const listeners = new Set<DeviceStatusCallback>();

function getUserEmail(): number | null {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user?.email ?? null;
  } catch {
    return null;
  }
}

export function connectMqtt(): void {
  if (client?.connected) return;

  const email = getUserEmail();
  if (email === null) return;

  // Disconnect any previous connection
  // disconnectMqtt();

  client = mqtt.connect(MQTT_BROKER_URL, {
    clientId: `mdm-web-${email}`,
    clean: true,
    protocol: "ws",
    // protocol: "wss",
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  const topic = `device/${email}/status`;

  client.on('connect', () => {
    console.log('[MQTT] Connected to broker');
    client!.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT] Subscribe error:', err);
      } else {
        subscribedTopic = topic;
        console.log('[MQTT] Subscribed to:', topic);
      }
    });
  });

  client.on('message', (_topic: string, payload: Buffer) => {
    try {
      // let x= payload.toString()
      let x = payload.toString()
          .replace(/(\w+)=([^,}\s]+)/g, '"$1":"$2"') // Wrap keys and values in quotes
          .replace(/=/g, ':'); // Swap = for :
      const event: DeviceStatusEvent = JSON.parse(x);
      listeners.forEach((cb) => cb(event));
    } catch (err) {
      console.error('[MQTT] Failed to parse message:', err);
    }
  });

  client.on('error', (err) => {
    console.error('[MQTT] Connection error:', err);
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...');
  });

  client.on('close', () => {
    console.log('[MQTT] Connection closed');
  });
}

export function disconnectMqtt(): void {
  if (client) {
    if (subscribedTopic) {
      client.unsubscribe(subscribedTopic);
      subscribedTopic = null;
    }
    client.end(true);
    client = null;
  }
}

export function onDeviceStatus(callback: DeviceStatusCallback): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function isConnected(): boolean {
  return client?.connected ?? false;
}
