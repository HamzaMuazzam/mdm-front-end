import { useState, useRef, useEffect, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Siren, RefreshCw, Loader2, MapPin,
  BatteryMedium, Wifi, WifiOff, ChevronLeft, ChevronRight,
  ExternalLink, Radio, SlidersHorizontal, X, List,
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
  html: `<div style="position:relative;width:34px;height:48px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="48" viewBox="0 0 34 48">
      <path d="M17 0C7.61 0 0 7.61 0 17c0 12.75 17 31 17 31s17-18.25 17-31C34 7.61 26.39 0 17 0z"
            fill="#dc2626" stroke="white" stroke-width="2"/>
      <circle cx="17" cy="16" r="9" fill="white"/>
    </svg>
    <div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:900;color:#dc2626;line-height:1;letter-spacing:-0.5px;">SOS</div>
  </div>`,
  iconSize: [34, 48], iconAnchor: [17, 48], popupAnchor: [0, -50],
});

const SELECTED_PIN = new L.DivIcon({
  className: '',
  html: `<div style="position:relative;width:42px;height:58px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="42" height="58" viewBox="0 0 42 58">
      <path d="M21 0C9.4 0 0 9.4 0 21c0 15.75 21 37 21 37s21-21.25 21-37C42 9.4 32.6 0 21 0z"
            fill="#b91c1c" stroke="white" stroke-width="2.5"/>
      <circle cx="21" cy="20" r="11" fill="white"/>
    </svg>
    <div style="position:absolute;top:10px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:900;color:#b91c1c;line-height:1;letter-spacing:-0.5px;">SOS</div>
  </div>`,
  iconSize: [42, 58], iconAnchor: [21, 58], popupAnchor: [0, -60],
});

