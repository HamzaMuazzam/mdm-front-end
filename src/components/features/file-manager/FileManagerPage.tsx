import { useState, useRef, useEffect } from 'react';
import { HardDrive, ChevronDown, Search, X } from 'lucide-react';
import { FileManagerExplorer } from './FileManagerExplorer';
import { useDevicesQuery } from '@/hooks/useDevices';
import type { Device } from '@/types/device.types';

export function FileManagerPage() {
  const { data: devices = [], isLoading } = useDevicesQuery();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = devices.filter((d) => {
    const q = search.toLowerCase();
    return (
      (d.deviceName ?? '').toLowerCase().includes(q) ||
      (d.model ?? '').toLowerCase().includes(q) ||
      d.deviceUuid.toLowerCase().includes(q) ||
      (d.userEmail ?? '').toLowerCase().includes(q)
    );
  });

  const handleSelect = (device: Device) => {
    setSelectedDevice(device);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDevice(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-500">
        Loading devices…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-blue-600 shrink-0" />
          <h2 className="text-xl font-semibold text-gray-900">File Manager</h2>
        </div>

        {/* Device dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-2 h-9 px-3 rounded-md border text-sm transition-all min-w-[240px] ${
              isOpen
                ? 'border-blue-500 bg-white ring-2 ring-blue-100'
                : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            {selectedDevice ? (
              <>
                <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <HardDrive className="h-3 w-3 text-blue-600" />
                </div>
                <span className="text-gray-900 font-medium flex-1 text-left truncate max-w-[160px]">
                  {selectedDevice.deviceName || selectedDevice.model || 'Unknown Device'}
                </span>
              </>
            ) : (
              <span className="text-gray-500 flex-1 text-left">Select a device…</span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-1.5 z-50 w-80 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
              {/* Search input */}
              <div className="p-2 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search by name, UUID, email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-9 pl-8 pr-3 text-sm bg-white border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Device list */}
              <div className="max-h-64 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-gray-500">
                    <HardDrive className="h-7 w-7 mb-2 opacity-30" />
                    <p className="text-sm">No devices found</p>
                  </div>
                ) : (
                  filtered.map((device) => {
                    const isActive = selectedDevice?.id === device.id;
                    return (
                      <button
                        key={device.id}
                        onClick={() => handleSelect(device)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                          isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-blue-100' : 'bg-gray-100'
                          }`}
                        >
                          <HardDrive
                            className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-gray-500'}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                            {device.deviceName || device.model || 'Unknown Device'}
                          </p>
                          <p className="text-xs text-gray-500 font-mono truncate">{device.deviceUuid}</p>
                          {device.userEmail && (
                            <p className="text-xs text-gray-400 truncate">{device.userEmail}</p>
                          )}
                        </div>
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Clear selected device */}
        {selectedDevice && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            title="Change device"
          >
            <X className="h-3.5 w-3.5" />
            Change
          </button>
        )}
      </div>

      {/* Explorer or empty state */}
      {selectedDevice ? (
        <FileManagerExplorer
          key={selectedDevice.deviceUuid}
          deviceUuid={selectedDevice.deviceUuid}
          deviceName={selectedDevice.deviceName || selectedDevice.model}
        />
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 border border-dashed border-gray-300 rounded-lg text-gray-400">
          <HardDrive className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm">Select a device from the dropdown above to browse its files</p>
        </div>
      )}
    </div>
  );
}
