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
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading devices…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-blue-500 dark:text-blue-400 shrink-0" />
          <h2 className="text-xl font-bold text-foreground">File Manager</h2>
        </div>

        {/* Device dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm transition-all min-w-[240px] ${
              isOpen
                ? 'border-blue-500/60 bg-black/10 dark:bg-white/10'
                : 'border-border bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 hover:border-border'
            }`}
          >
            {selectedDevice ? (
              <>
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <HardDrive className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                </div>
                <span className="text-foreground font-medium flex-1 text-left truncate max-w-[160px]">
                  {selectedDevice.deviceName || selectedDevice.model || 'Unknown Device'}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground flex-1 text-left">Select a device…</span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-1.5 z-50 w-80 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
              {/* Search input */}
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70 pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search by name, UUID, email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              {/* Device list */}
              <div className="max-h-64 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-muted-foreground/70">
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
                          isActive ? 'bg-blue-500/10 dark:bg-blue-500/15' : 'hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-blue-500/15 dark:bg-blue-500/25' : 'bg-black/10 dark:bg-white/10'
                          }`}
                        >
                          <HardDrive
                            className={`h-4 w-4 ${isActive ? 'text-blue-500 dark:text-blue-400' : 'text-muted-foreground'}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-500 dark:text-blue-300' : 'text-foreground'}`}>
                            {device.deviceName || device.model || 'Unknown Device'}
                          </p>
                          <p className="text-xs text-muted-foreground/70 font-mono truncate">{device.deviceUuid}</p>
                          {device.userEmail && (
                            <p className="text-xs text-muted-foreground/50 truncate">{device.userEmail}</p>
                          )}
                        </div>
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0" />
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
            className="flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-foreground/80 transition-colors"
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
        <div className="flex flex-col items-center justify-center flex-1 border border-dashed border-border rounded-xl text-muted-foreground/50">
          <HardDrive className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm">Select a device from the dropdown above to browse its files</p>
        </div>
      )}
    </div>
  );
}
