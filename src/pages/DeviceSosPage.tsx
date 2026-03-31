import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Siren, RefreshCw, Loader2, MapPin,
  BatteryMedium, Wifi, WifiOff, ChevronLeft, ChevronRight,
  ExternalLink, Radio, CalendarDays,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDevicesQuery } from '@/hooks/useDevices';
import { trackingService, type TrackingEventData } from '@/api/services/tracking.service';

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SOS_PIN = new L.DivIcon({
  className: '',
  html: `<div style="position:relative;width:36px;height:50px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="50" viewBox="0 0 36 50">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 32 18 32s18-18.5 18-32C36 8.06 27.94 0 18 0z"
            fill="#dc2626" stroke="white" stroke-width="2"/>
      <circle cx="18" cy="17" r="9" fill="white"/>
    </svg>
    <div style="position:absolute;top:9px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:900;color:#dc2626;line-height:1;">SOS</div>
  </div>`,
  iconSize: [36, 50], iconAnchor: [18, 50], popupAnchor: [0, -52],
});

const SELECTED_PIN = new L.DivIcon({
  className: '',
  html: `<div style="position:relative;width:44px;height:60px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="60" viewBox="0 0 44 60">
      <path d="M22 0C9.85 0 0 9.85 0 22c0 16.5 22 38 22 38s22-21.5 22-38C44 9.85 34.15 0 22 0z"
            fill="#b91c1c" stroke="white" stroke-width="2.5"/>
      <circle cx="22" cy="21" r="11" fill="white"/>
    </svg>
    <div style="position:absolute;top:11px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:900;color:#b91c1c;line-height:1;">SOS</div>
  </div>`,
  iconSize: [44, 60], iconAnchor: [22, 60], popupAnchor: [0, -62],
});

// ── Map helpers ───────────────────────────────────────────────────────────────
interface FlyToProps { lat: number; lng: number; trigger: number }
function FlyTo({ lat, lng, trigger }: FlyToProps) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.flyTo([lat, lng], 15, { duration: 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return null;
}

interface FitAllProps { events: TrackingEventData[] }
function FitAll({ events }: FitAllProps) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || events.length === 0) return;
    if (events.length === 1) {
      map.setView([events[0].latitude, events[0].longitude], 14);
    } else {
      const bounds = L.latLngBounds(events.map((e) => [e.latitude, e.longitude]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
    done.current = true;
  }, [events, map]);
  return null;
}

// ── Metadata parsing ──────────────────────────────────────────────────────────
interface SosMeta { battery?: number; network?: string; ts?: number }
function parseMeta(raw: string | null): SosMeta {
  if (!raw) return {};
  try { return JSON.parse(raw) as SosMeta; } catch { return {}; }
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(iso));
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 16);
}

function networkIcon(network?: string) {
  if (!network) return null;
  const n = network.toUpperCase();
  if (n === 'WIFI') return <Wifi className="h-3.5 w-3.5" />;
  if (n === 'NONE') return <WifiOff className="h-3.5 w-3.5" />;
  return <Radio className="h-3.5 w-3.5" />;
}

