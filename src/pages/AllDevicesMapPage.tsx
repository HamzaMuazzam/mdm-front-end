import { useEffect, useState, useRef, useCallback } from 'react';
import { MapPin, Wifi, WifiOff, RefreshCw, Loader2, Smartphone, Search, X, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { trackingService } from '@/api/services/tracking.service';
import type { HistoryPoint } from '@/api/services/tracking.service';
import type { Device } from '@/types/device.types';
import { useDevicesQuery } from '@/hooks/useDevices';
import { useDeviceStatusMqtt, useDeviceStatusStore } from '@/hooks/useDeviceStatus';
import { mqttService } from '@/api/services/mqtt.service';

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makePin(color: string, initials: string) {
  return new L.DivIcon({
    className: '',
    html: `<div style="position:relative;width:32px;height:44px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28s16-16 16-28C32 7.16 24.84 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="15" r="7" fill="white"/>
      </svg>
      <div style="position:absolute;top:7px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:800;color:${color};line-height:1;">${initials}</div>
    </div>`,
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -44],
  });
}

// ── Captures the map instance into a ref ─────────────────────────────────────
interface MapRefCaptureProps {
  mapRef: React.MutableRefObject<L.Map | null>;
}
function MapRefCapture({ mapRef }: MapRefCaptureProps) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

