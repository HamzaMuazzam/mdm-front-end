import { useCallback, useEffect, useRef, useState } from 'react';
import mqtt, { type MqttClient, type IClientOptions } from 'mqtt';
import { MQTT_BROKER_URL, WS } from '@/utils/constants';
import type { IceServer } from '@/api/services/remoteControl.service';

export type InputType = 'tap' | 'longpress' | 'swipe' | 'scroll' | 'drag' | 'key' | 'text' | 'unlock';

export interface RemoteInput {
  type: InputType;
  x?: number; y?: number; x2?: number; y2?: number;
  durationMs?: number;
  key?: string;
  text?: string;
}

export interface RemoteScreenState {
  /** Live WebRTC video stream, when connected. */
  stream: MediaStream | null;
  webrtcConnected: boolean;
  connected: boolean;
  sendInput: (input: RemoteInput) => void;
}

/**
 * One MQTT-WS channel for a remote-control session:
 *  - answers the device's WebRTC offer (`webrtc/{id}/browser` in, `device/{id}/webrtcSignal` out)
 *    and exposes the remote video MediaStream;
 *  - sends operator input to `device/{id}/inputCmd` with an incrementing seq.
 * The device is the offerer (it owns the screen); the browser only receives video.
 */
export function useRemoteScreen(
  deviceUuid: string | null,
  active: boolean,
  iceServers: IceServer[] | undefined,
): RemoteScreenState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [webrtcConnected, setWebrtcConnected] = useState(false);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<MqttClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!active || !deviceUuid) return;
    const inTopic = `webrtc/${deviceUuid}/browser`;      // device -> browser (offer, ICE)
    const outTopic = `device/${deviceUuid}/webrtcSignal`; // browser -> device (answer, ICE)

    let client: MqttClient;
    try {
      client = mqtt.connect(MQTT_BROKER_URL, {
        clientId: `mdm-web-rc-${deviceUuid}-${Date.now()}`,
        clean: true,
        protocol: WS as IClientOptions['protocol'],
        reconnectPeriod: 4000,
        connectTimeout: 10000,
      });
    } catch {
      return;
    }
    clientRef.current = client;

    const publish = (msg: unknown) => {
      try { client.publish(outTopic, JSON.stringify(msg), { qos: 1 }); } catch { /* noop */ }
    };

    const buildPeer = () => {
      const pc = new RTCPeerConnection({
        iceServers: (iceServers || []).map((s) => ({
          urls: s.urls,
          username: s.username || undefined,
          credential: s.credential || undefined,
        })),
      });
      pc.ontrack = (e) => setStream(e.streams[0] ?? new MediaStream([e.track]));
      pc.onicecandidate = (e) => {
        if (e.candidate) publish({ type: 'candidate', candidate: {
          candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex } });
      };
      pc.onconnectionstatechange = () => {
        setWebrtcConnected(pc.connectionState === 'connected');
      };
      pcRef.current = pc;
      return pc;
    };

    client.on('connect', () => {
      setConnected(true);
      client.subscribe(inTopic, { qos: 1 });
    });
    client.on('close', () => setConnected(false));
    client.on('error', () => setConnected(false));

    client.on('message', async (_t, payload) => {
      let msg: any;
      try { msg = JSON.parse(payload.toString()); } catch { return; }
      try {
        if (msg.type === 'offer') {
          const pc = pcRef.current ?? buildPeer();
          await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          publish({ type: 'answer', sdp: answer.sdp });
        } else if (msg.type === 'candidate' && msg.candidate && pcRef.current) {
          await pcRef.current.addIceCandidate(msg.candidate);
        }
      } catch { /* ignore signalling errors */ }
    });

    return () => {
      try { pcRef.current?.close(); } catch { /* noop */ }
      try { client.unsubscribe(inTopic); client.end(true); } catch { /* noop */ }
      pcRef.current = null;
      clientRef.current = null;
      setStream(null);
      setWebrtcConnected(false);
      setConnected(false);
      seqRef.current = 0;
    };
  }, [deviceUuid, active, iceServers]);

  const sendInput = useCallback((input: RemoteInput) => {
    const client = clientRef.current;
    if (!client || !deviceUuid) return;
    seqRef.current += 1;
    const msg = { ...input, seq: seqRef.current };
    try { client.publish(`device/${deviceUuid}/inputCmd`, JSON.stringify(msg), { qos: 0 }); } catch { /* noop */ }
  }, [deviceUuid]);

  return { stream, webrtcConnected, connected, sendInput };
}