function batteryColor(pct?: number) {
  if (pct == null) return 'text-gray-400';
  if (pct <= 20)  return 'text-red-500';
  if (pct <= 50)  return 'text-amber-500';
  return 'text-green-600';
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function DeviceSosPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const { data: devices = [] } = useDevicesQuery();
  const device = devices.find((d) => String(d.id) === deviceId);

  // Filter state
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(toInputDate(weekAgo));
  const [to, setTo]     = useState(toInputDate(now));
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  // Data state
  const [events, setEvents]       = useState<TrackingEventData[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Selected event for map focus
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [flyTrigger, setFlyTrigger] = useState(0);
  const selectedEvent = events.find((e) => e.id === selectedId) ?? events[0] ?? null;

  const fetchEvents = useCallback(async () => {
    if (!device?.deviceUuid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await trackingService.getTrackingEvents(device.deviceUuid, {
        type: 'SOS',
        from: from ? new Date(from).toISOString() : undefined,
        to:   to   ? new Date(to).toISOString()   : undefined,
        page,
        size: PAGE_SIZE,
      });
      const p = res.data;
      setEvents(p.content ?? []);
      setTotalPages(p.totalPages ?? 0);
      setTotalItems(p.totalElements ?? 0);
      if (p.content?.length) setSelectedId(p.content[0].id);
    } catch {
      setError('Failed to load SOS events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [device?.deviceUuid, from, to, page]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleSelect = (ev: TrackingEventData) => {
    setSelectedId(ev.id);
    setFlyTrigger((t) => t + 1);
  };

  const defaultCenter: [number, number] = selectedEvent
    ? [selectedEvent.latitude, selectedEvent.longitude]
    : [24.8607, 67.0011];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white dark:bg-gray-900 shadow-sm flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="p-2 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg shadow-md shadow-red-500/20">
          <Siren className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base leading-tight">SOS History</h1>
          <p className="text-xs text-muted-foreground truncate">
            {device ? (device.deviceName || device.model) : `Device #${deviceId}`}
          </p>
        </div>
        {/* Stats pill */}
        {!loading && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1 font-medium">
            <Siren className="h-3 w-3" />
            {totalItems} SOS event{totalItems !== 1 ? 's' : ''}
          </span>
        )}
        <button
          type="button"
          onClick={fetchEvents}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">From</span>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(0); }}
            className="text-xs border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-red-400"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">To</span>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(0); }}
            className="text-xs border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-red-400"
          />
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left — event list */}
        <div className="w-full md:w-[380px] xl:w-[420px] flex flex-col border-r flex-shrink-0 bg-white dark:bg-gray-900">
          {/* loading / error / empty states */}
          {loading && (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-red-500" />
              <p className="text-sm">Loading SOS events…</p>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 px-6 text-center">
              <Siren className="h-8 w-8 text-red-300" />
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={fetchEvents}
                className="text-xs text-blue-600 underline"
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !error && events.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <Siren className="h-7 w-7 text-red-300" />
              </div>
              <p className="font-medium text-sm">No SOS Events</p>
              <p className="text-xs text-muted-foreground">
                No SOS events recorded in the selected time range.
              </p>
            </div>
          )}

          {/* Event cards */}
          {!loading && !error && events.length > 0 && (
            <div className="flex-1 overflow-y-auto">
              {events.map((ev, idx) => {
                const meta = parseMeta(ev.metadata);
                const isSelected = selectedId === ev.id;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => handleSelect(ev)}
                    className={`w-full text-left px-4 py-3.5 border-b transition-colors ${
                      isSelected
                        ? 'bg-red-50 dark:bg-red-950/20 border-l-2 border-l-red-500'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        <Siren className="h-3 w-3" /> SOS
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        #{(page * PAGE_SIZE) + idx + 1}
                      </span>
                    </div>

                    {/* Date/time */}
                    <p className="text-sm font-semibold text-foreground mb-1.5">
                      {fmtDate(ev.eventTime)}
                    </p>

                    {/* Coordinates */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground">
                        {ev.latitude.toFixed(6)}, {ev.longitude.toFixed(6)}
                      </span>
                    </div>

                    {/* Battery + Network row */}
                    <div className="flex items-center gap-3">
                      {meta.battery != null && (
                        <span className={`flex items-center gap-1 text-xs font-medium ${batteryColor(meta.battery)}`}>
                          <BatteryMedium className="h-3.5 w-3.5" />
                          {meta.battery}%
                        </span>
                      )}
                      {meta.network && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                          {networkIcon(meta.network)}
                          {meta.network}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20 flex-shrink-0">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right — Map */}
        <div className="flex-1 relative hidden md:block">
          {/* Empty state overlay */}
          {!loading && events.length === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-muted/30">
              <MapPin className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No SOS locations to display</p>
            </div>
          )}

          <MapContainer
            center={defaultCenter}
            zoom={selectedEvent ? 14 : 5}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Fit all on first load */}
            {events.length > 0 && <FitAll events={events} />}

            {/* Fly to selected event */}
            {selectedEvent && (
              <FlyTo lat={selectedEvent.latitude} lng={selectedEvent.longitude} trigger={flyTrigger} />
            )}

            {events.map((ev) => {
              const meta = parseMeta(ev.metadata);
              const isSelected = selectedId === ev.id;
              return (
                <Marker
                  key={ev.id}
                  position={[ev.latitude, ev.longitude]}
                  icon={isSelected ? SELECTED_PIN : SOS_PIN}
                  eventHandlers={{ click: () => handleSelect(ev) }}
                >
                  <Popup minWidth={220} maxWidth={240}>
                    <div style={{ fontFamily: 'inherit' }}>
                      {/* SOS badge */}
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: '#dc2626', color: 'white',
                        fontSize: 11, fontWeight: 700, padding: '3px 8px',
                        borderRadius: 999, marginBottom: 8,
                      }}>
                        🆘 SOS Alert
                      </div>

                      {/* Time */}
                      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                        {fmtDate(ev.eventTime)}
                      </p>

                      {/* Coords */}
                      <p style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginBottom: 6 }}>
                        {ev.latitude.toFixed(6)}, {ev.longitude.toFixed(6)}
                      </p>

                      {/* Battery + Network */}
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#475569', marginBottom: 10 }}>
                        {meta.battery != null && (
                          <span>🔋 {meta.battery}%</span>
                        )}
                        {meta.network && (
                          <span>📶 {meta.network}</span>
                        )}
                      </div>

                      {/* Open Tracking button */}
                      <button
                        type="button"
                        onClick={() => window.open(`/device/${deviceId}/tracking`, '_blank')}
                        style={{
                          width: '100%', fontSize: 12, fontWeight: 500,
                          background: '#dc2626', color: 'white', border: 'none',
                          borderRadius: 6, padding: '6px 0', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        Open Live Tracking ↗
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Selected event detail panel */}
          {selectedEvent && (
            <div className="absolute bottom-4 left-4 right-4 z-[400] bg-white dark:bg-gray-900 rounded-xl shadow-xl border p-4 max-w-sm">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full mb-1.5">
                    <Siren className="h-3.5 w-3.5" /> SOS Alert
                  </span>
                  <p className="text-sm font-semibold">{fmtDate(selectedEvent.eventTime)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => window.open(`/device/${deviceId}/tracking`, '_blank')}
                  className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-colors font-medium flex-shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Live Tracking
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-muted-foreground mb-0.5">Latitude</p>
                  <p className="font-mono font-medium">{selectedEvent.latitude.toFixed(6)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-muted-foreground mb-0.5">Longitude</p>
                  <p className="font-mono font-medium">{selectedEvent.longitude.toFixed(6)}</p>
                </div>
                {(() => { const m = parseMeta(selectedEvent.metadata); return (
                  <>
                    {m.battery != null && (
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-muted-foreground mb-0.5">Battery</p>
                        <p className={`font-semibold ${batteryColor(m.battery)}`}>
                          {m.battery}%
                        </p>
                      </div>
                    )}
                    {m.network && (
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-muted-foreground mb-0.5">Network</p>
                        <p className="font-semibold flex items-center gap-1">
                          {networkIcon(m.network)} {m.network}
                        </p>
                      </div>
                    )}
                  </>
                ); })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