// ── Fit bounds once all locations are ready ───────────────────────────────────
interface FitBoundsProps {
  locations: DeviceLocation[];
  mapRef: React.MutableRefObject<L.Map | null>;
}
function FitBounds({ locations, mapRef }: FitBoundsProps) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const valid = locations.filter((l) => l.point);
    if (valid.length === 0) return;
    if (!mapRef.current) mapRef.current = map;

    if (valid.length === 1) {
      map.setView([valid[0].point!.latitude, valid[0].point!.longitude], 14);
    } else {
      const bounds = L.latLngBounds(valid.map((l) => [l.point!.latitude, l.point!.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
    fitted.current = true;
  }, [locations, map, mapRef]);
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface DeviceLocation {
  device: Device;
  point: HistoryPoint | null;
  error: boolean;
}

// ── Reverse geocode via Nominatim ─────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error('Geocode failed');
  const json = await res.json();
  return (json.display_name as string) ?? 'Unknown address';
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function AllDevicesMapPage() {
  useDeviceStatusMqtt();
  const deviceStatuses = useDeviceStatusStore((s) => s.statuses);
  const setDeviceStatus = useDeviceStatusStore((s) => s.setStatus);
  const { data: devices = [], isLoading: devicesLoading } = useDevicesQuery();

  const [locations, setLocations] = useState<DeviceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Search
  const [search, setSearch] = useState('');

  // Address lookup: { [deviceUuid]: string | 'loading' | 'error' }
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [addressLoading, setAddressLoading] = useState<Record<string, boolean>>({});

  // Sync presence from backend on load
  useEffect(() => {
    if (devices.length === 0) return;
    let cancelled = false;
    mqttService.getClients().then((clients) => {
      if (cancelled) return;
      const onlineIds = new Set(
        clients
          .filter((c) => c.status?.toLowerCase() === 'online')
          .map((c) => c.deviceId || c.clientId)
          .filter(Boolean)
      );
      devices.forEach((d) => {
        setDeviceStatus(d.deviceUuid, onlineIds.has(d.deviceUuid) ? 'online' : 'offline');
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [devices, setDeviceStatus]);

  // Fetch last location for every device
  useEffect(() => {
    if (devicesLoading || devices.length === 0) return;
    let cancelled = false;
    setLoading(true);
    // Clear cached addresses when refreshing
    setAddresses({});

    Promise.allSettled(
      devices.map((device) =>
        trackingService
          .getHistory(device.deviceUuid, { page: 0, size: 1 })
          .then((res) => ({ device, point: res.data?.content?.[0] ?? null, error: false }))
          .catch(() => ({ device, point: null, error: true }))
      )
    ).then((results) => {
      if (cancelled) return;
      setLocations(
        results.map((r, i) =>
          r.status === 'fulfilled' ? r.value : { device: devices[i], point: null, error: true }
        )
      );
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [devices, devicesLoading, refreshKey]);

  // Sidebar device click → fly to on map
  const handleSidebarClick = useCallback((loc: DeviceLocation) => {
    if (!loc.point || !mapRef.current) return;
    setSelectedUuid(loc.device.deviceUuid);
    mapRef.current.flyTo([loc.point.latitude, loc.point.longitude], 16, { duration: 1.2 });
  }, []);

  // Address button click — fetch and cache
  const handleShowAddress = useCallback(async (e: React.MouseEvent, uuid: string, lat: number, lng: number) => {
    e.stopPropagation(); // don't trigger flyTo
    if (addresses[uuid] || addressLoading[uuid]) return;
    setAddressLoading((prev) => ({ ...prev, [uuid]: true }));
    try {
      const addr = await reverseGeocode(lat, lng);
      setAddresses((prev) => ({ ...prev, [uuid]: addr }));
    } catch {
      setAddresses((prev) => ({ ...prev, [uuid]: 'Could not fetch address' }));
    } finally {
      setAddressLoading((prev) => ({ ...prev, [uuid]: false }));
    }
  }, [addresses, addressLoading]);

  // Filtered lists
  const q = search.trim().toLowerCase();
  const located = locations.filter((l) => l.point);
  const noLocation = locations.filter((l) => !l.point);

  const filteredLocated = q
    ? located.filter((l) =>
        (l.device.deviceName || l.device.model || '').toLowerCase().includes(q) ||
        l.device.phone?.toLowerCase().includes(q)
      )
    : located;

  const filteredNoLocation = q
    ? noLocation.filter((l) =>
        (l.device.deviceName || l.device.model || '').toLowerCase().includes(q) ||
        l.device.phone?.toLowerCase().includes(q)
      )
    : noLocation;

  const onlineCount = devices.filter((d) => deviceStatuses[d.deviceUuid] === 'online').length;
  const offlineCount = devices.length - onlineCount;
  const defaultCenter: [number, number] = [24.8607, 67.0011];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100vw', overflow: 'hidden' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-900 border-b px-4 py-2.5 shadow-sm flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md shadow-blue-500/20">
            <MapPin className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm sm:text-base leading-tight">All Devices — Live Map</h1>
            <p className="text-xs text-muted-foreground">
              {loading
                ? 'Fetching last known locations…'
                : `${located.length} of ${devices.length} device${devices.length !== 1 ? 's' : ''} located`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1">
            <Wifi className="h-3 w-3" /> {onlineCount} online
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2.5 py-1">
            <WifiOff className="h-3 w-3" /> {offlineCount} offline
          </span>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            title="Refresh locations"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 relative">
          {(loading || devicesLoading) && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm text-muted-foreground">Loading device locations…</p>
              </div>
            </div>
          )}

          <MapContainer
            center={defaultCenter}
            zoom={5}
            style={{ height: '100%', width: '100%' }}
            key={`map-${refreshKey}`}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapRefCapture mapRef={mapRef} />
            {!loading && <FitBounds locations={locations} mapRef={mapRef} />}

            {located.map(({ device, point }) => {
              const isOnline = (deviceStatuses[device.deviceUuid] ?? 'offline') === 'online';
              const initials = (device.deviceName || device.model || 'D').slice(0, 2).toUpperCase();
              const isSelected = selectedUuid === device.deviceUuid;
              const pin = makePin(
                isSelected
                  ? (isOnline ? '#16a34a' : '#475569')
                  : (isOnline ? '#22c55e' : '#94a3b8'),
                initials
              );

              return (
                <Marker
                  key={device.deviceUuid}
                  position={[point!.latitude, point!.longitude]}
                  icon={pin}
                >
                  <Popup minWidth={210} maxWidth={210}>
                    <div style={{ fontFamily: 'inherit' }}>
                      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                        {device.deviceName || device.model}
                      </p>
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          fontSize: 11, fontWeight: 500, padding: '2px 7px',
                          borderRadius: 9999, marginBottom: 7,
                          background: isOnline ? '#dcfce7' : '#f1f5f9',
                          color: isOnline ? '#15803d' : '#64748b',
                        }}
                      >
                        {isOnline ? '● Online' : '○ Offline'}
                      </span>
                      <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6, marginBottom: 8 }}>
                        <div>Lat: {point!.latitude.toFixed(6)}</div>
                        <div>Lng: {point!.longitude.toFixed(6)}</div>
                        {point!.speed > 0 && <div>Speed: {point!.speed.toFixed(1)} km/h</div>}
                        <div>Updated: {new Date(point!.receivedAt).toLocaleString()}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.open(`/device/${device.id}/tracking`, '_blank')}
                        style={{
                          width: '100%', fontSize: 12, fontWeight: 500,
                          background: '#2563eb', color: 'white', border: 'none',
                          borderRadius: 6, padding: '5px 0', cursor: 'pointer',
                        }}
                      >
                        Open Tracking ↗
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="w-60 xl:w-72 bg-white dark:bg-gray-900 border-l flex-shrink-0 hidden md:flex flex-col">
          {/* Sticky header + search */}
          <div className="flex-shrink-0 sticky top-0 z-10 bg-white dark:bg-gray-900 border-b">
            <div className="px-3 py-2 border-b bg-muted/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Devices ({devices.length})
              </p>
            </div>
            {/* Search bar */}
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search devices…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-7 pr-7 py-1.5 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto">
            {devices.length === 0 && !devicesLoading && (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground p-6">
                <Smartphone className="h-8 w-8 opacity-40" />
                <p className="text-xs text-center">No devices registered</p>
              </div>
            )}

            {/* No search results */}
            {q && filteredLocated.length === 0 && filteredNoLocation.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-1 text-muted-foreground">
                <Search className="h-5 w-5 opacity-40" />
                <p className="text-xs">No devices match "{search}"</p>
              </div>
            )}

            {/* Located devices */}
            {filteredLocated.map((loc) => {
              const { device, point } = loc;
              const isOnline = (deviceStatuses[device.deviceUuid] ?? 'offline') === 'online';
              const isSelected = selectedUuid === device.deviceUuid;
              const addr = addresses[device.deviceUuid];
              const addrPending = addressLoading[device.deviceUuid];

              return (
                <div
                  key={device.deviceUuid}
                  className={`border-b transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-muted/50'}`}
                >
                  {/* Main row — click to fly to */}
                  <button
                    type="button"
                    onClick={() => handleSidebarClick(loc)}
                    className="w-full flex items-start gap-2.5 px-3 pt-2.5 pb-1.5 text-left"
                    title="Click to center on map"
                  >
                    <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{device.deviceName || device.model}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {point!.latitude.toFixed(5)}, {point!.longitude.toFixed(5)}
                      </p>
                      <p className={`text-xs font-semibold mt-0.5 ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                        {isOnline ? 'Online' : 'Offline'}
                      </p>
                    </div>
                    <MapPin className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-1" />
                  </button>

                  {/* Address section */}
                  <div className="px-3 pb-2 pl-7">
                    {addr ? (
                      <p className="text-xs text-muted-foreground leading-snug">{addr}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleShowAddress(e, device.deviceUuid, point!.latitude, point!.longitude)}
                        disabled={addrPending}
                        className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {addrPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Navigation className="h-3 w-3" />
                        )}
                        {addrPending ? 'Fetching address…' : 'Show address'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* No-location section */}
            {filteredNoLocation.length > 0 && (
              <>
                <div className="px-3 py-1.5 bg-muted/30 border-b">
                  <p className="text-xs text-muted-foreground font-medium">No location data</p>
                </div>
                {filteredNoLocation.map(({ device }) => {
                  const isOnline = (deviceStatuses[device.deviceUuid] ?? 'offline') === 'online';
                  return (
                    <div
                      key={device.deviceUuid}
                      className="flex items-start gap-2.5 px-3 py-2.5 border-b opacity-50"
                    >
                      <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{device.deviceName || device.model}</p>
                        <p className="text-xs text-muted-foreground">No location recorded</p>
                        <p className={`text-xs font-semibold mt-0.5 ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                          {isOnline ? 'Online' : 'Offline'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