// ── Map helpers ───────────────────────────────────────────────────────────────
function FlyTo({ lat, lng, trigger }: { lat: number; lng: number; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.flyTo([lat, lng], 15, { duration: 0.9 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return null;
}

function FitAll({ events }: { events: TrackingEventData[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || events.length === 0) return;
    if (events.length === 1) {
      map.setView([events[0].latitude, events[0].longitude], 14);
    } else {
      map.fitBounds(
        L.latLngBounds(events.map((e) => [e.latitude, e.longitude])),
        { padding: [40, 40] }
      );
    }
    done.current = true;
  }, [events, map]);
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
interface SosMeta { battery?: number; network?: string; ts?: number }
function parseMeta(raw: string | null): SosMeta {
  if (!raw) return {};
  try { return JSON.parse(raw) as SosMeta; } catch { return {}; }
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(iso));
}

function fmtDateShort(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

/** Format a Date as local time for datetime-local input (YYYY-MM-DDTHH:mm) */
function toLocalInputDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NetworkIcon({ network }: { network?: string }) {
  if (!network) return null;
  const n = network.toUpperCase();
  if (n === 'WIFI') return <Wifi    className="h-3.5 w-3.5" />;
  if (n === 'NONE') return <WifiOff className="h-3.5 w-3.5" />;
  return <Radio className="h-3.5 w-3.5" />;
}

function batteryColor(pct?: number) {
  if (pct == null) return 'text-gray-400';
  if (pct <= 20)   return 'text-red-500';
  if (pct <= 50)   return 'text-amber-500';
  return 'text-green-600';
}

const PAGE_SIZE = 10;

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const response = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!response.ok) throw new Error('Geocode failed');
  const json = await response.json();
  return (json.display_name as string) ?? 'Unknown address';
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function DeviceSosPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate     = useNavigate();
  const { data: devices = [] } = useDevicesQuery();
  const device = devices.find((d) => String(d.id) === deviceId);

  // Default: start of today 00:00 → end of today 23:59 in LOCAL time
  const makeDefaults = () => {
    const start = new Date(); start.setHours(0,  0,  0, 0);
    const end   = new Date(); end.setHours(23, 59, 0, 0);
    return { start, end };
  };
  const { start: defaultStart, end: defaultEnd } = makeDefaults();
  const [from, setFrom]           = useState(toLocalInputDate(defaultStart));
  const [to,   setTo]             = useState(toLocalInputDate(defaultEnd));
  const [page, setPage]           = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Mobile list drawer
  const [listOpen, setListOpen] = useState(false);

  // Data state
  const [events,      setEvents]     = useState<TrackingEventData[]>([]);
  const [totalPages,  setTotalPages] = useState(0);
  const [totalItems,  setTotalItems] = useState(0);
  const [loading,     setLoading]    = useState(false);
  const [error,       setError]      = useState<string | null>(null);

  // Selected event
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [flyTrigger, setFlyTrigger] = useState(0);
  const selectedEvent = events.find((e) => e.id === selectedId) ?? null;

  // Address lookup (keyed by event id)
  const [addresses, setAddresses]           = useState<Record<number, string>>({});
  const [addressLoading, setAddressLoading] = useState<Record<number, boolean>>({});
  // Tracks which IDs have been fetched or are in-flight (avoids stale-closure double-fetch)
  const addressFetchedRef = useRef<Set<number>>(new Set());

  // Marker refs — used to programmatically open/close popups
  const markerRefs = useRef<Map<number, L.Marker>>(new Map());

  /** Fetch address for a given event id; no-ops if already fetched/in-progress */
  const fetchAddress = useCallback(async (evId: number, lat: number, lng: number) => {
    if (addressFetchedRef.current.has(evId)) return;
    addressFetchedRef.current.add(evId);
    setAddressLoading((prev) => ({ ...prev, [evId]: true }));
    try {
      const addr = await reverseGeocode(lat, lng);
      setAddresses((prev) => ({ ...prev, [evId]: addr }));
    } catch {
      setAddresses((prev) => ({ ...prev, [evId]: 'Could not fetch address' }));
      addressFetchedRef.current.delete(evId); // allow retry on error
    } finally {
      setAddressLoading((prev) => ({ ...prev, [evId]: false }));
    }
  }, []);

  /** "Show address" button click — stops propagation so the list item isn't re-selected */
  const handleShowAddress = useCallback((
    e: ReactMouseEvent<HTMLButtonElement>,
    evId: number,
    lat: number,
    lng: number,
  ) => {
    e.stopPropagation();
    fetchAddress(evId, lat, lng);
  }, [fetchAddress]);

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
      setError('Failed to load SOS events.');
    } finally {
      setLoading(false);
    }
  }, [device?.deviceUuid, from, to, page]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  /**
   * Select an event:
   *  - fly the map to it
   *  - open its marker popup (close all others)
   *  - auto-fetch address
   *  - close mobile list drawer
   */
  const handleSelect = useCallback((ev: TrackingEventData) => {
    setSelectedId(ev.id);
    setFlyTrigger((t) => t + 1);
    setListOpen(false);

    // Open this marker's popup, close every other
    markerRefs.current.forEach((marker, id) => {
      if (id === ev.id) marker.openPopup();
      else marker.closePopup();
    });

    // Auto-fetch address when an item is selected
    fetchAddress(ev.id, ev.latitude, ev.longitude);
  }, [fetchAddress]);

  const defaultCenter: [number, number] = selectedEvent
    ? [selectedEvent.latitude, selectedEvent.longitude]
    : [24.8607, 67.0011];

  // ── Shared event list content (used in both desktop panel & mobile drawer) ──
  const EventList = (
    <>
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-red-500" />
          <p className="text-sm">Loading SOS events…</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 px-6 text-center">
          <Siren className="h-8 w-8 text-red-300" />
          <p className="text-sm text-red-600">{error}</p>
          <button type="button" onClick={fetchEvents} className="text-xs text-blue-600 underline mt-1">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 gap-3 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <Siren className="h-7 w-7 text-red-300" />
          </div>
          <p className="font-medium text-sm">No SOS Events</p>
          <p className="text-xs text-muted-foreground">No SOS events in the selected time range.</p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          {events.map((ev, idx) => {
            const meta       = parseMeta(ev.metadata);
            const isSelected = selectedId === ev.id;
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => handleSelect(ev)}
                className={`w-full text-left px-4 py-3.5 border-b border-gray-100 transition-all duration-150 ${
                  isSelected
                    ? 'bg-red-50 border-l-[3px] border-l-red-600 pl-[13px]'
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* Row 1: badge + date + index */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    isSelected ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    <Siren className="h-2.5 w-2.5" /> SOS
                  </span>
                  <span className={`text-sm font-semibold flex-1 min-w-0 truncate ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                    {fmtDateShort(ev.eventTime)}
                  </span>
                  <span className={`text-[11px] flex-shrink-0 ${isSelected ? 'text-gray-600' : 'text-gray-500'}`}>
                    #{(page * PAGE_SIZE) + idx + 1}
                  </span>
                </div>

                {/* Row 2: coordinates + address */}
                <div className="flex items-start gap-1.5 mb-2">
                  <MapPin className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${isSelected ? 'text-red-600' : 'text-red-500'}`} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-mono ${isSelected ? 'text-gray-600' : 'text-gray-500'}`}>
                      {ev.latitude.toFixed(5)}, {ev.longitude.toFixed(5)}
                    </span>
                    {addresses[ev.id] ? (
                      <p className={`text-[11px] mt-0.5 leading-tight break-words ${isSelected ? 'text-gray-600' : 'text-gray-500'}`}>
                        {addresses[ev.id]}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleShowAddress(e, ev.id, ev.latitude, ev.longitude)}
                        disabled={addressLoading[ev.id]}
                        className={`mt-0.5 inline-flex items-center gap-1 text-[11px] disabled:opacity-60 transition-colors ${
                          isSelected ? 'text-blue-600 hover:text-blue-700' : 'text-blue-600 hover:text-blue-700'
                        }`}
                      >
                        {addressLoading[ev.id]
                          ? <><Loader2 className="h-2.5 w-2.5 animate-spin" />Fetching…</>
                          : <><MapPin className="h-2.5 w-2.5" />Show address</>
                        }
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 3: battery + network badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {meta.battery != null && (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      isSelected ? `bg-gray-100 ${batteryColor(meta.battery)}` : `bg-gray-100 ${batteryColor(meta.battery)}`
                    }`}>
                      <BatteryMedium className="h-3 w-3" />{meta.battery}%
                    </span>
                  )}
                  {meta.network && (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <NetworkIcon network={meta.network} />{meta.network}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 flex-shrink-0">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-gray-300 font-medium hover:bg-muted active:bg-muted/80 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <span className="text-xs text-muted-foreground font-medium">{page + 1} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-gray-300 font-medium hover:bg-muted active:bg-muted/80 disabled:opacity-40 transition-colors"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col bg-background" style={{ height: '100dvh' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200 bg-white shadow-sm flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-1 rounded-md hover:bg-muted transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="p-2 bg-red-50 rounded-md flex-shrink-0">
          <Siren className="h-4 w-4 text-red-600" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-sm sm:text-base leading-tight text-gray-900">SOS History</h1>
          <p className="text-xs text-muted-foreground truncate">
            {device ? (device.deviceName || device.model) : `Device #${deviceId}`}
          </p>
        </div>

        {!loading && totalItems > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-1 font-medium flex-shrink-0">
            <Siren className="h-3 w-3" />{totalItems}
          </span>
        )}

        {/* Filter toggle */}
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`p-2 rounded-md transition-colors ${filtersOpen ? 'bg-red-50 text-red-600' : 'hover:bg-muted'}`}
          aria-label="Toggle filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={fetchEvents}
          disabled={loading}
          className="p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-40"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Filter bar (collapsible) ────────────────────────────────────────── */}
      <div className={`border-b bg-muted/30 flex-shrink-0 overflow-hidden transition-all duration-200 ${filtersOpen ? 'max-h-40' : 'max-h-0'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 px-4 py-3">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-muted-foreground font-medium whitespace-nowrap w-8">From</label>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(0); }}
              className="flex-1 text-xs border border-gray-300 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-muted-foreground font-medium whitespace-nowrap w-8">To</label>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(0); }}
              className="flex-1 text-xs border border-gray-300 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="sm:hidden self-end flex items-center gap-1 text-xs text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" /> Close
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* ═══════════════════════════════════════════════════════════════════
            DESKTOP (md+): side-by-side — list left, map right
            MOBILE       : map fills everything; list is a floating drawer
        ═══════════════════════════════════════════════════════════════════ */}

        {/* ── Desktop list panel ─────────────────────────────────────────── */}
        <div className="hidden md:flex md:w-[360px] xl:w-[400px] flex-col border-r border-gray-200 bg-white flex-shrink-0 min-h-0">
          <div className="px-4 py-2 border-b bg-muted/40 flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              SOS Events {totalItems > 0 && `(${totalItems})`}
            </p>
          </div>
          <div className="flex flex-col flex-1 min-h-0">
            {EventList}
          </div>
        </div>

        {/* ── Map (full area on mobile, flex-1 on desktop) ───────────────── */}
        <div className="flex-1 relative h-full">

          {/* Empty state overlay */}
          {!loading && events.length === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-muted/30 gap-2 pointer-events-none">
              <MapPin className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No SOS locations to display</p>
            </div>
          )}

          <MapContainer
            center={defaultCenter}
            zoom={selectedEvent ? 14 : 5}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {events.length > 0 && <FitAll events={events} />}
            {selectedEvent && (
              <FlyTo lat={selectedEvent.latitude} lng={selectedEvent.longitude} trigger={flyTrigger} />
            )}
            {events.map((ev) => {
              const meta       = parseMeta(ev.metadata);
              const isSelected = selectedId === ev.id;
              return (
                <Marker
                  key={ev.id}
                  position={[ev.latitude, ev.longitude]}
                  icon={isSelected ? SELECTED_PIN : SOS_PIN}
                  ref={(marker) => {
                    if (marker) markerRefs.current.set(ev.id, marker);
                    else markerRefs.current.delete(ev.id);
                  }}
                  eventHandlers={{ click: () => handleSelect(ev) }}
                >
                  <Popup minWidth={220} maxWidth={260}>
                    <div style={{ fontFamily: 'inherit' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: '#dc2626', color: 'white',
                        fontSize: 11, fontWeight: 700, padding: '3px 8px',
                        borderRadius: 999, marginBottom: 8,
                      }}>🆘 SOS Alert</div>
                      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                        {fmtDate(ev.eventTime)}
                      </p>
                      <p style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginBottom: 4 }}>
                        {ev.latitude.toFixed(6)}, {ev.longitude.toFixed(6)}
                      </p>
                      {/* Address row in popup */}
                      {addressLoading[ev.id] && (
                        <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #dc2626', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                          Fetching address…
                        </p>
                      )}
                      {addresses[ev.id] && (
                        <p style={{ fontSize: 10, color: '#475569', marginBottom: 6, lineHeight: 1.4 }}>
                          📍 {addresses[ev.id]}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#475569', marginBottom: 10 }}>
                        {meta.battery != null && <span>🔋 {meta.battery}%</span>}
                        {meta.network  && <span>📶 {meta.network}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => window.open(`/device/${deviceId}/tracking`, '_blank')}
                        style={{
                          width: '100%', fontSize: 12, fontWeight: 500,
                          background: '#dc2626', color: 'white', border: 'none',
                          borderRadius: 6, padding: '6px 0', cursor: 'pointer',
                        }}
                      >Open Live Tracking ↗</button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* ── Mobile: "View List" floating button (top-left of map) ─── */}
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="md:hidden absolute top-3 left-3 z-[400] flex items-center gap-2 bg-white shadow-lg border border-gray-200 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted active:scale-95 transition-all"
          >
            <List className="h-4 w-4 text-red-600" />
            <span>SOS List</span>
            {totalItems > 0 && (
              <span className="bg-red-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {totalItems}
              </span>
            )}
          </button>

          {/* ── Selected event detail card (bottom of map) ───────────── */}
          {selectedEvent && (() => {
            const meta = parseMeta(selectedEvent.metadata);
            return (
              <div className="absolute bottom-3 left-3 right-3 z-[400] bg-white rounded-lg shadow-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    <Siren className="h-3 w-3" /> SOS
                  </span>
                  <span className="text-xs text-muted-foreground font-medium flex-1 truncate text-center">
                    {fmtDateShort(selectedEvent.eventTime)}
                  </span>
                  <button
                    type="button"
                    onClick={() => window.open(`/device/${deviceId}/tracking`, '_blank')}
                    className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-3 py-1.5 rounded-lg transition-colors font-medium flex-shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Tracking
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                  <div className="bg-gray-50 rounded-md px-2 py-1.5">
                    <p className="text-muted-foreground text-[10px] mb-0.5">Latitude</p>
                    <p className="font-mono font-medium">{selectedEvent.latitude.toFixed(5)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md px-2 py-1.5">
                    <p className="text-muted-foreground text-[10px] mb-0.5">Longitude</p>
                    <p className="font-mono font-medium">{selectedEvent.longitude.toFixed(5)}</p>
                  </div>
                  {meta.battery != null && (
                    <div className="bg-gray-50 rounded-md px-2 py-1.5">
                      <p className="text-muted-foreground text-[10px] mb-0.5">Battery</p>
                      <p className={`font-semibold flex items-center gap-1 ${batteryColor(meta.battery)}`}>
                        <BatteryMedium className="h-3 w-3" />{meta.battery}%
                      </p>
                    </div>
                  )}
                  {meta.network && (
                    <div className="bg-gray-50 rounded-md px-2 py-1.5">
                      <p className="text-muted-foreground text-[10px] mb-0.5">Network</p>
                      <p className="font-semibold flex items-center gap-1">
                        <NetworkIcon network={meta.network} />{meta.network}
                      </p>
                    </div>
                  )}
                </div>
                {/* Address in bottom card */}
                {(addresses[selectedEvent.id] || addressLoading[selectedEvent.id]) && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    {addressLoading[selectedEvent.id] ? (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" /> Fetching address…
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        <MapPin className="h-3 w-3 inline mr-1 text-red-500" />
                        {addresses[selectedEvent.id]}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* ── Mobile list drawer (overlay) ───────────────────────────────── */}
        {listOpen && (
          <div className="md:hidden absolute inset-0 z-[500] flex flex-col bg-white">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-white flex-shrink-0">
              <div className="flex items-center gap-2">
                <Siren className="h-4 w-4 text-red-600" />
                <span className="font-semibold text-sm">SOS Events</span>
                {totalItems > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {totalItems}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setListOpen(false)}
                className="p-2 rounded-md hover:bg-muted transition-colors"
                aria-label="Close list"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Scrollable list content */}
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {EventList}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
