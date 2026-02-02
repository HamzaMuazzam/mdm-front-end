import { useEffect, useRef, useCallback } from 'react';
import { create } from 'zustand';
import { connectMqtt, disconnectMqtt, onDeviceStatus, DeviceStatusEvent } from '@/services/mqttClient';

interface DeviceStatusState {
  /** Map of deviceId -> 'online' | 'offline' */
  statuses: Record<number, 'online' | 'offline'>;
  setStatus: (deviceId: number, status: 'online' | 'offline') => void;
}

export const useDeviceStatusStore = create<DeviceStatusState>((set) => ({
  statuses: {},
  setStatus: (deviceId, status) =>
    set((state) => ({
      statuses: { ...state.statuses, [deviceId]: status },
    })),
}));

/**
 * Hook to connect to MQTT and listen for device status events.
 * Call this once in the device list page.
 */
export function useDeviceStatusMqtt() {
  const setStatus = useDeviceStatusStore((s) => s.setStatus);
  const connectedRef = useRef(false);

  const handleEvent = useCallback(
    (event: DeviceStatusEvent) => {
      setStatus(event.deviceId, event.status);
    },
    [setStatus]
  );

  useEffect(() => {
    if (connectedRef.current) return;
    connectedRef.current = true;

    connectMqtt();
    const unsubscribe = onDeviceStatus(handleEvent);

    return () => {
      unsubscribe();
      disconnectMqtt();
      connectedRef.current = false;
    };
  }, [handleEvent]);
}

/**
 * Read the live status for a single device.
 */
export function useDeviceLiveStatus(deviceId: number): 'online' | 'offline' | undefined {
  return useDeviceStatusStore((s) => s.statuses[deviceId]);
}
