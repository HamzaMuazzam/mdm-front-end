import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
} from 'react';
import {
  ArrowUpRight,
  BatteryMedium,
  ChevronDown,
  ChevronUp,
  Clock3,
  Crosshair,
  Gauge,
  Layers3,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { trackingService } from '@/api/services/tracking.service';
import type { HistoryPoint } from '@/api/services/tracking.service';
import { mqttService } from '@/api/services/mqtt.service';
import { useDevicesQuery } from '@/hooks/useDevices';
import { useDeviceStatusMqtt, useDeviceStatusStore } from '@/hooks/useDeviceStatus';
import { cn } from '@/lib/utils';
import type { Device } from '@/types/device.types';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makePin(color: string, initials: string, selected: boolean) {
  return new L.DivIcon({
    className: 'device-map-marker',
    html: `
      <div class="device-marker ${selected ? 'is-selected' : ''}" style="--marker-color:${color}">
        <div class="device-marker__pulse"></div>
        <div class="device-marker__bubble">
          <span>${initials}</span>
        </div>
        <div class="device-marker__tail"></div>
      </div>
    `,
    iconSize: [56, 72],
    iconAnchor: [28, 62],
    popupAnchor: [0, -54],
  });
}

interface MapRefCaptureProps {
  mapRef: MutableRefObject<L.Map | null>;
}

function MapRefCapture({ mapRef }: MapRefCaptureProps) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  return null;
}

interface FitBoundsProps {
  locations: DeviceLocation[];
  mapRef: MutableRefObject<L.Map | null>;
}

function FitBounds({ locations, mapRef }: FitBoundsProps) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;

    const valid = locations.filter((location) => location.point);
    if (valid.length === 0) return;

    if (!mapRef.current) {
      mapRef.current = map;
    }

    if (valid.length === 1) {
      map.setView([valid[0].point!.latitude, valid[0].point!.longitude], 15);
    } else {
      const bounds = L.latLngBounds(
        valid.map((location) => [location.point!.latitude, location.point!.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 14 });
    }

    fitted.current = true;
  }, [locations, map, mapRef]);

  return null;
}

interface DeviceLocation {
  device: Device;
  point: HistoryPoint | null;
  error: boolean;
}

type PanelView = 'all' | 'located' | 'unlocated';

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const response = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!response.ok) throw new Error('Geocode failed');

  const json = await response.json();
  return (json.display_name as string) ?? 'Unknown address';
}

function getDeviceLabel(device: Device): string {
  return device.deviceName || device.model || `Device ${device.id}`;
}

function getDeviceSubtitle(device: Device): string {
  return [device.model, device.phone].filter(Boolean).join(' • ') || 'Managed Android device';
}

