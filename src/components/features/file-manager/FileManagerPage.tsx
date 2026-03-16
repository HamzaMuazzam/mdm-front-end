import { useState } from 'react';
import { HardDrive, ChevronDown } from 'lucide-react';
import { FileManagerExplorer } from './FileManagerExplorer';
import { useDevicesQuery } from '@/hooks/useDevices';
import type { Device } from '@/types/device.types';

export function FileManagerPage() {
  const { data: devices = [], isLoading } = useDevicesQuery();

  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading devices…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Device selector */}
      {!selectedDevice ? (
        <div>
          <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-blue-400" />
            File Manager
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Select a device to browse its storage remotely.
          </p>

          {devices.length === 0 ? (
            <p className="text-gray-500">No devices found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {devices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => setSelectedDevice(device)}
                  className="text-left p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-500/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <HardDrive className="h-8 w-8 text-blue-400 shrink-0 group-hover:text-blue-300" />
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">
                        {device.deviceName || device.model || 'Unknown Device'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{device.deviceUuid}</p>
                      {device.userEmail && (
                        <p className="text-xs text-gray-500 truncate">{device.userEmail}</p>
                      )}
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-500 ml-auto rotate-[-90deg] group-hover:text-blue-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 h-full">
          {/* Back button + device info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedDevice(null)}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
            >
              ← Back
            </button>
            <span className="text-white/30">|</span>
            <span className="text-sm text-gray-300">
              {selectedDevice.deviceName || selectedDevice.model} &nbsp;
              <span className="text-gray-500 font-mono text-xs">({selectedDevice.deviceUuid})</span>
            </span>
          </div>

          <FileManagerExplorer
            deviceUuid={selectedDevice.deviceUuid}
            deviceName={selectedDevice.deviceName || selectedDevice.model}
          />
        </div>
      )}
    </div>
  );
}