function formatTimestamp(value?: string | null): string {
  if (!value) return 'No recent update';
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatTimeAgo(value?: string | null): string {
  if (!value) return 'No update';

  const diffMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'Just now';

  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatSpeed(speed: number): string {
  if (speed <= 0) return 'Stationary';
  return speed >= 10 ? `${speed.toFixed(0)} km/h` : `${speed.toFixed(1)} km/h`;
}

function formatCoords(point: HistoryPoint): string {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}

function focusMapOnLocations(map: L.Map, items: DeviceLocation[]) {
  const valid = items.filter((item) => item.point);
  if (valid.length === 0) return;

  if (valid.length === 1) {
    map.flyTo([valid[0].point!.latitude, valid[0].point!.longitude], 16, { duration: 1.2 });
    return;
  }

  const bounds = L.latLngBounds(
    valid.map((item) => [item.point!.latitude, item.point!.longitude] as [number, number])
  );
  map.flyToBounds(bounds, { padding: [64, 64], duration: 1.2, maxZoom: 14 });
}

export function AllDevicesMapPage() {
  useDeviceStatusMqtt();

  const deviceStatuses = useDeviceStatusStore((state) => state.statuses);
  const setDeviceStatus = useDeviceStatusStore((state) => state.setStatus);
  const { data: devices = [], isLoading: devicesLoading } = useDevicesQuery();

  const [locations, setLocations] = useState<DeviceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [panelView, setPanelView] = useState<PanelView>('all');
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [addressLoading, setAddressLoading] = useState<Record<string, boolean>>({});
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!devicesLoading && devices.length === 0) {
      setLocations([]);
      setLoading(false);
    }
  }, [devices, devicesLoading]);

  useEffect(() => {
    if (devices.length === 0) return;

    let cancelled = false;

    mqttService
      .getClients()
      .then((clients) => {
        if (cancelled) return;

        const onlineIds = new Set(
          clients
            .filter((client) => client.status?.toLowerCase() === 'online')
            .map((client) => client.deviceId || client.clientId)
            .filter(Boolean)
        );

        devices.forEach((device) => {
          setDeviceStatus(device.deviceUuid, onlineIds.has(device.deviceUuid) ? 'online' : 'offline');
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [devices, setDeviceStatus]);

  useEffect(() => {
    if (devicesLoading) return;
    if (devices.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setAddresses({});

    Promise.allSettled(
      devices.map((device) =>
        trackingService
          .getHistory(device.deviceUuid, { page: 0, size: 1 })
          .then((response) => ({
            device,
            point: response.data?.content?.[0] ?? null,
            error: false,
          }))
          .catch(() => ({
            device,
            point: null,
            error: true,
          }))
      )
    ).then((results) => {
      if (cancelled) return;

      setLocations(
        results.map((result, index) =>
          result.status === 'fulfilled'
            ? result.value
            : { device: devices[index], point: null, error: true }
        )
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [devices, devicesLoading, refreshKey]);

  const handleDeviceFocus = useCallback((location: DeviceLocation, collapseMobileSheet = false) => {
    if (!location.point || !mapRef.current) return;

    setSelectedUuid(location.device.deviceUuid);
    mapRef.current.flyTo([location.point.latitude, location.point.longitude], 16, { duration: 1.2 });

    if (collapseMobileSheet) {
      setMobileSheetExpanded(false);
    }
  }, []);

  const handleShowAddress = useCallback(
    async (
      event: ReactMouseEvent<HTMLElement>,
      uuid: string,
      lat: number,
      lng: number
    ) => {
      event.stopPropagation();

      if (addresses[uuid] || addressLoading[uuid]) return;

      setAddressLoading((current) => ({ ...current, [uuid]: true }));

      try {
        const address = await reverseGeocode(lat, lng);
        setAddresses((current) => ({ ...current, [uuid]: address }));
      } catch {
        setAddresses((current) => ({ ...current, [uuid]: 'Could not fetch address' }));
      } finally {
        setAddressLoading((current) => ({ ...current, [uuid]: false }));
      }
    },
    [addresses, addressLoading]
  );

  const handleOpenTracking = useCallback((deviceId: number) => {
    window.open(`/device/${deviceId}/tracking`, '_blank', 'noopener,noreferrer');
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const q = search.trim().toLowerCase();
  const located = useMemo(() => locations.filter((location) => location.point), [locations]);
  const noLocation = useMemo(() => locations.filter((location) => !location.point), [locations]);

  const filteredLocated = useMemo(() => {
    if (!q) return located;

    return located.filter((location) => {
      const label = getDeviceLabel(location.device).toLowerCase();
      const subtitle = getDeviceSubtitle(location.device).toLowerCase();
      return label.includes(q) || subtitle.includes(q);
    });
  }, [located, q]);

  const filteredNoLocation = useMemo(() => {
    if (!q) return noLocation;

    return noLocation.filter((location) => {
      const label = getDeviceLabel(location.device).toLowerCase();
      const subtitle = getDeviceSubtitle(location.device).toLowerCase();
      return label.includes(q) || subtitle.includes(q);
    });
  }, [noLocation, q]);

  const onlineCount = useMemo(
    () => devices.filter((device) => deviceStatuses[device.deviceUuid] === 'online').length,
    [deviceStatuses, devices]
  );
  const offlineCount = devices.length - onlineCount;
  const coveragePercent = devices.length > 0 ? Math.round((located.length / devices.length) * 100) : 0;
  const locationIssueCount = useMemo(
    () => locations.filter((location) => location.error).length,
    [locations]
  );
  const visibleResultCount = filteredLocated.length + filteredNoLocation.length;
  const selectedLocation = useMemo(
    () => located.find((location) => location.device.deviceUuid === selectedUuid) ?? null,
    [located, selectedUuid]
  );

  const focusTargets = q && filteredLocated.length > 0 ? filteredLocated : located;
  const canFocusTargets = focusTargets.length > 0 && !!mapRef.current;

  const summaryCards = [
    {
      label: 'Mapped devices',
      value: located.length,
      supporting: `${coveragePercent}% coverage`,
      icon: MapPin,
      accentClassName: 'from-cyan-500/30 via-sky-500/15 to-white/5',
      iconClassName: 'bg-cyan-400/15 text-cyan-200',
    },
    {
      label: 'Live online',
      value: onlineCount,
      supporting: `${offlineCount} offline`,
      icon: Wifi,
      accentClassName: 'from-emerald-500/30 via-emerald-400/15 to-white/5',
      iconClassName: 'bg-emerald-400/15 text-emerald-200',
    },
    {
      label: 'Waiting for GPS',
      value: noLocation.length,
      supporting: locationIssueCount > 0 ? `${locationIssueCount} fetch issue(s)` : 'No coordinates yet',
      icon: WifiOff,
      accentClassName: 'from-amber-500/30 via-orange-400/15 to-white/5',
      iconClassName: 'bg-amber-400/15 text-amber-100',
    },
    {
      label: q ? 'Search results' : 'Fleet health',
      value: q ? visibleResultCount : devices.length,
      supporting: q ? 'Matching devices in feed' : `${devices.length - locationIssueCount} synced cleanly`,
      icon: q ? Layers3 : ShieldAlert,
      accentClassName: 'from-violet-500/25 via-fuchsia-400/15 to-white/5',
      iconClassName: 'bg-violet-400/15 text-violet-100',
    },
  ];

  const panelFilters = [
    { key: 'all' as const, label: 'All', count: visibleResultCount },
    { key: 'located' as const, label: 'Tracked', count: filteredLocated.length },
    { key: 'unlocated' as const, label: 'Needs sync', count: filteredNoLocation.length },
  ];

  const showLocatedSection = panelView !== 'unlocated';
  const showNoLocationSection = panelView !== 'located';
  const defaultCenter: [number, number] = [24.8607, 67.0011];

  const renderPanelContent = (isMobile: boolean) => (
    <>
      <div
        className={cn(
          'border-b border-white/10 bg-slate-950/75 px-4 pb-4 pt-4 backdrop-blur-xl',
          isMobile && 'px-5'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-sky-200/70">
              Device Feed
            </p>
            <h2 className="mt-1 text-base font-semibold text-white sm:text-lg">
              Browse the fleet
            </h2>
            <p className="mt-1 text-xs text-slate-300/70">
              {q ? `${visibleResultCount} matching device${visibleResultCount === 1 ? '' : 's'}` : `${devices.length} managed device${devices.length === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[0.72rem] font-medium text-slate-200">
            <Layers3 className="h-3.5 w-3.5 text-sky-200" />
            {visibleResultCount}
          </div>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, model, or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-11 text-sm text-white outline-none ring-0 placeholder:text-slate-400 focus:border-sky-400/70 focus:bg-white/[0.08]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
          {panelFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setPanelView(filter.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium transition-all duration-200',
                panelView === filter.key
                  ? 'border-sky-300/40 bg-sky-400/15 text-white shadow-[0_16px_30px_rgba(56,189,248,0.15)]'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/15 hover:bg-white/[0.08] hover:text-white'
              )}
            >
              <span>{filter.label}</span>
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[0.68rem] text-slate-100">
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={cn('flex-1 overflow-y-auto px-4 pb-8 pt-4', isMobile && 'px-5')}>
        {devices.length === 0 && !devicesLoading && (
          <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-300">
              <Smartphone className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">No devices yet</h3>
            <p className="mt-2 text-sm text-slate-400">
              As soon as a device is enrolled, it will appear here with live status and coordinates.
            </p>
          </div>
        )}

        {devices.length > 0 && visibleResultCount === 0 && (
          <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-300">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">No matching devices</h3>
            <p className="mt-2 text-sm text-slate-400">
              Try a different device name, model, or phone number.
            </p>
          </div>
        )}

        <div className="space-y-5">
          {showLocatedSection && filteredLocated.length > 0 && (
            <section className="space-y-3">
              {panelView === 'all' && (
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-sky-200/70">
                    Tracked Devices
                  </p>
                  <p className="text-xs text-slate-400">{filteredLocated.length} with map data</p>
                </div>
              )}

              {filteredLocated.map((location) => {
                const { device, point } = location;
                const isOnline = (deviceStatuses[device.deviceUuid] ?? 'offline') === 'online';
                const isSelected = selectedUuid === device.deviceUuid;
                const address = addresses[device.deviceUuid];
                const pendingAddress = addressLoading[device.deviceUuid];
                const initials = getDeviceLabel(device).slice(0, 2).toUpperCase();

                return (
                  <div
                    key={device.deviceUuid}
                    className={cn(
                      'rounded-[24px] border p-3.5 text-left transition-all duration-300',
                      isSelected
                        ? 'border-sky-300/35 bg-sky-400/12 shadow-[0_20px_48px_rgba(56,189,248,0.14)]'
                        : 'border-white/10 bg-white/[0.04] hover:border-white/15 hover:bg-white/[0.06]'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/5 text-[0.78rem] font-semibold text-white shadow-inner shadow-white/5">
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-[0.84rem] font-semibold text-white sm:text-[0.9rem]">
                              {getDeviceLabel(device)}
                            </p>
                            <p className="mt-0.5 truncate text-[0.72rem] text-slate-400">
                              {getDeviceSubtitle(device)}
                            </p>
                          </div>

                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.64rem] font-medium',
                              isOnline
                                ? 'border-emerald-300/25 bg-emerald-400/12 text-emerald-100'
                                : 'border-slate-300/15 bg-slate-200/10 text-slate-200'
                            )}
                          >
                            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>

                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/70 px-2 py-0.5 text-[0.64rem] text-slate-200">
                            <Gauge className="h-3 w-3 text-cyan-200" />
                            {formatSpeed(point!.speed)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/70 px-2 py-0.5 text-[0.64rem] text-slate-200">
                            <Clock3 className="h-3 w-3 text-slate-300" />
                            {formatTimeAgo(point!.receivedAt)}
                          </span>
                          {device.batteryCharge !== undefined && device.batteryCharge !== null && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/70 px-2 py-0.5 text-[0.64rem] text-slate-200">
                              <BatteryMedium className="h-3 w-3 text-emerald-200" />
                              {device.batteryCharge}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      <div className="rounded-[18px] border border-white/8 bg-slate-950/70 p-2.5">
                        <p className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                          Coordinates
                        </p>
                        <p className="mt-1 text-[0.82rem] font-medium text-slate-100">
                          {formatCoords(point!)}
                        </p>
                      </div>

                      <div className="rounded-[18px] border border-white/8 bg-slate-950/70 p-2.5">
                        <p className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                          Last sync
                        </p>
                        <p className="mt-1 text-[0.82rem] font-medium text-slate-100">
                          {formatTimestamp(point!.receivedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 rounded-[18px] border border-white/8 bg-white/[0.03] px-2.5 py-2">
                      {address ? (
                        <p className="text-[0.72rem] leading-4 text-slate-300">{address}</p>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) =>
                            handleShowAddress(event, device.deviceUuid, point!.latitude, point!.longitude)
                          }
                          disabled={pendingAddress}
                          className="inline-flex items-center gap-1.5 text-[0.72rem] font-medium text-sky-200 transition-colors hover:text-white disabled:opacity-60"
                        >
                          {pendingAddress ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Navigation className="h-3 w-3" />
                          )}
                          {pendingAddress ? 'Fetching address...' : 'Show exact address'}
                        </button>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-col gap-1.5 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => handleDeviceFocus(location, isMobile)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[18px] bg-white px-3.5 py-2.5 text-[0.8rem] font-medium text-slate-950 transition-transform duration-200 hover:-translate-y-0.5"
                      >
                        <LocateFixed className="h-3.5 w-3.5" />
                        Center on map
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenTracking(device.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[18px] border border-white/10 bg-white/5 px-3.5 py-2.5 text-[0.8rem] font-medium text-white transition-colors hover:bg-white/10"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Open tracking
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {showNoLocationSection && filteredNoLocation.length > 0 && (
            <section className="space-y-3">
              {panelView === 'all' && (
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-200/70">
                    Needs Attention
                  </p>
                  <p className="text-xs text-slate-400">{filteredNoLocation.length} waiting for first location</p>
                </div>
              )}

              {filteredNoLocation.map((location) => {
                const { device } = location;
                const isOnline = (deviceStatuses[device.deviceUuid] ?? 'offline') === 'online';

                return (
                  <div
                    key={device.deviceUuid}
                    className="rounded-[28px] border border-amber-300/20 bg-amber-400/10 p-4 text-left shadow-[0_20px_50px_rgba(245,158,11,0.08)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-300/10 text-sm font-semibold text-amber-50">
                        {getDeviceLabel(device).slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white sm:text-[0.95rem]">
                              {getDeviceLabel(device)}
                            </p>
                            <p className="mt-1 truncate text-xs text-amber-50/70">
                              {getDeviceSubtitle(device)}
                            </p>
                          </div>

                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[0.68rem] font-medium',
                              isOnline
                                ? 'border-emerald-300/20 bg-emerald-400/12 text-emerald-100'
                                : 'border-amber-300/15 bg-slate-950/20 text-amber-100'
                            )}
                          >
                            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/15 bg-slate-950/25 px-2.5 py-1 text-[0.68rem] text-amber-50">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            No location recorded
                          </span>
                          {device.batteryCharge !== undefined && device.batteryCharge !== null && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/15 bg-slate-950/25 px-2.5 py-1 text-[0.68rem] text-amber-50">
                              <BatteryMedium className="h-3.5 w-3.5" />
                              {device.batteryCharge}%
                            </span>
                          )}
                        </div>

                        <div className="mt-3 rounded-2xl border border-amber-200/15 bg-slate-950/25 p-3">
                          <p className="text-xs leading-5 text-amber-50/80">
                            This device has not uploaded any trackable coordinates yet. Keep it online and confirm location permissions plus GPS access on the handset.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="all-devices-map-page relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-6%] h-72 w-72 rounded-full bg-cyan-500/18 blur-[120px]" />
        <div className="absolute right-[-12%] top-[18%] h-80 w-80 rounded-full bg-fuchsia-500/14 blur-[140px]" />
        <div className="absolute bottom-[-12%] left-[20%] h-96 w-96 rounded-full bg-emerald-500/12 blur-[150px]" />
      </div>

      <div className="relative flex h-[100dvh] flex-col p-3 sm:p-4 lg:p-5">
        <div className="grid flex-1 min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
          <section className="relative min-h-0 overflow-hidden rounded-[34px] border border-white/10 bg-slate-900/85 shadow-[0_32px_120px_rgba(15,23,42,0.45)] ring-1 ring-white/5">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[700] p-2 sm:p-2.5">
              <div className="pointer-events-auto rounded-[20px] border border-white/12 bg-slate-950/55 p-2.5 backdrop-blur-2xl shadow-[0_18px_48px_rgba(2,6,23,0.32)] sm:p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-950 shadow-[0_10px_20px_rgba(56,189,248,0.28)]">
                      <MapPin className="h-[15px] w-[15px]" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[0.54rem] font-medium uppercase tracking-[0.24em] text-cyan-100/70">
                        Live Fleet Atlas
                      </p>
                      <h1 className="mt-0.5 text-[0.78rem] font-semibold tracking-tight text-white sm:text-[0.96rem]">
                        Track every device in one premium map view
                      </h1>
                      <p className="mt-1 max-w-xl text-[0.64rem] text-slate-300/85 sm:text-[0.68rem]">
                        {loading
                          ? 'Pulling the latest coordinates and connection state from your fleet.'
                          : `${located.length} mapped, ${onlineCount} online, and ${noLocation.length} device${noLocation.length === 1 ? '' : 's'} still waiting for first GPS sync.`}
                      </p>
                    </div>
                  </div>

                  <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => mapRef.current && focusMapOnLocations(mapRef.current, focusTargets)}
                      disabled={!canFocusTargets}
                      className="inline-flex h-8 items-center gap-1 rounded-[14px] border border-white/10 bg-white/5 px-2.5 text-[0.68rem] font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <LocateFixed className="h-3 w-3" />
                      <span className="hidden sm:inline">{q ? 'Focus results' : 'Fit fleet'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={loading}
                      className="inline-flex h-8 items-center gap-1 rounded-[14px] bg-white px-2.5 text-[0.68rem] font-medium text-slate-950 transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                      <span className="hidden sm:inline">Refresh</span>
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
                  {summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div
                        key={card.label}
                        className={cn(
                          'min-w-[6.7rem] flex-1 rounded-[16px] border border-white/10 bg-gradient-to-br p-2 shadow-[0_12px_26px_rgba(15,23,42,0.24)]',
                          card.accentClassName
                        )}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <p className="text-[0.52rem] font-medium uppercase tracking-[0.12em] text-slate-300/75">
                              {card.label}
                            </p>
                            <p className="mt-1 text-[0.95rem] font-semibold tracking-tight text-white">
                              {card.value}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[0.52rem] leading-[1.1] text-slate-300/80">
                              {card.supporting}
                            </p>
                          </div>
                          <div className={cn('flex h-6 w-6 items-center justify-center rounded-[12px]', card.iconClassName)}>
                            <Icon className="h-3 w-3" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedLocation?.point && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[16px] border border-sky-300/20 bg-sky-400/12 px-2.5 py-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-[12px] bg-white/10 text-sky-100">
                      <Crosshair className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.7rem] font-semibold text-white">
                        {getDeviceLabel(selectedLocation.device)}
                      </p>
                      <p className="mt-0.5 truncate text-[0.58rem] text-slate-200/80">
                        {formatCoords(selectedLocation.point)} • {formatTimeAgo(selectedLocation.point.receivedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenTracking(selectedLocation.device.id)}
                      className="inline-flex items-center gap-1 rounded-[14px] border border-white/10 bg-white/10 px-2.5 py-1 text-[0.6rem] font-medium text-white hover:bg-white/15"
                    >
                      <ArrowUpRight className="h-2.5 w-2.5" />
                      Open tracking
                    </button>
                  </div>
                )}
              </div>
            </div>

            {(loading || devicesLoading) && (
              <div className="absolute inset-0 z-[750] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm">
                <div className="rounded-[28px] border border-white/10 bg-slate-950/80 px-8 py-7 text-center shadow-[0_24px_80px_rgba(2,6,23,0.5)]">
                  <Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-300" />
                  <p className="mt-4 text-sm font-medium text-white">Loading device locations</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Syncing the newest coordinates and connection state.
                  </p>
                </div>
              </div>
            )}

            <MapContainer
              center={defaultCenter}
              zoom={5}
              zoomControl={false}
              className="h-full w-full"
              style={{ height: '100%', width: '100%' }}
              key={`map-${refreshKey}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <ZoomControl position="bottomright" />
              <MapRefCapture mapRef={mapRef} />
              {!loading && <FitBounds locations={locations} mapRef={mapRef} />}

              {located.map(({ device, point }) => {
                const isOnline = (deviceStatuses[device.deviceUuid] ?? 'offline') === 'online';
                const initials = getDeviceLabel(device).slice(0, 2).toUpperCase();
                const isSelected = selectedUuid === device.deviceUuid;
                const pin = makePin(
                  isOnline ? (isSelected ? '#22d3ee' : '#14b8a6') : (isSelected ? '#cbd5e1' : '#64748b'),
                  initials,
                  isSelected
                );

                return (
                  <Marker
                    key={device.deviceUuid}
                    position={[point!.latitude, point!.longitude]}
                    icon={pin}
                    eventHandlers={{
                      click: () => setSelectedUuid(device.deviceUuid),
                    }}
                  >
                    <Popup minWidth={260} maxWidth={260}>
                      <div className="w-[240px] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {getDeviceLabel(device)}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {getDeviceSubtitle(device)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.68rem] font-medium',
                              isOnline
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl bg-slate-100 p-3">
                            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
                              Speed
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {formatSpeed(point!.speed)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-100 p-3">
                            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
                              Updated
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {formatTimeAgo(point!.receivedAt)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 rounded-2xl bg-slate-100 p-3 text-xs leading-5 text-slate-600">
                          <div>Lat: {point!.latitude.toFixed(6)}</div>
                          <div>Lng: {point!.longitude.toFixed(6)}</div>
                          <div>Accuracy: {point!.accuracy.toFixed(1)} m</div>
                          <div>{formatTimestamp(point!.receivedAt)}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenTracking(device.id)}
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition-transform duration-200 hover:-translate-y-0.5"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                          Open tracking
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            <div className="absolute inset-x-0 bottom-0 z-[720] lg:hidden">
              <div
                className={cn(
                  'mx-2 rounded-t-[30px] border border-white/10 bg-slate-950/90 shadow-[0_-20px_80px_rgba(2,6,23,0.65)] backdrop-blur-2xl transition-all duration-300 sm:mx-3',
                  mobileSheetExpanded ? 'h-[76dvh]' : 'h-[19rem]'
                )}
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.6rem)' }}
              >
                <div className="flex items-center justify-between px-5 pt-3">
                  <div className="mx-auto h-1.5 w-12 rounded-full bg-white/15" />
                </div>

                <div className="flex items-center justify-between px-5 pb-1 pt-3">
                  <div>
                    <p className="text-[0.68rem] font-medium uppercase tracking-[0.28em] text-slate-400">
                      Mobile Sheet
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      Native-style device drawer
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileSheetExpanded((value) => !value)}
                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3.5 text-xs font-medium text-white"
                  >
                    {mobileSheetExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    {mobileSheetExpanded ? 'Collapse' : 'Expand'}
                  </button>
                </div>

                <div className="flex h-[calc(100%-4.5rem)] flex-col min-h-0">
                  {renderPanelContent(true)}
                </div>
              </div>
            </div>
          </section>

          <aside className="hidden min-h-0 overflow-hidden rounded-[34px] border border-white/10 bg-slate-950/78 shadow-[0_28px_90px_rgba(2,6,23,0.42)] backdrop-blur-2xl lg:flex lg:flex-col">
            {renderPanelContent(false)}
          </aside>
        </div>
      </div>
    </div>
  );
}
