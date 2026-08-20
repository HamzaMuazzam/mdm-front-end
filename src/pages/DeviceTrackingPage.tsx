import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import mqtt, { MqttClient } from 'mqtt';
import {
  ArrowLeft, MapPin, RefreshCw, Loader2, Download,
  ChevronLeft, ChevronRight, Shield, Sheet, LayoutPanelTop,
  Plus, Pencil, Trash2, X, Check, Upload, Undo2, MousePointer2,
  Maximize2, Minimize2, Activity,
  Settings, Timer, Gauge, SatelliteDish, Link2, SlidersHorizontal,
  Play, Pause, SkipBack, AlertTriangle, Route,
} from 'lucide-react';
import { MQTT_BROKER_URL, WS } from '@/utils/constants';
import {
  MapContainer, TileLayer, Marker, Popup,
  Polyline, CircleMarker, Circle as LeafletCircle, Polygon, useMap, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as XLSX from 'xlsx';
import { useDevicesQuery } from '@/hooks/useDevices';
import { BulkHeartbeatModal } from '@/components/features/devices/BulkHeartbeatModal';
import {
  trackingService,
  type GeoType,
  type GeofenceTypeEnum,
  type HistoryPoint,
  type GeofenceData,
  type GeofenceRequest,
  type GeofenceEventData,
  type TrackingConfigResponse,
  type TrackingConfigRequest,
  type Trip,
  type TrackingEventData,
  type AnalyticsData,
} from '@/api/services/tracking.service';

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makePin(color: string) {
  return new L.DivIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>`,
    iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -36],
  });
}
const startPin = makePin('#16a34a');
const endPin   = makePin('#dc2626');

function getPointColor(reason: string): string {
  const r = (reason ?? '').toLowerCase().trim();
  if (r.includes('moving') || r.includes('drive') || r.includes('motion') || r.includes('start') || r.includes('trip')) return '#16a34a';
  if (r.includes('idle') || r.includes('stop') || r.includes('park') || r.includes('stationary') || r.includes('halt')) return '#dc2626';
  return '#2563eb';
}

// ── Speed-colored route helpers ───────────────────────────────────────────────
/** Maps speed (km/h) → line color, matching Traccar-style gradient */
function speedColor(kmh: number): string {
  if (kmh <= 0)   return '#9ca3af'; // stopped    – gray
  if (kmh < 10)   return '#16a34a'; // very slow  – green
  if (kmh < 30)   return '#65a30d'; // slow       – lime
  if (kmh < 60)   return '#ca8a04'; // moderate   – yellow
  if (kmh < 90)   return '#d97706'; // fast       – amber
  if (kmh < 120)  return '#dc2626'; // very fast  – red
  return '#b91c1c';                  // over-speed – dark red
}

interface RouteSeg { pts: [number, number][]; color: string; }

type HistorySortDirection = 'asc' | 'desc';
type HistorySortField =
  | 'id'
  | 'localPrimaryId'
  | 'receivedAt'
  | 'deviceRdt'
  | 'gpsRdt'
  | 'latitude'
  | 'longitude'
  | 'speed'
  | 'accuracy'
  | 'altitude'
  | 'bearing'
  | 'satellites'
  | 'provider'
  | 'versionNo'
  | 'uploadRetryCount'
  | 'igStatus'
  | 'reason';

interface HistoryTableColumn {
  label: string;
  sortField?: HistorySortField;
  className?: string;
}

/** Group consecutive same-color points into segments — greatly reduces Leaflet objects */
function buildRouteSegments(pts: { latitude: number; longitude: number; speed: number }[]): RouteSeg[] {
  if (pts.length < 2) return [];
  const segs: RouteSeg[] = [];
  let seg: RouteSeg = {
    pts: [[pts[0].latitude, pts[0].longitude]],
    color: speedColor(pts[0].speed ?? 0),
  };
  for (let i = 1; i < pts.length; i++) {
    const c = speedColor(pts[i].speed ?? 0);
    seg.pts.push([pts[i].latitude, pts[i].longitude]);
    if (c !== seg.color) {
      segs.push(seg);
      seg = { pts: [[pts[i].latitude, pts[i].longitude]], color: c };
    }
  }
  if (seg.pts.length >= 2) segs.push(seg);
  return segs;
}

/** Small direction arrow rotated to bearing */
function bearingIcon(bearing: number, color: string): L.DivIcon {
  return new L.DivIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 14 14"
                style="transform:rotate(${bearing ?? 0}deg);display:block">
             <polygon points="7,1 11,13 7,10 3,13"
                      fill="${color}" stroke="${color}" stroke-width="1.2"/>
           </svg>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function parsePolygonPoints(raw: string | null): [number, number][] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((p: unknown) => {
        if (Array.isArray(p)) return [p[0] as number, p[1] as number];
        const o = p as Record<string, number>;
        return [(o.lat ?? o.latitude) as number, (o.lng ?? o.longitude) as number];
      });
    }
  } catch { /* ignore */ }
  return [];
}

function formatDateTimeWithMillis(value: string | null | undefined): string {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const pad = (num: number, size = 2) => String(num).padStart(size, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function normalizeReason(reason: string | null | undefined): string {
  const normalized = reason?.trim();
  return normalized ? normalized : 'Unspecified';
}

function getHistorySortValue(point: HistoryPoint, field: HistorySortField): string | number | null {
  switch (field) {
    case 'id':
      return point.id > 0 ? point.id : null;
    case 'localPrimaryId':
      return point.localPrimaryId ?? null;
    case 'receivedAt': {
      const time = point.receivedAt ? new Date(point.receivedAt).getTime() : NaN;
      return Number.isNaN(time) ? null : time;
    }
    case 'deviceRdt':
      return point.deviceRdt?.trim() || null;
    case 'gpsRdt':
      return point.gpsRdt?.trim() || null;
    case 'latitude':
      return point.latitude ?? null;
    case 'longitude':
      return point.longitude ?? null;
    case 'speed':
      return point.speed ?? null;
    case 'accuracy':
      return point.accuracy ?? null;
    case 'altitude':
      return point.altitude ?? null;
    case 'bearing':
      return point.bearing ?? null;
    case 'satellites':
      return point.connectedSatellite ?? point.availableSatellite ?? null;
    case 'provider':
      return point.provider?.trim() || null;
    case 'versionNo':
      return point.versionNo?.trim() || null;
    case 'uploadRetryCount':
      return point.uploadRetryCount ?? null;
    case 'igStatus':
      return point.igStatus ?? null;
    case 'reason':
      return normalizeReason(point.reason);
    default:
      return null;
  }
}

function compareHistoryValues(
  left: string | number | null,
  right: string | number | null,
  direction: HistorySortDirection
): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  if (typeof left === 'number' && typeof right === 'number') {
    return direction === 'asc' ? left - right : right - left;
  }

  const leftText = String(left);
  const rightText = String(right);
  return direction === 'asc'
    ? leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: 'base' })
    : rightText.localeCompare(leftText, undefined, { numeric: true, sensitivity: 'base' });
}

const HISTORY_TABLE_COLUMNS: HistoryTableColumn[] = [
  { label: '#' },
  { label: 'ID', sortField: 'id' },
  { label: 'Local Primary ID', sortField: 'localPrimaryId' },
  { label: 'Received At', sortField: 'receivedAt' },
  { label: 'Device RDT', sortField: 'deviceRdt' },
  { label: 'GPS RDT', sortField: 'gpsRdt' },
  { label: 'Lat', sortField: 'latitude' },
  { label: 'Lng', sortField: 'longitude' },
  { label: 'Speed', sortField: 'speed' },
  { label: 'Accuracy', sortField: 'accuracy' },
  { label: 'Alt', sortField: 'altitude' },
  { label: 'Bearing', sortField: 'bearing' },
  { label: 'Satellites', sortField: 'satellites' },
  { label: 'Provider', sortField: 'provider' },
  { label: 'Version', sortField: 'versionNo' },
  { label: 'Upload Retry', sortField: 'uploadRetryCount' },
  { label: 'IG', sortField: 'igStatus' },
  { label: 'Reason', sortField: 'reason', className: 'min-w-[180px]' },
];

function todayStart(): string { const d = new Date(); d.setHours(0,0,0,0); return fmt(d); }
function todayEnd():   string { const d = new Date(); d.setHours(23,59,59,0); return fmt(d); }
function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function metersBetween(a: [number, number], b: [number, number]): number {
  return L.latLng(a[0], a[1]).distanceTo(L.latLng(b[0], b[1]));
}

// ── Draw phase state machine ──────────────────────────────────────────────────
// idle → type-select → circle-center → circle-radius → confirm
//                    → polygon                        → confirm
//                    → line                           → confirm
type DrawPhase = 'idle' | 'type-select' | 'circle-center' | 'circle-radius' | 'polygon' | 'line' | 'confirm';
interface DrawState {
  phase: DrawPhase;
  type: GeoType;
  circleCenter: [number, number] | null;
  circleRadius: number | null;
  polygonPts: [number, number][];   // used for both POLYGON and LINE
  mousePos: [number, number] | null;
  name: string;
  editId: number | null;
  bufferMeters: number;
}
const BLANK_DRAW: DrawState = {
  phase: 'idle', type: 'CIRCLE', circleCenter: null, circleRadius: null,
  polygonPts: [], mousePos: null, name: '', editId: null, bufferMeters: 0,
};

// Colors per geofence type
const GEO_COLOR: Record<GeoType, string> = {
  CIRCLE:  '#2563eb',   // blue
  POLYGON: '#1d4ed8',   // dark blue
  LINE:    '#3b82f6',   // light blue
};

const BLANK_CONFIG: TrackingConfigRequest = {
  configurationTimer: undefined,
  uploadTimer: undefined,
  movingTimer: undefined,
  stopTimer: undefined,
  heartbeatTimer: undefined,
  angleThreshold: undefined,
  overSpeedingThreshold: undefined,
  distanceThreshold: undefined,
  retryCounter: undefined,
  setMinUpdateIntervalMillis: undefined,
  setMinUpdateDistanceMeters: undefined,
  baseURL: undefined,
};

type TrackingConfigFieldKey = keyof TrackingConfigRequest;

interface TrackingConfigFieldDefinition {
  key: TrackingConfigFieldKey;
  label: string;
  description: string;
  unit?: string;
  step?: number;
  min?: number;
  inputType?: 'number' | 'text';
  placeholder?: string;
  cardSpanClassName?: string;
}

interface TrackingConfigSectionDefinition {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  surfaceClassName: string;
  badgeClassName: string;
  iconClassName: string;
  gridClassName: string;
  fields: TrackingConfigFieldDefinition[];
}

const TRACKING_CONFIG_SECTIONS: TrackingConfigSectionDefinition[] = [
  {
    id: 'timers',
    title: 'Timing Logs',
    eyebrow: 'Device rhythm',
    description: 'How often the tracker wakes up, samples data, uploads, and keeps the session alive.',
    icon: Timer,
    surfaceClassName: 'border-gray-200 bg-white',
    badgeClassName: 'border-gray-200 bg-gray-50 text-gray-600',
    iconClassName: 'bg-blue-50 text-blue-700',
    gridClassName: 'md:grid-cols-2 xl:grid-cols-3',
    fields: [
      { key: 'configurationTimer', label: 'Configuration Timer', description: 'How often the device refreshes its config from the platform.', unit: 's', step: 1, min: 0 },
      { key: 'uploadTimer', label: 'Upload Timer', description: 'The Logs used to push live tracking points upstream.', unit: 's', step: 1, min: 0 },
      { key: 'movingTimer', label: 'Moving Timer', description: 'Delay before movement is treated as an active trip.', unit: 's', step: 1, min: 0 },
      { key: 'stopTimer', label: 'Stop Timer', description: 'How long the device waits before it marks the vehicle as stopped.', unit: 's', step: 1, min: 0 },
      { key: 'heartbeatTimer', label: 'Heartbeat Timer', description: 'Keep-alive interval used to confirm the tracker is online.', unit: 's', step: 1, min: 0 },
    ],
  },
  {
    id: 'thresholds',
    title: 'Motion Intelligence',
    eyebrow: 'Decision thresholds',
    description: 'Sensitivity settings that control direction changes, alerts, distance sampling, and retry behavior.',
    icon: Gauge,
    surfaceClassName: 'border-gray-200 bg-white',
    badgeClassName: 'border-gray-200 bg-gray-50 text-gray-600',
    iconClassName: 'bg-blue-50 text-blue-700',
    gridClassName: 'md:grid-cols-2 xl:grid-cols-4',
    fields: [
      { key: 'angleThreshold', label: 'Angle Threshold', description: 'Minimum turn angle required before a new point is considered meaningful.', unit: 'deg', step: 0.5, min: 0 },
      { key: 'overSpeedingThreshold', label: 'Over-Speed Threshold', description: 'Speed limit that triggers over-speeding behavior or flags.', unit: 'km/h', step: 1, min: 0 },
      { key: 'distanceThreshold', label: 'Distance Threshold', description: 'Minimum movement before a new point is worth recording.', unit: 'm', step: 1, min: 0 },
      { key: 'retryCounter', label: 'Retry Counter', description: 'How many times failed uploads should be retried before giving up.', step: 1, min: 0 },
    ],
  },
  {
    id: 'connection',
    title: 'GPS & Delivery',
    eyebrow: 'Acquisition and routing',
    description: 'Control minimum GPS update density and the server endpoint the device should target.',
    icon: SatelliteDish,
    surfaceClassName: 'border-gray-200 bg-white',
    badgeClassName: 'border-gray-200 bg-gray-50 text-gray-600',
    iconClassName: 'bg-blue-50 text-blue-700',
    gridClassName: 'md:grid-cols-2',
    fields: [
      { key: 'setMinUpdateIntervalMillis', label: 'Min GPS Update Interval', description: 'Minimum time between two GPS fixes coming from the device.', unit: 'ms', step: 1, min: 0 },
      { key: 'setMinUpdateDistanceMeters', label: 'Min GPS Update Distance', description: 'Minimum movement required before a fresh GPS fix is emitted.', unit: 'm', step: 0.5, min: 0 },
      {
        key: 'baseURL',
        label: 'Server Base URL',
        description: 'Optional endpoint override that gets pushed down to the tracker.',
        inputType: 'text',
        placeholder: 'https://tracking.example.com',
        cardSpanClassName: 'md:col-span-2',
      },
    ],
  },
];

const TRACKING_CONFIG_FIELD_COUNT = TRACKING_CONFIG_SECTIONS.reduce(
  (count, section) => count + section.fields.length,
  0
);

function buildTrackingConfigDraft(config?: TrackingConfigResponse | null): TrackingConfigRequest {
  if (!config) return { ...BLANK_CONFIG };

  return {
    configurationTimer: config.configurationTimer ?? undefined,
    uploadTimer: config.uploadTimer ?? undefined,
    movingTimer: config.movingTimer ?? undefined,
    stopTimer: config.stopTimer ?? undefined,
    heartbeatTimer: config.heartbeatTimer ?? undefined,
    angleThreshold: config.angleThreshold ?? undefined,
    overSpeedingThreshold: config.overSpeedingThreshold ?? undefined,
    distanceThreshold: config.distanceThreshold ?? undefined,
    retryCounter: config.retryCounter ?? undefined,
    setMinUpdateIntervalMillis: config.setMinUpdateIntervalMillis ?? undefined,
    setMinUpdateDistanceMeters: config.setMinUpdateDistanceMeters ?? undefined,
    baseURL: config.baseURL ?? '',
  };
}

function getTrackingConfigValue(
  source: TrackingConfigRequest | TrackingConfigResponse | null,
  key: TrackingConfigFieldKey
): string | number | undefined {
  return source ? (source[key] as string | number | undefined) : undefined;
}

function getTrackingEndpointLabel(value: string | number | undefined): string {
  const url = typeof value === 'string' ? value.trim() : '';
  if (!url) return 'Default endpoint';

  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
}

// ── Center map imperatively ───────────────────────────────────────────────────
function CenterOnLocation({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const prev = useRef<string>('');
  useEffect(() => {
    if (!target) return;
    const key = target.join(',');
    if (key === prev.current) return;
    prev.current = key;
    map.setView(target, Math.max(map.getZoom(), 15), { animate: true });
  }, [target, map]);
  return null;
}


// ── FitBounds helper ──────────────────────────────────────────────────────────
// Only fits when `trigger` changes (incremented by history fetch), NOT on every
// position change — so live MQTT points never move or zoom the map.
function FitBounds({ positions, trigger }: { positions: [number, number][]; trigger: number }) {
  const map = useMap();
  const prevTrigger = useRef(-1);
  useEffect(() => {
    if (!positions.length || trigger === prevTrigger.current) return;
    prevTrigger.current = trigger;
    map.fitBounds(L.latLngBounds(positions), { padding: [30, 30] });
  }, [trigger, positions, map]);
  return null;
}

function InvalidateMapSize({ layoutKey }: { layoutKey: string }) {
  const map = useMap();

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => window.cancelAnimationFrame(raf);
  }, [layoutKey, map]);

  return null;
}

// ── Nearest-point hover — single shared popup, no per-point DOM ──────────────
function PointHoverHandler({
  points,
  onHover,
}: {
  points: HistoryPoint[];
  onHover: (p: HistoryPoint | null) => void;
}) {
  const map = useMapEvents({
    mousemove(e) {
      if (!points.length) return;
      const THRESH_SQ = 18 * 18;
      let best: HistoryPoint | null = null;
      let bestD = Infinity;
      for (const p of points) {
        const cp = map.latLngToContainerPoint([p.latitude, p.longitude]);
        const d = (cp.x - e.containerPoint.x) ** 2 + (cp.y - e.containerPoint.y) ** 2;
        if (d < THRESH_SQ && d < bestD) { bestD = d; best = p; }
      }
      onHover(best);
    },
    mouseout() { onHover(null); },
  });
  useEffect(() => { return () => { onHover(null); }; }, [onHover]);
  // suppress unused var warning
  void map;
  return null;
}

// ── Map interaction handler (clicks + mouse-move for drawing) ─────────────────
function MapInteractionHandler({
  draw, onMapClick, onMouseMove,
}: {
  draw: DrawState;
  onMapClick: (lat: number, lng: number) => void;
  onMouseMove: (lat: number, lng: number) => void;
}) {
  const active = !['idle', 'type-select', 'confirm'].includes(draw.phase);
  const map = useMapEvents({
    click(e) { if (active) onMapClick(e.latlng.lat, e.latlng.lng); },
    mousemove(e) { if (active) onMouseMove(e.latlng.lat, e.latlng.lng); },
  });

  useEffect(() => {
    map.getContainer().style.cursor = active ? 'crosshair' : '';
    return () => { map.getContainer().style.cursor = ''; };
  }, [active, map]);

  return null;
}

// ── Pinned marker (navigate-to from panel items) ─────────────────────────────
interface PinnedMarkerInfo {
  lat: number;
  lng: number;
  title: string;
  detail: string;
  color: string;
}

function PinnedMarkerLayer({ info }: { info: PinnedMarkerInfo }) {
  const markerRef = useRef<L.Marker>(null);
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.openPopup();
    }
  }, [info.lat, info.lng, info.title]);

  const icon = new L.DivIcon({
    className: '',
    html: `<div style="position:relative;width:36px;height:36px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:${info.color};opacity:0.25;"></div>
      <div style="position:absolute;inset:6px;border-radius:50%;background:${info.color};border:2.5px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);"></div>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });

  return (
    <Marker ref={markerRef} position={[info.lat, info.lng]} icon={icon} zIndexOffset={3000}>
      <Popup autoPan closeButton>
        <div style={{ minWidth: 170, padding: '2px 0' }}>
          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 3, color: info.color }}>{info.title}</p>
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 4, lineHeight: 1.4 }}>{info.detail}</p>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#94a3b8' }}>{info.lat.toFixed(6)}, {info.lng.toFixed(6)}</p>
        </div>
      </Popup>
    </Marker>
  );
}

/** Compute a representative [lat, lng] for any geofence shape */
function geofenceCenter(g: { type: string; centerLat: number | null; centerLng: number | null; polygonPoints: string | null }): [number, number] | null {
  if (g.type === 'CIRCLE' && g.centerLat != null && g.centerLng != null) {
    return [g.centerLat, g.centerLng];
  }
  const pts = parsePolygonPoints(g.polygonPoints);
  if (pts.length === 0) return null;
  // centroid for polygon, first point for line
  const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [lat, lng];
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function DeviceTrackingPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate    = useNavigate();
  const { data: devices } = useDevicesQuery();
  const device      = devices?.find((d) => String(d.id) === deviceId);
  const [isHeartbeatApplyMoreOpen, setIsHeartbeatApplyMoreOpen] = useState(false);
  const deviceUuid  = device?.deviceUuid;

  const [rightOpen]   = useState(false);
  const [tableOpen, setTableOpen]   = useState(true);
  const [activePanel, setActivePanel] = useState<'history' | 'geofences' | 'events' | 'trips' | 'alerts' | null>(null);
  const [leftMode, setLeftMode]     = useState<'split' | 'map' | 'table'>('map');

  // History
  const [fromDt, setFromDt]       = useState(todayStart);
  const [toDt, setToDt]           = useState(todayEnd);
  const [page, setPage]           = useState(0);
  const [pageSize]                = useState(2000);
  const [historySortField, setHistorySortField] = useState<HistorySortField>('localPrimaryId');
  const [historySortDirection, setHistorySortDirection] = useState<HistorySortDirection>('desc');
  const [totalPages, setTotalPages]       = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [points, setPoints]       = useState<HistoryPoint[]>([]);
  const [loading, setLoading]     = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Geofence types (fetched from API)
  const [geoTypes, setGeoTypes] = useState<GeofenceTypeEnum[]>([]);

  // Geofences
  const [geofences, setGeofences]       = useState<GeofenceData[]>([]);
  const [geoLoading, setGeoLoading]     = useState(false);
  const [geoDeleting, setGeoDeleting]   = useState<number | null>(null);
  const [geoSaving, setGeoSaving]       = useState(false);
  const [showGeoOnMap, setShowGeoOnMap] = useState(true);
  const [geoPage, setGeoPage]           = useState(0);
  const [geoTotalPages, setGeoTotalPages] = useState(0);
  const [geoTotal, setGeoTotal]         = useState(0);

  // Geofence events
  const [geoEvents, setGeoEvents]           = useState<GeofenceEventData[]>([]);
  const [geoEventsLoading, setGeoEventsLoading] = useState(false);
  const [geoEventsTotal, setGeoEventsTotal] = useState(0);
  const [geoEventsPage, setGeoEventsPage]   = useState(0);
  const [geoEventsTotalPages, setGeoEventsTotalPages] = useState(0);

  // Hovered GPS point (for shared popup)
  const [hoverPoint, setHoverPoint] = useState<HistoryPoint | null>(null);

  // Drawing state
  const [draw, setDraw] = useState<DrawState>(BLANK_DRAW);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  // Controls when FitBounds runs — only incremented on history fetch, never on MQTT
  const [fitBoundsKey, setFitBoundsKey]       = useState(0);

  // Live tracking via MQTT
  const [centerTarget, setCenterTarget]       = useState<[number, number] | null>(null);

  // Pinned marker (navigate-to from panel items)
  const [pinnedMarker, setPinnedMarker] = useState<PinnedMarkerInfo | null>(null);
  const trackingClientRef                     = useRef<MqttClient | null>(null);

  // Bulk upload
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadJson, setUploadJson]   = useState('');
  const [uploading, setUploading]     = useState(false);
  const [uploadMsg, setUploadMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  // Mobile bottom nav — unified with activePanel (null = map view)

  // Tracking config modal
  const [configModal, setConfigModal]     = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving]   = useState(false);
  const [configData, setConfigData]       = useState<TrackingConfigResponse | null>(null);
  const [configEditing, setConfigEditing] = useState(false);
  const [configForm, setConfigForm] = useState<TrackingConfigRequest>({ ...BLANK_CONFIG });

  // ── Route Playback (Module 3) ──────────────────────────────────────────────
  const [playbackActive, setPlaybackActive] = useState(false);
  const [playbackIdx, setPlaybackIdx]       = useState(0);
  const [playbackSpeed, setPlaybackSpeed]   = useState(1); // 1x, 2x, 5x
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialHistoryDeviceRef = useRef<string | null>(null);
  const playbackPointSourceIdx = points.length > 0 ? points.length - 1 - playbackIdx : -1;
  const playbackPoint = playbackActive && playbackPointSourceIdx >= 0 ? points[playbackPointSourceIdx] : null;

  // ── Trips (Module 1) ──────────────────────────────────────────────────────
  const [trips, setTrips]               = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsTotal, setTripsTotal]     = useState(0);
  const [_tripsPage, setTripsPage]      = useState(0);
  const [_tripsTotalPages, setTripsTotalPages] = useState(0);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  // ── Tracking Events (Module 2) ────────────────────────────────────────────
  const [trackEvents, setTrackEvents]           = useState<TrackingEventData[]>([]);
  const [trackEventsLoading, setTrackEventsLoading] = useState(false);
  const [trackEventsTotal, setTrackEventsTotal] = useState(0);

  // ── Analytics (Module 9) ──────────────────────────────────────────────────
  const [_analytics, setAnalytics]             = useState<AnalyticsData | null>(null);
  const [_analyticsLoading, setAnalyticsLoading] = useState(false);

  const polyline: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
  const mapCenter: [number, number]  = polyline.length > 0
    ? polyline[Math.floor(polyline.length / 2)] : [33.6844, 73.0479];

  // Speed-colored segments (replaces the heavy per-point CircleMarker approach)
  const routeSegments = useMemo(() => buildRouteSegments(points), [points]);

  const sortedHistoryPoints = useMemo(() => {
    return points
      .map((point, index) => ({ point, index }))
      .sort((left, right) => {
        const result = compareHistoryValues(
          getHistorySortValue(left.point, historySortField),
          getHistorySortValue(right.point, historySortField),
          historySortDirection
        );
        return result !== 0 ? result : left.index - right.index;
      })
      .map(({ point }) => point);
  }, [historySortDirection, historySortField, points]);

  const historySpeedStats = useMemo(() => {
    const speeds = points
      .map((point) => point.speed)
      .filter((speed): speed is number => typeof speed === 'number' && Number.isFinite(speed));

    if (speeds.length === 0) {
      return { min: null, avg: null, max: null, count: 0 };
    }

    const min = Math.min(...speeds);
    const max = Math.max(...speeds);
    const avg = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    return { min, avg, max, count: speeds.length };
  }, [points]);

  const historyReasonStats = useMemo(() => {
    const reasonCounts = new Map<string, number>();

    points.forEach((point) => {
      const reason = normalizeReason(point.reason);
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    });

    return Array.from(reasonCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [points]);

  const effectiveTotalPages = useMemo(() => {
    if (totalPages > 0) return totalPages;
    if (totalElements > 0) return Math.max(1, Math.ceil(totalElements / pageSize));
    return hasLoaded ? 1 : 0;
  }, [hasLoaded, pageSize, totalElements, totalPages]);

  // Direction arrows — evenly sampled across all loaded points.
  // Keys are lat/lng-based (not index) so prepending live MQTT points never causes
  // React to remount/reposition existing arrows.
  const arrowPoints = useMemo(() => {
    if (points.length < 2) return [];
    const step = Math.max(1, Math.floor(points.length / 60));
    return points.filter((_, i) => i > 0 && i % step === 0 && i < points.length - 1);
  }, [points]);
  const configPreviewSource = configEditing ? configForm : configData;
  const configHeroStats = configData ? [
    {
      label: 'Upload Logs',
      value: getTrackingConfigValue(configPreviewSource, 'uploadTimer') ?? '—',
      unit: 's',
      detail: 'Point upload interval',
      Icon: Upload,
      accentClassName: 'text-gray-900',
    },
    {
      label: 'Heartbeat',
      value: getTrackingConfigValue(configPreviewSource, 'heartbeatTimer') ?? '—',
      unit: 's',
      detail: 'Online ping interval',
      Icon: Activity,
      accentClassName: 'text-gray-900',
    },
    {
      label: 'Motion threshold',
      value: getTrackingConfigValue(configPreviewSource, 'distanceThreshold') ?? '—',
      unit: 'm',
      detail: 'Distance before logging',
      Icon: Gauge,
      accentClassName: 'text-gray-900',
    },
    {
      label: 'Endpoint',
      value: getTrackingEndpointLabel(getTrackingConfigValue(configPreviewSource, 'baseURL')),
      unit: '',
      detail: 'Server target',
      Icon: Link2,
      accentClassName: 'text-gray-900',
    },
  ] : [];

  // ── Fetch history ─────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async (pg: number) => {
    if (!deviceUuid) return;
    setLoading(true);
    try {
      const resp = await trackingService.getHistory(deviceUuid, { from: fromDt, to: toDt, page: pg, size: pageSize });
      if (resp.success && resp.data) {
        const resolvedTotalElements = resp.data.totalElements > 0 ? resp.data.totalElements : resp.data.content.length;
        const resolvedPageSize = resp.data.size > 0 ? resp.data.size : pageSize;
        const resolvedTotalPages = resp.data.totalPages > 0
          ? resp.data.totalPages
          : resolvedTotalElements > 0
            ? Math.ceil(resolvedTotalElements / resolvedPageSize)
            : 1;

        setPoints(resp.data.content);
        setTotalPages(resolvedTotalPages);
        setTotalElements(resolvedTotalElements);
        setPage(typeof resp.data.number === 'number' ? resp.data.number : pg);
        setFitBoundsKey((k) => k + 1);
      }
    } catch { /**/ } finally { setLoading(false); setHasLoaded(true); }
  }, [deviceUuid, fromDt, toDt, pageSize]);

  // ── Playback interval ─────────────────────────────────────────────────────
  useEffect(() => {
    if (playbackActive && points.length > 0) {
      const intervalMs = Math.max(50, 300 / playbackSpeed);
      playbackRef.current = setInterval(() => {
        setPlaybackIdx((prev) => {
          const next = prev + 1;
          if (next >= points.length) {
            setPlaybackActive(false);
            return prev;
          }
          return next;
        });
      }, intervalMs);
    } else {
      if (playbackRef.current) clearInterval(playbackRef.current);
    }
    return () => { if (playbackRef.current) clearInterval(playbackRef.current); };
  }, [playbackActive, playbackSpeed, points.length]);

  useEffect(() => {
    if (points.length === 0) {
      setPlaybackActive(false);
      setPlaybackIdx(0);
      return;
    }

    setPlaybackIdx((prev) => Math.min(prev, points.length - 1));
  }, [points.length]);

  // ── Fetch trips ───────────────────────────────────────────────────────────
  const fetchTrips = useCallback(async (pg: number) => {
    if (!deviceUuid) return;
    setTripsLoading(true);
    try {
      const resp = await trackingService.getTrips(deviceUuid, { from: fromDt, to: toDt, page: pg, size: 10 });
      if (resp.success && resp.data) {
        setTrips(resp.data.content);
        setTripsTotal(resp.data.totalElements);
        setTripsTotalPages(resp.data.totalPages);
        setTripsPage(pg);
      }
    } catch { /**/ } finally { setTripsLoading(false); }
  }, [deviceUuid, fromDt, toDt]);

  // ── Fetch tracking events ─────────────────────────────────────────────────
  const fetchTrackEvents = useCallback(async () => {
    if (!deviceUuid) return;
    setTrackEventsLoading(true);
    try {
      const resp = await trackingService.getTrackingEvents(deviceUuid, { from: fromDt, to: toDt, size: 50 });
      if (resp.success && resp.data) {
        setTrackEvents(resp.data.content);
        setTrackEventsTotal(resp.data.totalElements);
      }
    } catch { /**/ } finally { setTrackEventsLoading(false); }
  }, [deviceUuid, fromDt, toDt]);

  // ── Fetch analytics ───────────────────────────────────────────────────────
  // fetchAnalytics available for future Analytics tab
  useEffect(() => {
    if (!deviceUuid) return;
    setAnalyticsLoading(true);
    trackingService.getAnalytics(deviceUuid, { from: fromDt, to: toDt })
      .then((resp) => { if (resp.success && resp.data) setAnalytics(resp.data); })
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // load once on mount

  // ── Fetch geofences ───────────────────────────────────────────────────────
  const fetchGeofences = useCallback(async (pg = 0) => {
    if (!deviceUuid) return;
    setGeoLoading(true);
    try {
      const resp = await trackingService.getGeofences(deviceUuid, { page: pg, size: 8 });
      if (resp.success && resp.data) {
        setGeofences(resp.data.content);
        setGeoPage(pg);
        setGeoTotalPages(resp.data.totalPages);
        setGeoTotal(resp.data.totalElements);
      }
    } catch { /**/ } finally { setGeoLoading(false); }
  }, [deviceUuid]);

  // ── Fetch geofence type enums ─────────────────────────────────────────────
  const fetchGeoTypes = useCallback(async () => {
    if (!deviceUuid) return;
    try {
      const resp = await trackingService.getGeofenceTypes(deviceUuid);
      if (resp.success && resp.data) setGeoTypes(resp.data);
    } catch { /**/ }
  }, [deviceUuid]);

  // ── Fetch geofence events ─────────────────────────────────────────────────
  const fetchGeoEvents = useCallback(async (pg = 0) => {
    if (!deviceUuid) return;
    setGeoEventsLoading(true);
    try {
      const resp = await trackingService.getGeofenceEvents(deviceUuid, { page: pg, size: 10 });
      if (resp.success && resp.data) {
        setGeoEvents(resp.data.content);
        setGeoEventsTotal(resp.data.totalElements);
        setGeoEventsPage(pg);
        setGeoEventsTotalPages(resp.data.totalPages);
      }
    } catch { /**/ } finally { setGeoEventsLoading(false); }
  }, [deviceUuid]);

  // ── Live tracking MQTT client (QoS 0, clean session) ─────────────────────
  useEffect(() => {
    if (!deviceUuid) return;

    const clientId = `tracking-${deviceUuid}-${Date.now()}`;
    const client = mqtt.connect(MQTT_BROKER_URL, {
      clientId,
      clean: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      protocol: WS as any,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    });

    const topic = `tracking/device/${deviceUuid}/live`;

    client.on('connect', () => {
      client.subscribe(topic, { qos: 0 });
    });

    client.on('message', (_topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        if (data.latitude == null || data.longitude == null) return;

        // Map MQTT payload (CreateLocationRequest) → HistoryPoint shape
        const livePoint: HistoryPoint = {
          id: -(Date.now()),                          // temporary negative id to avoid collisions
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed ?? 0,
          accuracy: data.accuracy ?? 0,
          altitude: data.altitude ?? 0,
          bearing: data.bearing ?? 0,
          availableSatellite: data.availableSatellite ?? 0,
          connectedSatellite: data.connectedSatellite ?? 0,
          deviceRdt: data.deviceRDT ?? '',
          gpsRdt: data.gpsRDT ?? '',
          receivedAt: new Date().toISOString(),
          uploadRetryCount: data.uploadRetryCount ?? 0,
          provider: data.provider ?? '',
          versionNo: data.versionNo ?? '',
          igStatus: data.igStatus ?? 0,
          reason: data.reason ?? '',
          localPrimaryId: data.localPrimaryId ?? 0,
        };

        setPoints((prev) => [livePoint, ...prev]);
        setHasLoaded(true);
      } catch { /**/ }
    });

    trackingClientRef.current = client;

    return () => {
      client.unsubscribe(topic);
      client.end(true);
      trackingClientRef.current = null;
    };
  }, [deviceUuid]);

  useEffect(() => {
    if (!deviceUuid || initialHistoryDeviceRef.current === deviceUuid) return;

    initialHistoryDeviceRef.current = deviceUuid;
    setHasLoaded(false);
    setPlaybackActive(false);
    setPlaybackIdx(0);
    setPage(0);
    fetchHistory(0);
  }, [deviceUuid, fetchHistory]);

  useEffect(() => { fetchGeofences(); fetchGeoTypes(); fetchGeoEvents(); }, [fetchGeofences, fetchGeoTypes, fetchGeoEvents]);
  // Mobile: auto-switch panel during draw workflow so the map is visible while drawing
  useEffect(() => {
    if (window.innerWidth >= 768) return;
    if (draw.phase === 'confirm') setActivePanel('geofences');
    else if (!['idle', 'type-select'].includes(draw.phase)) setActivePanel(null);
  }, [draw.phase]);

  // ── Drawing map callbacks (stable refs to avoid MapContainer re-render) ───
  const handleMapClick = useCallback((lat: number, lng: number) => {
    const s = drawRef.current;
    if (s.phase === 'circle-center') {
      setDraw((d) => ({ ...d, phase: 'circle-radius', circleCenter: [lat, lng] }));
    } else if (s.phase === 'circle-radius' && s.circleCenter) {
      const r = Math.round(metersBetween(s.circleCenter, [lat, lng]));
      setDraw((d) => ({ ...d, phase: 'confirm', circleRadius: r, mousePos: null }));
    } else if (s.phase === 'polygon' || s.phase === 'line') {
      setDraw((d) => ({ ...d, polygonPts: [...d.polygonPts, [lat, lng]] }));
    }
  }, []);

  const handleMouseMove = useCallback((lat: number, lng: number) => {
    setDraw((d) => ({ ...d, mousePos: [lat, lng] }));
  }, []);

  // ── Drawing helpers ───────────────────────────────────────────────────────
  function startDraw(type: GeoType, geo?: GeofenceData) {
    if (geo) {
      setDraw({
        ...BLANK_DRAW,
        phase: 'confirm', type: geo.type,
        circleCenter: geo.centerLat && geo.centerLng ? [geo.centerLat, geo.centerLng] : null,
        circleRadius: geo.radiusMeters ?? null,
        polygonPts: parsePolygonPoints(geo.polygonPoints),
        name: geo.name, editId: geo.id,
        bufferMeters: geo.bufferMeters ?? 0,
      });
    } else {
      const phase: DrawPhase = type === 'CIRCLE' ? 'circle-center' : type === 'POLYGON' ? 'polygon' : 'line';
      setDraw({ ...BLANK_DRAW, phase, type });
    }
  }

  function cancelDraw() { setDraw(BLANK_DRAW); }

  function undoLastPolygonPt() {
    setDraw((d) => ({ ...d, polygonPts: d.polygonPts.slice(0, -1) }));
  }

  function finishPolygon() {
    if (draw.polygonPts.length >= 3) setDraw((d) => ({ ...d, phase: 'confirm', mousePos: null }));
  }
  function finishLine() {
    if (draw.polygonPts.length >= 2) setDraw((d) => ({ ...d, phase: 'confirm', mousePos: null }));
  }

  // ── Geofence save ─────────────────────────────────────────────────────────
  async function saveGeofence() {
    if (!deviceUuid || !draw.name.trim()) return;
    setGeoSaving(true);
    try {
      const typeId = geoTypes.find((t) => t.name === draw.type)?.id ?? 0;
      const req: GeofenceRequest = {
        name:          draw.name,
        typeId,
        centerLat:     draw.circleCenter?.[0] ?? null,
        centerLng:     draw.circleCenter?.[1] ?? null,
        radiusMeters:  draw.circleRadius ?? null,
        polygonPoints: draw.polygonPts.length > 0 ? JSON.stringify(draw.polygonPts) : null,
        bufferMeters:  draw.bufferMeters > 0 ? draw.bufferMeters : null,
      };
      const resp = draw.editId != null
        ? await trackingService.updateGeofence(deviceUuid, draw.editId, req)
        : await trackingService.createGeofence(deviceUuid, req);
      if (resp.success) { cancelDraw(); fetchGeofences(draw.editId != null ? geoPage : 0); }
    } catch { /**/ } finally { setGeoSaving(false); }
  }

  async function deleteGeofence(id: number) {
    if (!deviceUuid) return;
    setGeoDeleting(id);
    try {
      await trackingService.deleteGeofence(deviceUuid, id);
      // If this was the only item on the page, go back one page
      const remainingOnPage = geofences.length - 1;
      const nextPage = remainingOnPage === 0 && geoPage > 0 ? geoPage - 1 : geoPage;
      fetchGeofences(nextPage);
    } catch { /**/ } finally { setGeoDeleting(null); }
  }

  // ── Bulk upload ───────────────────────────────────────────────────────────
  async function handleBulkUpload() {
    if (!deviceUuid || !uploadJson.trim()) return;
    setUploading(true); setUploadMsg(null);
    try {
      const data = JSON.parse(uploadJson);
      const pts = Array.isArray(data) ? data : [data];
      const resp = await trackingService.bulkCreateTrackingPoints(deviceUuid, pts);
      setUploadMsg({ ok: !!resp.success, text: resp.message ?? (resp.success ? 'Uploaded successfully' : 'Failed') });
      if (resp.success) { setUploadJson(''); fetchHistory(0); }
    } catch (e) {
      setUploadMsg({ ok: false, text: `Parse error: ${(e as Error).message}` });
    } finally { setUploading(false); }
  }

  // ── Tracking config ───────────────────────────────────────────────────────
  const startConfigEditing = useCallback(() => {
    setConfigForm(buildTrackingConfigDraft(configData));
    setConfigEditing(true);
  }, [configData]);

  const cancelConfigEditing = useCallback(() => {
    setConfigForm(buildTrackingConfigDraft(configData));
    setConfigEditing(false);
  }, [configData]);

  const closeConfigModal = useCallback(() => {
    if (configSaving) return;
    setConfigModal(false);
    setConfigEditing(false);
    setConfigForm(buildTrackingConfigDraft(configData));
  }, [configData, configSaving]);

  useEffect(() => {
    if (!configModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || configSaving) return;
      if (configEditing) {
        cancelConfigEditing();
        return;
      }
      closeConfigModal();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [cancelConfigEditing, closeConfigModal, configEditing, configModal, configSaving]);

  async function openConfig() {
    setConfigModal(true);
    setConfigEditing(false);
    setConfigForm({ ...BLANK_CONFIG });
    setConfigData(null);
    if (!deviceUuid) return;
    setConfigLoading(true);
    try {
      const resp = await trackingService.getConfig(deviceUuid);
      if (resp.success && resp.data) {
        setConfigData(resp.data);
        setConfigForm(buildTrackingConfigDraft(resp.data));
      } else {
        setConfigData(null);
      }
    } catch { /**/ } finally { setConfigLoading(false); }
  }

  async function saveConfig() {
    if (!deviceUuid) return;
    setConfigSaving(true);
    try {
      await trackingService.updateConfig(deviceUuid, configForm);
      setConfigEditing(false);
      // Refresh displayed values
      const resp = await trackingService.getConfig(deviceUuid);
      if (resp.success && resp.data) {
        setConfigData(resp.data);
        setConfigForm(buildTrackingConfigDraft(resp.data));
      }
    } catch { /**/ } finally { setConfigSaving(false); }
  }

  // ── Excel export ──────────────────────────────────────────────────────────
  async function exportAllToExcel() {
    if (!deviceUuid) return;
    setLoading(true);
    try {
      let all: HistoryPoint[] = []; let pg = 0, last = false;
      while (!last) {
        const resp = await trackingService.getHistory(deviceUuid, { from: fromDt, to: toDt, page: pg, size: 200 });
        if (resp.success && resp.data) { all = all.concat(resp.data.content); last = resp.data.last; pg++; } else break;
      }
      const rows = all.map((p) => ({
        ID: p.id, Latitude: p.latitude, Longitude: p.longitude, Speed: p.speed,
        Accuracy: p.accuracy, Bearing: p.bearing, Altitude: p.altitude,
        'Available Satellite': p.availableSatellite, 'Connected Satellite': p.connectedSatellite,
        'Device RDT': p.deviceRdt, 'GPS RDT': p.gpsRdt, 'Received At': formatDateTimeWithMillis(p.receivedAt),
        'Upload Retry': p.uploadRetryCount, Provider: p.provider, Version: p.versionNo,
        'IG Status': p.igStatus, Reason: p.reason, 'Local Primary ID': p.localPrimaryId,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'History');
      XLSX.writeFile(wb, `tracking_${deviceUuid}_${fromDt.slice(0,16)}_to_${toDt.slice(0,16)}.xlsx`);
    } catch { /**/ } finally { setLoading(false); }
  }

  // ── Derived drawing preview values ────────────────────────────────────────
  const liveRadius = draw.phase === 'circle-radius' && draw.circleCenter && draw.mousePos
    ? Math.round(metersBetween(draw.circleCenter, draw.mousePos)) : null;
  const previewRadius = draw.circleRadius ?? liveRadius ?? 0;

  const rubberbandLine: [number, number][] =
    (draw.phase === 'polygon' || draw.phase === 'line') && draw.polygonPts.length > 0 && draw.mousePos
      ? [draw.polygonPts[draw.polygonPts.length - 1], draw.mousePos] : [];

  const isDrawingActive = draw.phase !== 'idle' && draw.phase !== 'type-select';
  const isTableExpanded = leftMode === 'table' || tableOpen;
  const mapPaneClass = leftMode === 'table'
    ? 'hidden'
    : leftMode === 'map'
    ? 'basis-0 flex-1 min-h-0'
    : tableOpen
    ? 'basis-0 flex-[1.35] min-h-[24rem]'
    : 'basis-0 flex-1 min-h-0';

  const handleHistorySort = useCallback((field: HistorySortField) => {
    if (historySortField === field) {
      setHistorySortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
      return;
    }

    setHistorySortField(field);
    setHistorySortDirection(field === 'localPrimaryId' ? 'desc' : 'asc');
  }, [historySortField]);

  const loadHistoryPage = useCallback((nextPage: number) => {
    const maxPage = Math.max(effectiveTotalPages - 1, 0);
    const clampedPage = effectiveTotalPages > 0
      ? Math.max(0, Math.min(nextPage, maxPage))
      : Math.max(0, nextPage);

    setPage(clampedPage);
    fetchHistory(clampedPage);
  }, [effectiveTotalPages, fetchHistory]);

  const historyPageCount = Math.max(effectiveTotalPages, 1);
  const historyCurrentPageLabel = Math.min(page + 1, historyPageCount);
  const canHistoryPrev = page > 0;
  const canHistoryNext = page < historyPageCount - 1;

  const historySummaryInline = hasLoaded && points.length > 0 ? (
    <div
      className="min-w-0 flex flex-1 items-center gap-1.5 overflow-x-auto pb-0.5"
      onClick={(event) => event.stopPropagation()}
    >
      {[
        { label: 'Min', value: historySpeedStats.min != null ? `${historySpeedStats.min.toFixed(1)} km/h` : '-' },
        { label: 'Avg', value: historySpeedStats.avg != null ? `${historySpeedStats.avg.toFixed(1)} km/h` : '-' },
        { label: 'Max', value: historySpeedStats.max != null ? `${historySpeedStats.max.toFixed(1)} km/h` : '-' },
      ].map((item) => (
        <span
          key={item.label}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 shadow-sm"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</span>
          <span className="font-semibold text-gray-900">{item.value}</span>
        </span>
      ))}
      {historyReasonStats.map((reason) => (
        <span
          key={reason.label}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 shadow-sm"
        >
          <span className="truncate">{reason.label}</span>
          <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
            {reason.count}
          </span>
        </span>
      ))}
    </div>
  ) : null;

  // ── Map element ───────────────────────────────────────────────────────────
  const mapElement = (
    <div className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden md:rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="pointer-events-none absolute inset-0 z-[450]" />
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/60 pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}
      {/* Route Playback floating controls (Module 3) */}
      {hasLoaded && points.length > 1 && !isDrawingActive && (
        <div className={`pointer-events-auto absolute left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 shadow-lg ${leftMode === 'map' ? 'bottom-14' : 'bottom-4'}`}>
          <button
            onClick={() => {
              setPlaybackActive(false);
              setPlaybackIdx(0);
            }}
            title="Reset"
            className="p-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPlaybackActive((v) => !v)}
            title={playbackActive ? 'Pause' : 'Play'}
            className="flex items-center justify-center w-9 h-9 rounded-md bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm"
          >
            {playbackActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div className="flex items-center gap-1">
            {[1, 2, 5].map((s) => (
              <button key={s} onClick={() => setPlaybackSpeed(s)}
                className={`text-xs font-bold px-2 py-1 rounded-md transition-colors ${playbackSpeed === s ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
                {s}×
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 ml-1">
            <div className="w-24 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${points.length > 1 ? (playbackIdx / (points.length - 1)) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 font-mono">
              {playbackIdx + 1}/{points.length}
            </span>
          </div>
        </div>
      )}
      {hasLoaded && leftMode === 'map' && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[1000] hidden items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-1.5 text-[11px] md:flex">
          <div className="flex min-w-0 items-center gap-2 text-gray-500">
            <span className="font-semibold text-gray-900">{totalElements.toLocaleString()}</span>
            <span>records</span>
            <span className="h-1 w-1 rounded-full bg-gray-300" />
            <span>Page {historyCurrentPageLabel} / {historyPageCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => loadHistoryPage(page - 1)}
              disabled={!canHistoryPrev || loading}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-35"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => loadHistoryPage(page + 1)}
              disabled={!canHistoryNext || loading}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-35"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile: floating draw instruction bar */}
      {!['idle', 'type-select', 'confirm'].includes(draw.phase) && (
        <div className="md:hidden pointer-events-auto absolute top-4 left-4 right-4 z-[1000] flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
          <MousePointer2 className="w-4 h-4 shrink-0" style={{ color: GEO_COLOR[draw.type] }} />
          <p className="flex-1 text-xs font-medium text-gray-700">
            {draw.phase === 'circle-center' && 'Tap to place center'}
            {draw.phase === 'circle-radius' && `Tap to set radius${liveRadius ? ` · ${liveRadius.toLocaleString()}m` : ''}`}
            {draw.phase === 'polygon' && `${draw.polygonPts.length} pts${draw.polygonPts.length >= 3 ? ' · Tap Done' : ' · need 3+'}`}
            {draw.phase === 'line' && `${draw.polygonPts.length} wpts${draw.polygonPts.length >= 2 ? ' · Tap Done' : ' · need 2+'}`}
          </p>
          <div className="flex items-center gap-1.5">
            {(draw.phase === 'polygon' || draw.phase === 'line') && (
              <button onClick={draw.phase === 'polygon' ? finishPolygon : finishLine}
                disabled={(draw.phase === 'polygon' && draw.polygonPts.length < 3) || (draw.phase === 'line' && draw.polygonPts.length < 2)}
                className="rounded-md px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                style={{ background: GEO_COLOR[draw.type] }}>
                Done
              </button>
            )}
            <button onClick={cancelDraw} className="rounded-md px-2.5 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} className="h-full w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <InvalidateMapSize layoutKey={`${leftMode}-${tableOpen}`} />
        <MapInteractionHandler draw={draw} onMapClick={handleMapClick} onMouseMove={handleMouseMove} />
        {!isDrawingActive && <PointHoverHandler points={points} onHover={setHoverPoint} />}
        <CenterOnLocation target={centerTarget} />

        {polyline.length > 0 && !isDrawingActive && <FitBounds positions={polyline} trigger={fitBoundsKey} />}

        {/* Single shared popup — shown when hovering near a GPS point */}
        {hoverPoint && !isDrawingActive && (
          <Popup
            position={[hoverPoint.latitude, hoverPoint.longitude]}
            autoPan={false}
            closeButton={false}
            offset={[0, -4]}
          >
            <PointPopup point={hoverPoint} color={speedColor(hoverPoint.speed ?? 0)} />
          </Popup>
        )}

        {/* Speed-colored route segments */}
        {routeSegments.map((seg, i) => (
          <Polyline key={`seg-${i}`} positions={seg.pts}
            pathOptions={{ color: seg.color, weight: 7, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }} />
        ))}
        {/* Direction arrows (bearing) */}
        {arrowPoints.map((p) => (
          <Marker key={`arr-${p.latitude.toFixed(5)}-${p.longitude.toFixed(5)}`} position={[p.latitude, p.longitude]}
            icon={bearingIcon(p.bearing ?? 0, speedColor(p.speed ?? 0))}
            zIndexOffset={-100} />
        ))}
        {/* Selected trip markers (Module 1) */}
        {selectedTrip && selectedTrip.startLat && (
          <Marker position={[selectedTrip.startLat, selectedTrip.startLng!]}
            icon={makePin('#16a34a')}>
            <Popup autoPan={false}><div className="text-xs"><b>Trip Start</b><br />{new Date(selectedTrip.startTime).toLocaleString()}</div></Popup>
          </Marker>
        )}
        {selectedTrip && selectedTrip.endLat && (
          <Marker position={[selectedTrip.endLat, selectedTrip.endLng!]}
            icon={makePin('#dc2626')}>
            <Popup autoPan={false}><div className="text-xs"><b>Trip End</b><br />{selectedTrip.endTime ? new Date(selectedTrip.endTime).toLocaleString() : '—'}<br />{selectedTrip.totalDistanceMeters >= 1000 ? `${(selectedTrip.totalDistanceMeters / 1000).toFixed(2)} km` : `${Math.round(selectedTrip.totalDistanceMeters)} m`}</div></Popup>
          </Marker>
        )}

        {/* Route Playback marker (Module 3) */}
        {playbackPoint && (
          <Marker
            position={[playbackPoint.latitude, playbackPoint.longitude]}
            icon={new L.DivIcon({
              className: '',
              html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 3px #2563eb4d;"></div>`,
              iconSize: [18, 18], iconAnchor: [9, 9],
            })}
            zIndexOffset={1000}
          >
            <Popup autoPan={false} closeButton={false}>
              <PointPopup point={playbackPoint} color="#2563eb" />
            </Popup>
          </Marker>
        )}
        {polyline.length > 0 && (
          <Marker position={polyline[0]} icon={startPin}>
            <Popup minWidth={220} maxWidth={280} autoPan={false}><PointPopup point={points[0]} color="#16a34a" label="START" /></Popup>
          </Marker>
        )}
        {polyline.length > 1 && (
          <Marker position={polyline[polyline.length - 1]} icon={endPin}>
            <Popup minWidth={220} maxWidth={280} autoPan={false}><PointPopup point={points[points.length - 1]} color="#dc2626" label="END" /></Popup>
          </Marker>
        )}

        {/* Pinned marker from panel item navigation */}
        {pinnedMarker && <PinnedMarkerLayer key={`${pinnedMarker.lat},${pinnedMarker.lng},${pinnedMarker.title}`} info={pinnedMarker} />}

        {/* Saved geofence overlays */}
        {showGeoOnMap && geofences.filter((g) => g.active).map((g) => {
          const color = GEO_COLOR[g.type] ?? '#2563eb';
          const popup = <Popup><GeofencePopup geo={g} onEdit={() => startDraw(g.type, g)} /></Popup>;

          if (g.type === 'CIRCLE' && g.centerLat && g.centerLng && g.radiusMeters) {
            return (
              <LeafletCircle key={g.id} center={[g.centerLat, g.centerLng]}
                radius={g.radiusMeters + (g.bufferMeters ?? 0)}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 2 }}>
                {popup}
              </LeafletCircle>
            );
          }
          if (g.type === 'POLYGON' && g.polygonPoints) {
            const pts = parsePolygonPoints(g.polygonPoints);
            if (pts.length >= 3) return (
              <Polygon key={g.id} positions={pts}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 2 }}>
                {popup}
              </Polygon>
            );
          }
          if (g.type === 'LINE' && g.polygonPoints) {
            const pts = parsePolygonPoints(g.polygonPoints);
            if (pts.length >= 2) return (
              <React.Fragment key={g.id}>
                {/* Buffer corridor (thick semi-transparent) */}
                <Polyline positions={pts}
                  pathOptions={{ color, weight: 12, opacity: 0.18 }} />
                {/* Line itself */}
                <Polyline positions={pts}
                  pathOptions={{ color, weight: 3, opacity: 0.9 }}>
                  {popup}
                </Polyline>
              </React.Fragment>
            );
          }
          return null;
        })}

        {/* ── Drawing previews ──────────────────────────────────────────── */}
        {(() => {
          const dc = GEO_COLOR[draw.type] ?? '#2563eb';
          return (
            <>
              {/* Circle center dot */}
              {draw.circleCenter && (
                <CircleMarker center={draw.circleCenter} radius={7}
                  pathOptions={{ color: dc, fillColor: dc, fillOpacity: 1, weight: 2 }} />
              )}

              {/* Live circle preview */}
              {draw.circleCenter && (draw.phase === 'circle-radius' || draw.phase === 'confirm') && previewRadius > 0 && (
                <LeafletCircle center={draw.circleCenter} radius={previewRadius}
                  pathOptions={{ color: dc, fillColor: dc, fillOpacity: 0.15, weight: 2,
                    dashArray: draw.phase === 'circle-radius' ? '6 6' : undefined }} />
              )}

              {/* Circle radius cursor dot */}
              {draw.phase === 'circle-radius' && draw.mousePos && (
                <CircleMarker center={draw.mousePos} radius={4}
                  pathOptions={{ color: dc, fillColor: 'white', fillOpacity: 0.9, weight: 2 }} />
              )}

              {/* Polygon / Line placed point dots */}
              {(draw.phase === 'polygon' || draw.phase === 'line' || (draw.phase === 'confirm' && draw.type !== 'CIRCLE')) &&
                draw.polygonPts.map((pt, i) => (
                  <CircleMarker key={i} center={pt} radius={i === 0 || i === draw.polygonPts.length - 1 ? 7 : 5}
                    pathOptions={{ color: dc, fillColor: dc, fillOpacity: 1, weight: 2 }} />
                ))
              }

              {/* Polygon / Line edges */}
              {draw.polygonPts.length > 1 && (draw.phase === 'polygon' || draw.phase === 'line') && (
                <Polyline positions={draw.polygonPts} color={dc} weight={2} dashArray="6 4" />
              )}

              {/* Rubber-band line to cursor */}
              {rubberbandLine.length === 2 && (
                <Polyline positions={rubberbandLine} color={dc} weight={2} dashArray="4 4" opacity={0.7} />
              )}

              {/* Polygon confirm preview */}
              {draw.phase === 'confirm' && draw.type === 'POLYGON' && draw.polygonPts.length >= 3 && (
                <Polygon positions={draw.polygonPts}
                  pathOptions={{ color: dc, fillColor: dc, fillOpacity: 0.15, weight: 2 }} />
              )}

              {/* Line confirm preview (with buffer corridor) */}
              {draw.phase === 'confirm' && draw.type === 'LINE' && draw.polygonPts.length >= 2 && (
                <>
                  {draw.bufferMeters > 0 && (
                    <Polyline positions={draw.polygonPts}
                      pathOptions={{ color: dc, weight: 14, opacity: 0.18 }} />
                  )}
                  <Polyline positions={draw.polygonPts}
                    pathOptions={{ color: dc, weight: 3, opacity: 0.9 }} />
                </>
              )}
            </>
          );
        })()}
      </MapContainer>

      {/* ── Speed legend ───────────────────────────────────────────────────── */}
      {points.length > 0 && (
        <div className="pointer-events-none absolute top-4 right-4 z-[1000] rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 shadow-lg">
          <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Speed</p>
          <div className="flex flex-col gap-1">
            {([
              { color: '#9ca3af', label: 'Stopped',     range: '0 km/h'   },
              { color: '#16a34a', label: 'Very slow',   range: '< 10'     },
              { color: '#65a30d', label: 'Slow',        range: '10 – 30'  },
              { color: '#ca8a04', label: 'Moderate',    range: '30 – 60'  },
              { color: '#d97706', label: 'Fast',        range: '60 – 90'  },
              { color: '#dc2626', label: 'Very fast',   range: '90 – 120' },
              { color: '#b91c1c', label: 'Over-speed',  range: '120+'     },
            ]).map(({ color, label, range }) => (
              <span key={label} className="flex items-center gap-2 text-[10px] text-gray-600">
                <span className="w-5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="font-medium">{label}</span>
                <span className="text-gray-500 ml-auto pl-2">{range}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* No data overlay */}
      {hasLoaded && polyline.length === 0 && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-6 py-4 text-center">
            <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-gray-500">No location data for selected range</p>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="z-50 shrink-0 border-b border-gray-200 bg-white px-4 py-3 md:px-5 md:py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-md border border-gray-300 bg-white p-2.5 text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-gray-900">{device?.deviceName ?? deviceUuid ?? deviceId}</p>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">Tracking</span>
            </div>
            <p className="hidden md:block text-xs text-gray-500">Live route intelligence, geofence tooling, and export-grade location history</p>
          </div>
          {/* Config button */}
          <button onClick={openConfig} title="Tracking configuration"
            className="rounded-md border border-gray-300 bg-white p-2.5 text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-blue-700">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Top Options Toolbar ───────────────────────────────────────────── */}
      <div className="max-md:hidden shrink-0 z-40 border-b border-gray-200 bg-white px-5 py-2">
        <div className="flex items-center gap-2">
          {/* History */}
          <button onClick={() => setActivePanel(activePanel === 'history' ? null : 'history')}
            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors border ${activePanel === 'history' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-700'}`}>
            <Sheet className="w-3.5 h-3.5" />
            History
            {hasLoaded && totalElements > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activePanel === 'history' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{totalElements.toLocaleString()}</span>
            )}
          </button>

          {/* Geofences */}
          <button onClick={() => setActivePanel(activePanel === 'geofences' ? null : 'geofences')}
            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors border ${activePanel === 'geofences' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-700'}`}>
            <Shield className="w-3.5 h-3.5" />
            Geofences
            {geoTotal > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activePanel === 'geofences' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{geoTotal}</span>
            )}
          </button>

          {/* Events */}
          <button onClick={() => setActivePanel(activePanel === 'events' ? null : 'events')}
            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors border ${activePanel === 'events' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-700'}`}>
            <Activity className="w-3.5 h-3.5" />
            Events
            {geoEventsTotal > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activePanel === 'events' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{geoEventsTotal}</span>
            )}
          </button>

          {/* Trips */}
          <button onClick={() => setActivePanel(activePanel === 'trips' ? null : 'trips')}
            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors border ${activePanel === 'trips' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-700'}`}>
            <Route className="w-3.5 h-3.5" />
            Trips
            {tripsTotal > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activePanel === 'trips' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{tripsTotal}</span>
            )}
          </button>

          {/* Alerts */}
          <button onClick={() => setActivePanel(activePanel === 'alerts' ? null : 'alerts')}
            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors border ${activePanel === 'alerts' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-700'}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            Alerts
            {trackEventsTotal > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activePanel === 'alerts' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{trackEventsTotal}</span>
            )}
          </button>

          <div className="flex-1" />

          {/* View mode switcher - moved from map overlay */}
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
            <button onClick={() => setLeftMode('map')} title="Full map"
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${leftMode === 'map' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <Maximize2 className="w-3.5 h-3.5" /><span>Map</span>
            </button>
            <button onClick={() => setLeftMode('split')} title="Split view"
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${leftMode === 'split' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <LayoutPanelTop className="w-3.5 h-3.5" /><span>Split</span>
            </button>
            <button onClick={() => setLeftMode('table')} title="Full table"
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${leftMode === 'table' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <Sheet className="w-3.5 h-3.5" /><span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {/* pb-[60px] on mobile reserves space for fixed bottom nav bar */}
      <div className="flex flex-col md:flex-row min-h-0 flex-1 md:gap-4 overflow-hidden md:px-4 md:pt-3 md:pb-4 pb-[60px] md:pb-0">

        {/* ── Left: Map (top) + Table (bottom) ─────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:gap-4">

          {/* Map */}
          <div className={`relative flex min-h-0 min-w-0 overflow-hidden transition-all duration-300 ease-out ${mapPaneClass}`}>
            {mapElement}

          </div>

          {/* Table section */}
          <div className={`max-md:hidden flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-300 ease-out ${
            leftMode === 'map' ? 'hidden' :
            leftMode === 'table' ? 'flex-1 min-h-0' :
            tableOpen ? 'flex-[0.95] min-h-0' : 'flex-none h-12'
          }`}>

            {/* Table header / toggle bar */}
            <div className={`shrink-0 select-none border-b border-gray-200 bg-gray-50 px-4 py-3 ${leftMode === 'split' ? 'cursor-pointer' : ''}`}
              onClick={() => leftMode === 'split' && setTableOpen((v) => !v)}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Excel View</span>
                      {hasLoaded && <span className="text-[11px] text-gray-500">{totalElements.toLocaleString()} route records</span>}
                    </div>
                  </div>
                  <div className="hidden min-w-0 flex-1 md:flex">
                    {historySummaryInline}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Fullscreen table toggle */}
                  <button onClick={(e) => { e.stopPropagation(); setLeftMode((m) => m === 'table' ? 'split' : 'table'); }}
                    title={leftMode === 'table' ? 'Exit fullscreen' : 'Fullscreen table'}
                    className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-700">
                    {leftMode === 'table' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                  {/* Collapse toggle (split mode only) */}
                  {leftMode === 'split' && (
                    <ChevronRight className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${tableOpen ? 'rotate-90' : '-rotate-90'}`} />
                  )}
                </div>
              </div>
              <div className="mt-2 flex md:hidden">
                {historySummaryInline}
              </div>
            </div>

            {isTableExpanded && (
              <>
                <div className="flex-1 overflow-auto min-h-0">
                  {loading && <div className="flex items-center justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>}
                  {!loading && hasLoaded && points.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                      <MapPin className="w-8 h-8 mb-2 opacity-30" />
                      <p className="text-sm">No location data for selected range</p>
                    </div>
                  )}
                  {!loading && points.length > 0 && (
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-gray-50 text-gray-500 uppercase tracking-wide">
                        <tr>
                          {HISTORY_TABLE_COLUMNS.map((column) => (
                            <th
                              key={column.label}
                              scope="col"
                              aria-sort={
                                column.sortField && historySortField === column.sortField
                                  ? historySortDirection === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                  : 'none'
                              }
                              className={`whitespace-nowrap border-b border-gray-200 px-3 py-2.5 ${column.className ?? ''}`}
                            >
                              {column.sortField ? (
                                <button
                                  type="button"
                                  onClick={() => handleHistorySort(column.sortField!)}
                                  aria-label={`Sort by ${column.label}${historySortField === column.sortField ? `, currently ${historySortDirection}` : ''}`}
                                  title={`Sort by ${column.label}`}
                                  className="group inline-flex items-center gap-1.5 font-semibold transition-colors hover:text-gray-700"
                                >
                                  <span>{column.label}</span>
                                  <span className="text-[11px] text-gray-400 transition-colors group-hover:text-gray-600">
                                    {historySortField === column.sortField
                                      ? historySortDirection === 'asc' ? '↑' : '↓'
                                      : '↕'}
                                  </span>
                                </button>
                              ) : (
                                <span className="font-semibold">{column.label}</span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortedHistoryPoints.map((p, i) => (
                          <tr key={`${p.id}-${p.localPrimaryId ?? 'na'}-${i}`} className="bg-white transition-colors hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{page * pageSize + i + 1}</td>
                            <td className="px-3 py-2 font-mono text-gray-400">{p.id > 0 ? p.id : '-'}</td>
                            <td className="px-3 py-2 font-mono text-gray-600">{p.localPrimaryId || '-'}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatDateTimeWithMillis(p.receivedAt)}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-gray-600">{p.deviceRdt || '-'}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-gray-600">{p.gpsRdt || '-'}</td>
                            <td className="px-3 py-2 font-mono text-gray-900">{p.latitude?.toFixed(6)}</td>
                            <td className="px-3 py-2 font-mono text-gray-900">{p.longitude?.toFixed(6)}</td>
                            <td className="px-3 py-2 text-gray-600">{p.speed != null ? p.speed.toFixed(1) : '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{p.accuracy != null ? `±${p.accuracy.toFixed(0)}` : '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{p.altitude != null ? p.altitude.toFixed(0) : '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{p.bearing != null ? `${p.bearing.toFixed(1)}°` : '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{p.connectedSatellite}/{p.availableSatellite}</td>
                            <td className="px-3 py-2 text-gray-600">{p.provider || '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{p.versionNo || '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{p.uploadRetryCount ?? '-'}</td>
                            <td className="px-3 py-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.igStatus === 1 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700'}`}>
                                {p.igStatus === 1 ? 'ON' : 'OFF'}
                              </span>
                            </td>
                            <td className="max-w-[160px] truncate px-3 py-2 text-gray-500">{p.reason || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {hasLoaded && (
                  <div className="shrink-0 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-1.5 text-[11px]">
                    <div className="flex min-w-0 items-center gap-2 text-gray-500">
                      <span className="font-semibold text-gray-900">{totalElements.toLocaleString()}</span>
                      <span>records</span>
                      <span className="h-1 w-1 rounded-full bg-gray-300" />
                      <span>Page {historyCurrentPageLabel} / {historyPageCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => loadHistoryPage(page - 1)}
                        disabled={!canHistoryPrev || loading}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-35"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => loadHistoryPage(page + 1)}
                        disabled={!canHistoryNext || loading}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-35"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right collapsible panel (legacy shell kept for state compat) ── */}
        <div className="hidden">
          {rightOpen && (
            <div className="w-80 h-full flex flex-col overflow-hidden">

              {/* ── Section: History Filters ──────────────────────────── */}
              <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-200 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">History Filters</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">From</label>
                    <input type="datetime-local" step="1" value={fromDt} onChange={(e) => setFromDt(e.target.value)}
                      className="w-full h-9 bg-white border border-gray-300 rounded-md px-3 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">To</label>
                    <input type="datetime-local" step="1" value={toDt} onChange={(e) => setToDt(e.target.value)}
                      className="w-full h-9 bg-white border border-gray-300 rounded-md px-3 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setPage(0); fetchHistory(0); }} disabled={loading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-white rounded-md text-xs font-semibold hover:bg-primary-hover shadow-sm transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Search
                  </button>
                  <button onClick={exportAllToExcel} disabled={loading || !hasLoaded || totalElements === 0}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
                    <Download className="w-3.5 h-3.5" /> Excel
                  </button>
                  <button onClick={() => { setUploadModal(true); setUploadMsg(null); setUploadJson(''); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-xs font-semibold hover:bg-gray-50 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ── Section: Geofences ──────────────────────────────────── */}
              <div className="flex-[0.48] flex flex-col overflow-hidden min-h-0">

                {/* Geofence header */}
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-700" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Geofences</span>
                    {geoTotal > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{geoTotal}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Geofences ON/OFF toggle */}
                    <button onClick={() => setShowGeoOnMap((v) => !v)}
                      title={showGeoOnMap ? 'Hide on map' : 'Show on map'}
                      className={`p-1.5 rounded-md text-xs transition-colors ${showGeoOnMap ? 'text-blue-700 bg-blue-50' : 'text-gray-500 hover:bg-gray-100'}`}>
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => fetchGeofences(geoPage)} disabled={geoLoading}
                      className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                      {geoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>
                    {draw.phase === 'idle' && (
                      <button onClick={() => setDraw((d) => ({ ...d, phase: 'type-select' }))}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white rounded-md text-xs font-semibold hover:bg-primary-hover shadow-sm transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    )}
                    {draw.phase !== 'idle' && (
                      <button onClick={cancelDraw}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-red-200 text-red-700 rounded-md text-xs font-semibold hover:bg-red-50 transition-colors">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Drawing: type-select */}
                {draw.phase === 'type-select' && (
                  <div className="shrink-0 px-4 py-4 border-b border-gray-200 space-y-3">
                    <p className="text-xs text-gray-500">Select a shape to draw on the map</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => startDraw('CIRCLE')}
                        className="flex flex-col items-center gap-1.5 py-3 bg-white border border-gray-300 rounded-md text-blue-700 hover:bg-blue-50 active:scale-95 transition-all">
                        <div className="w-7 h-7 rounded-full border-2 border-blue-600" />
                        <span className="text-xs font-semibold">Circle</span>
                      </button>
                      <button onClick={() => startDraw('POLYGON')}
                        className="flex flex-col items-center gap-1.5 py-3 bg-white border border-gray-300 rounded-md text-blue-700 hover:bg-blue-50 active:scale-95 transition-all">
                        <svg width="28" height="28" viewBox="0 0 32 32"><polygon points="16,2 30,22 24,30 8,30 2,22" fill="none" stroke="#1d4ed8" strokeWidth="2.5"/></svg>
                        <span className="text-xs font-semibold">Polygon</span>
                      </button>
                      <button onClick={() => startDraw('LINE')}
                        className="flex flex-col items-center gap-1.5 py-3 bg-white border border-gray-300 rounded-md text-blue-700 hover:bg-blue-50 active:scale-95 transition-all">
                        <svg width="28" height="28" viewBox="0 0 32 32">
                          <path d="M4 26 L14 10 L24 18 L30 6" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M4 26 L14 10 L24 18 L30 6" fill="none" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.18"/>
                        </svg>
                        <span className="text-xs font-semibold">Line</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Drawing: active phase (polygon/line/circle drawing) */}
                {(draw.phase === 'circle-center' || draw.phase === 'circle-radius' || draw.phase === 'polygon' || draw.phase === 'line') && (
                  <div className="shrink-0 px-4 py-4 border-b border-gray-200 space-y-3">
                    {/* Status */}
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border"
                      style={{ borderColor: `${GEO_COLOR[draw.type]}40`, background: `${GEO_COLOR[draw.type]}10` }}>
                      <MousePointer2 className="w-4 h-4 shrink-0" style={{ color: GEO_COLOR[draw.type] }} />
                      <p className="text-xs font-medium text-gray-700">
                        {draw.phase === 'circle-center' && 'Tap map to place center'}
                        {draw.phase === 'circle-radius' && `Tap to set radius${liveRadius ? ` · ${liveRadius.toLocaleString()}m` : ''}`}
                        {draw.phase === 'polygon' && `${draw.polygonPts.length} point${draw.polygonPts.length !== 1 ? 's' : ''} placed${draw.polygonPts.length >= 3 ? ' · Ready' : ' · Need 3+'}`}
                        {draw.phase === 'line' && `${draw.polygonPts.length} waypoint${draw.polygonPts.length !== 1 ? 's' : ''} placed${draw.polygonPts.length >= 2 ? ' · Ready' : ' · Need 2+'}`}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2">
                      {(draw.phase === 'polygon' || draw.phase === 'line') && (
                        <button onClick={undoLastPolygonPt} disabled={draw.polygonPts.length === 0}
                          className="flex items-center gap-1 px-3 py-2 text-xs text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 transition-colors">
                          <Undo2 className="w-3.5 h-3.5" /> Undo
                        </button>
                      )}
                      {draw.phase === 'polygon' && (
                        <button onClick={finishPolygon} disabled={draw.polygonPts.length < 3}
                          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-md transition-colors disabled:opacity-40 bg-primary text-white hover:bg-primary-hover shadow-sm">
                          <Check className="w-3.5 h-3.5" /> Finish
                        </button>
                      )}
                      {draw.phase === 'line' && (
                        <button onClick={finishLine} disabled={draw.polygonPts.length < 2}
                          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-md transition-colors disabled:opacity-40 bg-primary text-white hover:bg-primary-hover shadow-sm">
                          <Check className="w-3.5 h-3.5" /> Finish
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Drawing: confirm phase */}
                {draw.phase === 'confirm' && (
                  <div className="shrink-0 px-4 py-4 border-b border-gray-200 space-y-3">
                    {/* Summary */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 border border-gray-200">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: GEO_COLOR[draw.type] }} />
                      <p className="flex-1 text-xs text-gray-600 truncate">
                        {draw.type === 'CIRCLE'
                          ? `Circle · ${draw.circleCenter?.[0].toFixed(4)}, ${draw.circleCenter?.[1].toFixed(4)} · r=${draw.circleRadius}m`
                          : draw.type === 'LINE'
                          ? `Line · ${draw.polygonPts.length} waypoints`
                          : `Polygon · ${draw.polygonPts.length} pts`}
                      </p>
                      <button onClick={() => setDraw((d) => ({
                        ...d,
                        phase: d.type === 'CIRCLE' ? 'circle-center' : d.type === 'POLYGON' ? 'polygon' : 'line',
                        circleCenter: null, circleRadius: null, polygonPts: [], mousePos: null,
                      }))} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-0.5 transition-colors">
                        <Undo2 className="w-3 h-3" /> Redraw
                      </button>
                    </div>
                    {/* Name */}
                    <input
                      autoFocus
                      value={draw.name}
                      onChange={(e) => setDraw((d) => ({ ...d, name: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter' && draw.name.trim()) saveGeofence(); if (e.key === 'Escape') cancelDraw(); }}
                      placeholder="Geofence name…"
                      className="w-full h-9 bg-white border border-gray-300 rounded-md px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-400"
                    />
                    {/* Buffer (LINE or CIRCLE) */}
                    {(draw.type === 'LINE' || draw.type === 'CIRCLE') && (
                      <div className="flex items-center gap-3 bg-gray-50 rounded-md px-3 py-2.5 border border-gray-200">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700">Buffer Zone</p>
                          <p className="text-xs text-gray-500 truncate">{draw.type === 'LINE' ? 'Corridor on each side' : 'Extra zone outside'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input type="number" min="0" step="10"
                            value={draw.bufferMeters || ''}
                            onChange={(e) => setDraw((d) => ({ ...d, bufferMeters: Number(e.target.value) || 0 }))}
                            placeholder="0"
                            className="w-16 bg-white border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <span className="text-xs text-gray-500">m</span>
                        </div>
                      </div>
                    )}
                    {/* Save/Cancel */}
                    <div className="flex gap-2">
                      <button onClick={cancelDraw}
                        className="px-4 py-2 rounded-md text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button onClick={saveGeofence} disabled={geoSaving || !draw.name.trim()}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 ${
                          draw.type === 'CIRCLE' ? 'bg-primary text-white hover:bg-primary-hover shadow-sm'
                          : draw.type === 'POLYGON' ? 'bg-primary text-white hover:bg-primary-hover shadow-sm'
                          : 'bg-primary text-white hover:bg-primary-hover shadow-sm'
                        }`}>
                        {geoSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {draw.editId != null ? 'Update' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Geofence list */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {geoLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    </div>
                  )}
                  {!geoLoading && geofences.length === 0 && draw.phase === 'idle' && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <Shield className="w-7 h-7 mb-2 opacity-25" />
                      <p className="text-sm">No geofences yet</p>
                      <p className="text-xs mt-1 text-center px-4">Click Add to draw one on the map</p>
                    </div>
                  )}
                  {!geoLoading && (
                    <div className="divide-y divide-gray-100">
                      {geofences.map((g) => (
                        <div key={g.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                          <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `${GEO_COLOR[g.type]}20`, border: `1.5px solid ${GEO_COLOR[g.type]}60` }}>
                            <div className="w-2 h-2 rounded-full" style={{ background: GEO_COLOR[g.type] }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-900 font-semibold truncate">{g.name}</p>
                            <p className="text-[10px] text-gray-500 truncate">
                              {g.type}{g.type === 'CIRCLE' && g.radiusMeters ? ` · ${g.radiusMeters}m` : ''}
                              {g.bufferMeters ? ` · buf=${g.bufferMeters}m` : ''}
                            </p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${g.active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700'}`}>
                            {g.active ? 'Active' : 'Off'}
                          </span>
                          <button onClick={() => startDraw(g.type, g)}
                            className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => deleteGeofence(g.id)} disabled={geoDeleting === g.id}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40">
                            {geoDeleting === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Geofence pagination footer */}
                {geoTotalPages > 1 && (
                  <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
                    <span className="text-[10px] text-gray-500">
                      Page {geoPage + 1} of {geoTotalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => fetchGeofences(geoPage - 1)} disabled={geoPage === 0 || geoLoading}
                        className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      {Array.from({ length: Math.min(geoTotalPages, 7) }, (_, i) => {
                        const start = Math.max(0, Math.min(geoPage - 3, geoTotalPages - 7));
                        return start + i;
                      }).map((i) => (
                        <button key={i} onClick={() => fetchGeofences(i)} disabled={geoLoading}
                          className={`w-5 h-5 rounded text-[10px] font-semibold transition-colors ${i === geoPage ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
                          {i + 1}
                        </button>
                      ))}
                      <button onClick={() => fetchGeofences(geoPage + 1)} disabled={geoPage >= geoTotalPages - 1 || geoLoading}
                        className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Section: Geofence Events ─────────────────────────────── */}
              <div className="flex-[0.52] flex flex-col overflow-hidden min-h-0 border-t border-gray-200">

                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-700" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Events</span>
                    {geoEventsTotal > 0 && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{geoEventsTotal}</span>
                    )}
                  </div>
                  <button onClick={() => fetchGeoEvents(0)} disabled={geoEventsLoading}
                    className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
                    {geoEventsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Events list */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {geoEventsLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    </div>
                  )}
                  {!geoEventsLoading && geoEvents.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                      <Activity className="w-7 h-7 mb-2 opacity-25" />
                      <p className="text-sm">No events yet</p>
                      <p className="text-xs mt-1 text-center px-4">ENTER / EXIT events appear here</p>
                    </div>
                  )}
                  {!geoEventsLoading && (
                    <div className="divide-y divide-gray-100">
                      {geoEvents.map((ev) => (
                        <div key={ev.id} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                          <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            ev.eventType === 'ENTER'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {ev.eventType}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">{ev.geofenceName}</p>
                            <p className="text-[10px] text-gray-500 font-mono">
                              {ev.latitude.toFixed(5)}, {ev.longitude.toFixed(5)}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {new Date(ev.eventTime).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Events pagination footer */}
                {geoEventsTotalPages > 1 && (
                  <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
                    <span className="text-[10px] text-gray-500">
                      Page {geoEventsPage + 1} of {geoEventsTotalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => fetchGeoEvents(geoEventsPage - 1)} disabled={geoEventsPage === 0 || geoEventsLoading}
                        className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] text-gray-500 min-w-[2rem] text-center">
                        {geoEventsPage + 1} / {geoEventsTotalPages}
                      </span>
                      <button onClick={() => fetchGeoEvents(geoEventsPage + 1)} disabled={geoEventsPage >= geoEventsTotalPages - 1 || geoEventsLoading}
                        className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Section: Trips (Module 1) ────────────────────────────── */}
              <div className="shrink-0 border-t border-gray-200">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Route className="w-3.5 h-3.5 text-blue-700" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Trips</span>
                    {tripsTotal > 0 && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{tripsTotal}</span>}
                  </div>
                  <button onClick={() => fetchTrips(0)} disabled={tripsLoading}
                    className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors">
                    {tripsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                  {!tripsLoading && trips.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-4">No trips — search history first</p>
                  )}
                  {trips.map((trip) => (
                    <div key={trip.id}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${selectedTrip?.id === trip.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedTrip(selectedTrip?.id === trip.id ? null : trip)}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${trip.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {new Date(trip.startTime).toLocaleTimeString()} → {trip.endTime ? new Date(trip.endTime).toLocaleTimeString() : '…'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {trip.totalDistanceMeters >= 1000 ? `${(trip.totalDistanceMeters / 1000).toFixed(2)} km` : `${Math.round(trip.totalDistanceMeters)} m`}
                          {' '}· {trip.avgSpeedKmh.toFixed(1)} km/h avg · max {trip.maxSpeedKmh.toFixed(0)} km/h
                        </p>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${trip.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700'}`}>
                        {trip.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Section: Tracking Alerts (Module 2) ──────────────────── */}
              <div className="shrink-0 border-t border-gray-200">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Alerts</span>
                    {trackEventsTotal > 0 && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">{trackEventsTotal}</span>}
                  </div>
                  <button onClick={fetchTrackEvents} disabled={trackEventsLoading}
                    className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors">
                    {trackEventsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                  {!trackEventsLoading && trackEvents.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-4">No alerts detected</p>
                  )}
                  {trackEvents.map((ev) => {
                    const colorMap: Record<string, string> = {
                      OVERSPEEDING: 'bg-red-50 text-red-700 border border-red-200',
                      HARSH_BRAKING: 'bg-red-50 text-red-700 border border-red-200',
                      SHARP_TURN: 'bg-amber-50 text-amber-700 border border-amber-200',
                      DEVICE_OFFLINE: 'bg-gray-100 text-gray-700',
                      BATTERY_LOW: 'bg-amber-50 text-amber-700 border border-amber-200',
                      GPS_LOST: 'bg-amber-50 text-amber-700 border border-amber-200',
                      SOS: 'bg-red-50 text-red-700 border border-red-200',
                    };
                    return (
                      <div key={ev.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50">
                        <span className={`mt-0.5 shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${colorMap[ev.eventType] ?? 'bg-gray-100 text-gray-700'}`}>
                          {ev.eventType.replace('_', ' ')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-500 font-mono">
                            {ev.speed != null ? `${ev.speed.toFixed(1)} km/h · ` : ''}{ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)}
                          </p>
                          <p className="text-[10px] text-gray-500">{new Date(ev.eventTime).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>


      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MOBILE BOTTOM NAV BAR  (md:hidden) — fixed, always visible
      ══════════════════════════════════════════════════════════════════ */}
      <div className={`md:hidden fixed bottom-0 inset-x-0 z-[200] shrink-0 ${activePanel ? 'hidden' : 'flex'} items-stretch border-t border-gray-200 bg-white shadow-lg`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {([
          { id: null            , Icon: MapPin,       label: 'Map',     badge: null          },
          { id: 'history'       , Icon: Sheet,        label: 'History', badge: hasLoaded && totalElements > 0 ? totalElements : null },
          { id: 'geofences'     , Icon: Shield,       label: 'Fences',  badge: geoTotal > 0 ? geoTotal : null },
          { id: 'events'        , Icon: Activity,     label: 'Events',  badge: geoEventsTotal > 0 ? geoEventsTotal : null },
          { id: 'trips'         , Icon: Route,        label: 'Trips',   badge: tripsTotal > 0 ? tripsTotal : null },
          { id: 'alerts'        , Icon: AlertTriangle,label: 'Alerts',  badge: trackEventsTotal > 0 ? trackEventsTotal : null },
        ] as { id: typeof activePanel; Icon: React.ComponentType<{className?: string}>; label: string; badge: number | null }[]).map(({ id, Icon, label, badge }) => {
          const isActive = activePanel === id;
          return (
            <button key={label} onClick={() => setActivePanel(id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 relative transition-colors min-w-0 ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>
              {isActive && <span className="absolute top-0 inset-x-0 h-0.5 rounded-full bg-blue-600" />}
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`} />
                {badge != null && (
                  <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] flex items-center justify-center bg-primary text-white text-[8px] font-bold rounded-full px-0.5">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-semibold tracking-wide truncate w-full text-center px-0.5 ${isActive ? 'text-blue-700' : ''}`}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Universal panel overlay (desktop: right slide-in · mobile: native bottom sheet) ── */}
      {activePanel && (
        <div className="fixed inset-0 z-[9999] flex flex-col md:flex-row" onClick={() => setActivePanel(null)}>
          {/* Backdrop — full on mobile (bottom sheet), partial on desktop */}
          <div className="flex-1 bg-black/30" />
          {/* Panel — native bottom sheet on mobile, right-side drawer on desktop */}
          <div
            className="w-full md:max-w-2xl flex flex-col bg-white shadow-lg rounded-t-lg md:rounded-none md:border-l border-gray-200 animate-in md:slide-in-from-right-8 slide-in-from-bottom-8 duration-300 max-h-[88vh] md:max-h-full"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — mobile only */}
            <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* ── Panel header ─── */}
            <div className="shrink-0 flex items-center gap-3 px-5 md:px-6 py-3.5 md:py-4 border-b border-gray-200 bg-white">
              {activePanel === 'history' && <><Sheet className="w-5 h-5 text-blue-700" /><h2 className="text-base font-semibold text-gray-900 flex-1">History Filters</h2></>}
              {activePanel === 'geofences' && <><Shield className="w-5 h-5 text-blue-700" /><h2 className="text-base font-semibold text-gray-900 flex-1">Geofences</h2>{geoTotal > 0 && <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold">{geoTotal}</span>}</>}
              {activePanel === 'events' && <><Activity className="w-5 h-5 text-blue-700" /><h2 className="text-base font-semibold text-gray-900 flex-1">Geofence Events</h2>{geoEventsTotal > 0 && <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold">{geoEventsTotal}</span>}</>}
              {activePanel === 'trips' && <><Route className="w-5 h-5 text-blue-700" /><h2 className="text-base font-semibold text-gray-900 flex-1">Trips</h2>{tripsTotal > 0 && <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold">{tripsTotal}</span>}</>}
              {activePanel === 'alerts' && <><AlertTriangle className="w-5 h-5 text-amber-600" /><h2 className="text-base font-semibold text-gray-900 flex-1">Tracking Alerts</h2>{trackEventsTotal > 0 && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-semibold">{trackEventsTotal}</span>}</>}
              <button onClick={() => setActivePanel(null)}
                className="ml-2 p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── History panel ─── */}
            {activePanel === 'history' && (
              <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="shrink-0 px-6 py-5 space-y-4 border-b border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1.5 uppercase tracking-wide">From</label>
                      <input type="datetime-local" step="1" value={fromDt} onChange={(e) => setFromDt(e.target.value)}
                        className="w-full h-9 bg-white border border-gray-300 rounded-md px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1.5 uppercase tracking-wide">To</label>
                      <input type="datetime-local" step="1" value={toDt} onChange={(e) => setToDt(e.target.value)}
                        className="w-full h-9 bg-white border border-gray-300 rounded-md px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => loadHistoryPage(0)} disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 shadow-sm">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Search History
                    </button>
                    <button onClick={exportAllToExcel} disabled={loading || !hasLoaded || totalElements === 0}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
                      <Download className="w-4 h-4" /> Excel
                    </button>
                    <button onClick={() => { setUploadModal(true); setUploadMsg(null); setUploadJson(''); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-semibold hover:bg-gray-50 transition-colors">
                      <Upload className="w-4 h-4" />
                    </button>
                  </div>
                  {hasLoaded && totalElements > 0 && (
                    <p className="text-sm text-gray-500">
                      <span className="font-semibold text-gray-900">{totalElements.toLocaleString()}</span> route records
                    </p>
                  )}
                  {historySummaryInline}
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  {loading && <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}
                  {!loading && hasLoaded && points.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <MapPin className="w-10 h-10 mb-3 opacity-25" />
                      <p className="text-sm">No location data for selected range</p>
                    </div>
                  )}
                  <div className="divide-y divide-gray-100">
                    {sortedHistoryPoints.map((p, i) => (
                      <div key={`${p.id}-${p.localPrimaryId ?? 'na'}-${i}`} className="flex items-start gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setCenterTarget([p.latitude, p.longitude]);
                          setPinnedMarker({ lat: p.latitude, lng: p.longitude, title: p.reason || 'Location Point', detail: `${p.speed != null ? p.speed.toFixed(1) + ' km/h · ' : ''}${formatDateTimeWithMillis(p.receivedAt)}`, color: getPointColor(p.reason) });
                          setActivePanel(null);
                        }}>
                        <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: getPointColor(p.reason) }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{p.reason || 'Location point'}</p>
                            <span className="text-xs text-gray-500 shrink-0">{p.speed != null ? `${p.speed.toFixed(1)} km/h` : ''}</span>
                          </div>
                          <p className="text-xs font-mono text-gray-500">{p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{formatDateTimeWithMillis(p.receivedAt)}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0 pt-1">#{page * pageSize + i + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {hasLoaded && (
                  <div className="shrink-0 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2 text-gray-500">
                      <span className="font-semibold text-gray-900">{totalElements.toLocaleString()}</span>
                      <span>records</span>
                      <span className="h-1 w-1 rounded-full bg-gray-300" />
                      <span>Page {historyCurrentPageLabel} / {historyPageCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => loadHistoryPage(page - 1)}
                        disabled={!canHistoryPrev || loading}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-35"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => loadHistoryPage(page + 1)}
                        disabled={!canHistoryNext || loading}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-35"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Geofences panel ─── */}
            {activePanel === 'geofences' && (
              <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                {/* Toolbar */}
                <div className="shrink-0 flex items-center gap-2 px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <button onClick={() => setShowGeoOnMap((v) => !v)} title={showGeoOnMap ? 'Hide on map' : 'Show on map'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${showGeoOnMap ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-500 border border-transparent'}`}>
                    <Shield className="w-3.5 h-3.5" /> {showGeoOnMap ? 'Visible on map' : 'Hidden from map'}
                  </button>
                  <button onClick={() => fetchGeofences(geoPage)} disabled={geoLoading}
                    className="p-2 rounded-md text-gray-500 hover:bg-gray-200 transition-colors">
                    {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                  <div className="flex-1" />
                  {draw.phase === 'idle' && (
                    <button onClick={() => setDraw((d) => ({ ...d, phase: 'type-select' }))}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm">
                      <Plus className="w-4 h-4" /> Add Geofence
                    </button>
                  )}
                  {draw.phase !== 'idle' && (
                    <button onClick={cancelDraw}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-700 rounded-md text-sm font-semibold hover:bg-red-50 transition-colors">
                      <X className="w-4 h-4" /> Cancel Drawing
                    </button>
                  )}
                </div>

                {/* Type selector */}
                {draw.phase === 'type-select' && (
                  <div className="shrink-0 px-6 py-5 border-b border-gray-200 space-y-3">
                    <p className="text-sm text-gray-500">Select a shape to draw on the map</p>
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={() => startDraw('CIRCLE')}
                        className="flex flex-col items-center gap-2 py-5 bg-white border border-gray-300 rounded-lg text-blue-700 hover:bg-blue-50 active:scale-95 transition-all">
                        <div className="w-9 h-9 rounded-full border-2 border-blue-600" />
                        <span className="text-sm font-semibold">Circle</span>
                      </button>
                      <button onClick={() => startDraw('POLYGON')}
                        className="flex flex-col items-center gap-2 py-5 bg-white border border-gray-300 rounded-lg text-blue-700 hover:bg-blue-50 active:scale-95 transition-all">
                        <svg width="36" height="36" viewBox="0 0 32 32"><polygon points="16,2 30,22 24,30 8,30 2,22" fill="none" stroke="#1d4ed8" strokeWidth="2.5"/></svg>
                        <span className="text-sm font-semibold">Polygon</span>
                      </button>
                      <button onClick={() => startDraw('LINE')}
                        className="flex flex-col items-center gap-2 py-5 bg-white border border-gray-300 rounded-lg text-blue-700 hover:bg-blue-50 active:scale-95 transition-all">
                        <svg width="36" height="36" viewBox="0 0 32 32"><path d="M4 26 L14 10 L24 18 L30 6" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 26 L14 10 L24 18 L30 6" fill="none" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.18"/></svg>
                        <span className="text-sm font-semibold">Line</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Drawing active */}
                {(draw.phase === 'circle-center' || draw.phase === 'circle-radius' || draw.phase === 'polygon' || draw.phase === 'line') && (
                  <div className="shrink-0 px-6 py-4 border-b border-gray-200 space-y-3">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-md border"
                      style={{ borderColor: `${GEO_COLOR[draw.type]}40`, background: `${GEO_COLOR[draw.type]}10` }}>
                      <MousePointer2 className="w-5 h-5 shrink-0" style={{ color: GEO_COLOR[draw.type] }} />
                      <p className="text-sm font-medium text-gray-700">
                        {draw.phase === 'circle-center' && 'Click on the map to place the center point'}
                        {draw.phase === 'circle-radius' && `Click to set radius${liveRadius ? ` · ${liveRadius.toLocaleString()}m` : ''}`}
                        {draw.phase === 'polygon' && `${draw.polygonPts.length} point${draw.polygonPts.length !== 1 ? 's' : ''} placed${draw.polygonPts.length >= 3 ? ' · Ready to finish' : ' · Need 3+ points'}`}
                        {draw.phase === 'line' && `${draw.polygonPts.length} waypoint${draw.polygonPts.length !== 1 ? 's' : ''} placed${draw.polygonPts.length >= 2 ? ' · Ready to finish' : ' · Need 2+ points'}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {(draw.phase === 'polygon' || draw.phase === 'line') && (
                        <button onClick={undoLastPolygonPt} disabled={draw.polygonPts.length === 0}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 transition-colors">
                          <Undo2 className="w-4 h-4" /> Undo
                        </button>
                      )}
                      {draw.phase === 'polygon' && (
                        <button onClick={finishPolygon} disabled={draw.polygonPts.length < 3}
                          className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-colors disabled:opacity-40 bg-primary text-white hover:bg-primary-hover shadow-sm">
                          <Check className="w-4 h-4" /> Finish Polygon
                        </button>
                      )}
                      {draw.phase === 'line' && (
                        <button onClick={finishLine} disabled={draw.polygonPts.length < 2}
                          className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-colors disabled:opacity-40 bg-primary text-white hover:bg-primary-hover shadow-sm">
                          <Check className="w-4 h-4" /> Finish Line
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Confirm phase */}
                {draw.phase === 'confirm' && (
                  <div className="shrink-0 px-6 py-5 border-b border-gray-200 space-y-4">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-gray-50 border border-gray-200">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: GEO_COLOR[draw.type] }} />
                      <p className="flex-1 text-sm text-gray-600 truncate">
                        {draw.type === 'CIRCLE' ? `Circle · r=${draw.circleRadius}m` : draw.type === 'LINE' ? `Line · ${draw.polygonPts.length} waypoints` : `Polygon · ${draw.polygonPts.length} points`}
                      </p>
                      <button onClick={() => setDraw((d) => ({ ...d, phase: d.type === 'CIRCLE' ? 'circle-center' : d.type === 'POLYGON' ? 'polygon' : 'line', circleCenter: null, circleRadius: null, polygonPts: [], mousePos: null }))}
                        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors">
                        <Undo2 className="w-3.5 h-3.5" /> Redraw
                      </button>
                    </div>
                    <input autoFocus value={draw.name} onChange={(e) => setDraw((d) => ({ ...d, name: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter' && draw.name.trim()) saveGeofence(); if (e.key === 'Escape') cancelDraw(); }}
                      placeholder="Geofence name…"
                      className="w-full h-9 bg-white border border-gray-300 rounded-md px-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-400" />
                    {(draw.type === 'LINE' || draw.type === 'CIRCLE') && (
                      <div className="flex items-center gap-4 bg-gray-50 rounded-md px-4 py-3 border border-gray-200">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-700">Buffer Zone</p>
                          <p className="text-xs text-gray-500">{draw.type === 'LINE' ? 'Corridor width on each side' : 'Extra zone outside radius'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" step="10" value={draw.bufferMeters || ''} onChange={(e) => setDraw((d) => ({ ...d, bufferMeters: Number(e.target.value) || 0 }))} placeholder="0"
                            className="w-20 bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary" />
                          <span className="text-sm text-gray-500">m</span>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button onClick={cancelDraw}
                        className="px-5 py-2.5 rounded-md text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button onClick={saveGeofence} disabled={geoSaving || !draw.name.trim()}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 ${draw.type === 'CIRCLE' ? 'bg-primary text-white hover:bg-primary-hover shadow-sm' : draw.type === 'POLYGON' ? 'bg-primary text-white hover:bg-primary-hover shadow-sm' : 'bg-primary text-white hover:bg-primary-hover shadow-sm'}`}>
                        {geoSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {draw.editId != null ? 'Update Geofence' : 'Save Geofence'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Geofence list */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {geoLoading && <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>}
                  {!geoLoading && geofences.length === 0 && draw.phase === 'idle' && (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Shield className="w-10 h-10 mb-3 opacity-20" />
                      <p className="text-sm">No geofences yet</p>
                      <p className="text-xs mt-1 text-center">Click "Add Geofence" to draw one on the map</p>
                    </div>
                  )}
                  <div className="divide-y divide-gray-100">
                    {geofences.map((g) => (
                      <div key={g.id} className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => {
                          const center = geofenceCenter(g);
                          if (center) {
                            setCenterTarget(center);
                            setPinnedMarker({ lat: center[0], lng: center[1], title: g.name, detail: `${g.type}${g.radiusMeters ? ` · ${g.radiusMeters}m radius` : ''}${g.bufferMeters ? ` · buffer ${g.bufferMeters}m` : ''}`, color: GEO_COLOR[g.type] });
                            setActivePanel(null);
                          }
                        }}>
                        <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${GEO_COLOR[g.type]}20`, border: `2px solid ${GEO_COLOR[g.type]}60` }}>
                          <div className="w-3.5 h-3.5 rounded-full" style={{ background: GEO_COLOR[g.type] }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{g.name}</p>
                          <p className="text-xs text-gray-500">
                            {g.type}{g.type === 'CIRCLE' && g.radiusMeters ? ` · ${g.radiusMeters}m radius` : ''}
                            {g.bufferMeters ? ` · buffer ${g.bufferMeters}m` : ''}
                          </p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${g.active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700'}`}>
                          {g.active ? 'Active' : 'Inactive'}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); startDraw(g.type, g); }}
                          className="p-2.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteGeofence(g.id); }} disabled={geoDeleting === g.id}
                          className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40">
                          {geoDeleting === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                {geoTotalPages > 1 && (
                  <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-gray-200">
                    <button onClick={() => fetchGeofences(geoPage - 1)} disabled={geoPage === 0 || geoLoading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    <span className="text-sm text-gray-500">{geoPage + 1} / {geoTotalPages}</span>
                    <button onClick={() => fetchGeofences(geoPage + 1)} disabled={geoPage >= geoTotalPages - 1 || geoLoading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Events panel ─── */}
            {activePanel === 'events' && (
              <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-500">ENTER / EXIT boundary events</p>
                  <button onClick={() => fetchGeoEvents(0)} disabled={geoEventsLoading}
                    className="p-2 rounded-md text-gray-500 hover:bg-gray-200 transition-colors">
                    {geoEventsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  {geoEventsLoading && <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>}
                  {!geoEventsLoading && geoEvents.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Activity className="w-10 h-10 mb-3 opacity-20" />
                      <p className="text-sm">No events yet</p>
                      <p className="text-xs mt-1">ENTER / EXIT events appear here as they occur</p>
                    </div>
                  )}
                  <div className="divide-y divide-gray-100">
                    {geoEvents.map((ev) => (
                      <div key={ev.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setCenterTarget([ev.latitude, ev.longitude]);
                          setPinnedMarker({ lat: ev.latitude, lng: ev.longitude, title: `${ev.eventType}: ${ev.geofenceName}`, detail: new Date(ev.eventTime).toLocaleString(), color: ev.eventType === 'ENTER' ? '#16a34a' : '#dc2626' });
                          setActivePanel(null);
                        }}>
                        <span className={`mt-0.5 shrink-0 text-xs font-bold px-2.5 py-1 rounded-md ${ev.eventType === 'ENTER' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                          {ev.eventType}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{ev.geofenceName}</p>
                          <p className="text-xs font-mono text-gray-500 mt-0.5">{ev.latitude.toFixed(6)}, {ev.longitude.toFixed(6)}</p>
                          <p className="text-xs text-gray-500 mt-1">{new Date(ev.eventTime).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {geoEventsTotalPages > 1 && (
                  <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-gray-200">
                    <button onClick={() => fetchGeoEvents(geoEventsPage - 1)} disabled={geoEventsPage === 0 || geoEventsLoading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    <span className="text-sm text-gray-500">{geoEventsPage + 1} / {geoEventsTotalPages}</span>
                    <button onClick={() => fetchGeoEvents(geoEventsPage + 1)} disabled={geoEventsPage >= geoEventsTotalPages - 1 || geoEventsLoading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Trips panel ─── */}
            {activePanel === 'trips' && (
              <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-500">Detected journeys in the selected range</p>
                  <button onClick={() => fetchTrips(0)} disabled={tripsLoading}
                    className="p-2 rounded-md text-gray-500 hover:bg-gray-200 transition-colors">
                    {tripsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  {tripsLoading && <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>}
                  {!tripsLoading && trips.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Route className="w-10 h-10 mb-3 opacity-20" />
                      <p className="text-sm">No trips found</p>
                      <p className="text-xs mt-1">Search history first to populate trips</p>
                    </div>
                  )}
                  <div className="divide-y divide-gray-100">
                    {trips.map((trip) => (
                      <div key={trip.id}
                        className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-blue-50 ${selectedTrip?.id === trip.id ? 'bg-blue-50' : ''}`}
                        onClick={() => {
                          setSelectedTrip(selectedTrip?.id === trip.id ? null : trip);
                          if (trip.startLat && trip.startLng) {
                            setCenterTarget([trip.startLat, trip.startLng]);
                            setPinnedMarker({ lat: trip.startLat, lng: trip.startLng, title: `Trip — ${new Date(trip.startTime).toLocaleTimeString()} → ${trip.endTime ? new Date(trip.endTime).toLocaleTimeString() : '…'}`, detail: `${trip.totalDistanceMeters >= 1000 ? (trip.totalDistanceMeters / 1000).toFixed(2) + ' km' : Math.round(trip.totalDistanceMeters) + ' m'} · avg ${trip.avgSpeedKmh.toFixed(1)} km/h · max ${trip.maxSpeedKmh.toFixed(0)} km/h`, color: '#2563eb' });
                          }
                          setActivePanel(null);
                        }}>
                        <div className={`w-3 h-3 rounded-full shrink-0 ${trip.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {new Date(trip.startTime).toLocaleTimeString()} → {trip.endTime ? new Date(trip.endTime).toLocaleTimeString() : '…'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {trip.totalDistanceMeters >= 1000 ? `${(trip.totalDistanceMeters / 1000).toFixed(2)} km` : `${Math.round(trip.totalDistanceMeters)} m`}
                            {' '}· avg {trip.avgSpeedKmh.toFixed(1)} km/h · max {trip.maxSpeedKmh.toFixed(0)} km/h
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{new Date(trip.startTime).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md shrink-0 ${trip.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700'}`}>
                          {trip.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Alerts panel ─── */}
            {activePanel === 'alerts' && (
              <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-500">Speed, braking, and safety events</p>
                  <button onClick={fetchTrackEvents} disabled={trackEventsLoading}
                    className="p-2 rounded-md text-gray-500 hover:bg-gray-200 transition-colors">
                    {trackEventsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  {trackEventsLoading && <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>}
                  {!trackEventsLoading && trackEvents.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <AlertTriangle className="w-10 h-10 mb-3 opacity-20" />
                      <p className="text-sm">No alerts detected</p>
                      <p className="text-xs mt-1">Overspeeding, braking, and other events appear here</p>
                    </div>
                  )}
                  <div className="divide-y divide-gray-100">
                    {trackEvents.map((ev) => {
                      const colorMap: Record<string, string> = {
                        OVERSPEEDING: 'bg-red-50 text-red-700 border border-red-200',
                        HARSH_BRAKING: 'bg-red-50 text-red-700 border border-red-200',
                        SHARP_TURN: 'bg-amber-50 text-amber-700 border border-amber-200',
                        DEVICE_OFFLINE: 'bg-gray-100 text-gray-700',
                        BATTERY_LOW: 'bg-amber-50 text-amber-700 border border-amber-200',
                        GPS_LOST: 'bg-amber-50 text-amber-700 border border-amber-200',
                        SOS: 'bg-red-50 text-red-700 border border-red-200',
                      };
                      const pinColorMap: Record<string, string> = {
                        OVERSPEEDING: '#dc2626', HARSH_BRAKING: '#dc2626', SHARP_TURN: '#d97706',
                        DEVICE_OFFLINE: '#9ca3af', BATTERY_LOW: '#d97706', GPS_LOST: '#d97706', SOS: '#dc2626',
                      };
                      return (
                        <div key={ev.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => {
                            setCenterTarget([ev.latitude, ev.longitude]);
                            setPinnedMarker({ lat: ev.latitude, lng: ev.longitude, title: ev.eventType.replace(/_/g, ' '), detail: `${ev.speed != null ? ev.speed.toFixed(1) + ' km/h · ' : ''}${new Date(ev.eventTime).toLocaleString()}`, color: pinColorMap[ev.eventType] ?? '#d97706' });
                            setActivePanel(null);
                          }}>
                          <span className={`mt-0.5 shrink-0 text-xs font-bold px-2.5 py-1 rounded-md whitespace-nowrap ${colorMap[ev.eventType] ?? 'bg-gray-100 text-gray-700'}`}>
                            {ev.eventType.replace(/_/g, ' ')}
                          </span>
                          <div className="flex-1 min-w-0">
                            {ev.speed != null && <p className="text-sm font-semibold text-gray-900">{ev.speed.toFixed(1)} km/h</p>}
                            <p className="text-xs font-mono text-gray-500">{ev.latitude.toFixed(6)}, {ev.longitude.toFixed(6)}</p>
                            <p className="text-xs text-gray-500 mt-1">{new Date(ev.eventTime).toLocaleString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Mobile in-overlay bottom nav (switch sections without closing) ── */}
            <div className="md:hidden shrink-0 flex items-stretch border-t border-gray-200 bg-white">
              {([
                { id: null        , Icon: MapPin,        label: 'Map'     },
                { id: 'history'   , Icon: Sheet,         label: 'History' },
                { id: 'geofences' , Icon: Shield,        label: 'Fences'  },
                { id: 'events'    , Icon: Activity,      label: 'Events'  },
                { id: 'trips'     , Icon: Route,         label: 'Trips'   },
                { id: 'alerts'    , Icon: AlertTriangle, label: 'Alerts'  },
              ] as { id: typeof activePanel; Icon: React.ComponentType<{className?: string}>; label: string }[]).map(({ id, Icon, label }) => {
                const isActive = activePanel === id;
                return (
                  <button key={label} onClick={() => setActivePanel(id)}
                    className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 relative min-w-0 transition-colors ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>
                    {isActive && <span className="absolute top-0 inset-x-0 h-0.5 rounded-full bg-blue-600" />}
                    <Icon className={`w-4.5 h-4.5 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`} />
                    <span className={`text-[9px] font-semibold truncate w-full text-center px-0.5 ${isActive ? 'text-blue-700' : ''}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Tracking config modal ────────────────────────────────────────── */}
      {configModal && (
        <div
          className="fixed inset-0 z-[2000] overflow-y-auto bg-black/30 px-0 py-0 md:px-6 md:py-8 animate-in fade-in-0 duration-200"
          onClick={() => {
            if (!configEditing && !configSaving) closeConfigModal();
          }}
        >
          <div className="flex min-h-full items-end justify-center md:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tracking-config-title"
              onClick={(event) => event.stopPropagation()}
              className="relative flex h-[100svh] w-full flex-col overflow-hidden border border-gray-200 bg-white shadow-lg md:h-auto md:max-h-[92vh] md:max-w-5xl md:rounded-lg animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300"
            >
              <div className="pointer-events-none absolute -left-20 top-16 h-56 w-56 rounded-full" />
              <div className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full" />
              <div className="pointer-events-none absolute bottom-0 right-10 h-56 w-56 rounded-full" />

              <div className="relative shrink-0 border-b border-gray-200 bg-white">
                <div className="absolute inset-x-0 top-0 h-px bg-gray-200" />
                <div className="flex flex-col gap-4 px-5 py-5 md:px-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
                      <Settings className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 shadow-sm">
                          Tracking Control Center
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${configEditing ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
                          {configEditing ? 'Edit mode' : 'Live view'}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {TRACKING_CONFIG_FIELD_COUNT} parameters
                        </span>
                      </div>
                      <h2 id="tracking-config-title" className="mt-3 text-xl font-semibold tracking-tight text-gray-900">
                        Tracking Configuration
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        <span className="font-semibold text-gray-900">{device?.deviceName ?? 'Unknown device'}</span>
                        <span className="mx-2 text-gray-300">/</span>
                        <span className="font-mono text-xs break-all">{deviceUuid ?? 'Device UUID unavailable'}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!configEditing && configData && (
                        <button
                          onClick={startConfigEditing}
                          className="hidden sm:inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                          Edit Configuration
                        </button>
                      )}
                      <button
                        onClick={closeConfigModal}
                        disabled={configSaving}
                        aria-label="Close tracking configuration"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative flex-1 overflow-y-auto min-h-0">
                {configLoading ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
                      <div className="absolute inset-0 rounded-full" />
                      <Loader2 className="relative h-8 w-8 animate-spin text-blue-600" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-base font-semibold text-gray-900">Loading live configuration</p>
                      <p className="text-sm text-gray-500">Pulling the latest tracking profile and preparing the control surface.</p>
                    </div>
                  </div>
                ) : configData ? (
                  <div className="space-y-6 px-5 pb-6 pt-5 md:px-6 md:pb-7">
                    <section className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:p-6">
                      <div className="pointer-events-none absolute -left-10 top-0 h-44 w-44 rounded-full" />
                      <div className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full" />
                      <div className="relative space-y-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="max-w-3xl">
                            <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                              Tracking overview
                            </div>
                            <h3 className="mt-4 text-xl font-semibold tracking-tight text-gray-900">
                              Current tracking profile
                            </h3>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
                              {configEditing
                                ? 'You are editing the live values below. The summary updates instantly so the draft stays easy to review.'
                                : 'This top section shows the key live values at a glance. Open edit mode to change timers, thresholds, GPS rules, and endpoint settings.'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 xl:max-w-sm xl:justify-end">
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600">
                              {configEditing ? 'Draft preview' : 'Live values'}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600">
                              {TRACKING_CONFIG_SECTIONS.length} groups
                            </span>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600">
                              {TRACKING_CONFIG_FIELD_COUNT} settings
                            </span>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {configHeroStats.map(({ label, value, unit, detail, Icon, accentClassName }) => (
                            <div
                              key={label}
                              className={`rounded-lg border border-gray-200 bg-gray-50 ${accentClassName} px-4 py-4`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                                  <p className={`mt-2 font-semibold tracking-tight text-gray-900 ${String(value).length > 18 ? 'text-base break-all md:text-lg' : 'text-2xl'}`}>
                                    {value}
                                    {unit && <span className="ml-1.5 text-sm font-medium text-gray-500">{unit}</span>}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p>
                                </div>
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                                  <Icon className="h-4 w-4" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>

                    {configEditing ? (
                      <div className="space-y-5">
                        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="max-w-2xl">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Draft workspace</p>
                              <h4 className="mt-2 text-lg font-semibold text-gray-900">Fine-tune the device profile before you push it.</h4>
                              <p className="mt-1 text-sm leading-6 text-gray-500">
                                Each change is saved to the database and then delivered to the device through MQTT as soon as you hit save.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {['Database saved', 'MQTT pushed', 'Esc exits draft'].map((item) => (
                                <span
                                  key={item}
                                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        </section>

                        {TRACKING_CONFIG_SECTIONS.map((section) => {
                          const SectionIcon = section.icon;
                          return (
                            <section
                              key={section.id}
                              className={`relative overflow-hidden rounded-lg border p-5 shadow-sm ${section.surfaceClassName}`}
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex items-start gap-3">
                                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${section.iconClassName}`}>
                                    <SectionIcon className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{section.eyebrow}</p>
                                    <h4 className="mt-1 text-lg font-semibold text-gray-900">{section.title}</h4>
                                    <p className="mt-1 text-sm leading-6 text-gray-600">{section.description}</p>
                                  </div>
                                </div>
                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${section.badgeClassName}`}>
                                  {section.fields.length} controls
                                </span>
                              </div>

                              <div className={`mt-5 grid gap-3 ${section.gridClassName}`}>
                                {section.fields.map((field) => {
                                  const isTextField = field.inputType === 'text';
                                  const fieldValue = configForm[field.key];

                                  return (
                                    <div
                                      key={field.key}
                                      className={`rounded-lg border border-gray-200 bg-gray-50 p-4 ${field.cardSpanClassName ?? ''}`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">{field.label}</label>
                                          <p className="mt-1 text-sm leading-6 text-gray-500">{field.description}</p>
                                        </div>
                                        {field.unit && !isTextField && (
                                          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                            {field.unit}
                                          </span>
                                        )}
                                      </div>

                                      {isTextField ? (
                                        <div className="mt-4 space-y-2">
                                          <input
                                            type="text"
                                            placeholder={field.placeholder}
                                            value={(fieldValue as string | undefined) ?? ''}
                                            onChange={(event) => setConfigForm((current) => ({ ...current, [field.key]: event.target.value }))}
                                            className="h-9 w-full rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-primary"
                                          />
                                          <p className="text-xs text-gray-500">Leave blank to keep the platform default endpoint.</p>
                                        </div>
                                      ) : (
                                        <div className="mt-4 flex items-center gap-3">
                                          <input
                                            type="number"
                                            min={field.min ?? 0}
                                            step={field.step ?? 1}
                                            placeholder="Auto"
                                            value={(fieldValue as number | undefined) ?? ''}
                                            onChange={(event) => setConfigForm((current) => ({
                                              ...current,
                                              [field.key]: event.target.value === '' ? undefined : Number(event.target.value),
                                            }))}
                                            className="h-9 w-full rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:ring-2 focus:ring-primary"
                                          />
                                          {field.unit && (
                                            <span className="shrink-0 rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                              {field.unit}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {TRACKING_CONFIG_SECTIONS.map((section) => {
                          const SectionIcon = section.icon;

                          return (
                            <section
                              key={section.id}
                              className={`relative overflow-hidden rounded-lg border p-5 shadow-sm ${section.surfaceClassName}`}
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex items-start gap-3">
                                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${section.iconClassName}`}>
                                    <SectionIcon className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{section.eyebrow}</p>
                                    <h4 className="mt-1 text-lg font-semibold text-gray-900">{section.title}</h4>
                                    <p className="mt-1 text-sm leading-6 text-gray-600">{section.description}</p>
                                  </div>
                                </div>
                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${section.badgeClassName}`}>
                                  {section.fields.length} controls
                                </span>
                              </div>

                              <div className={`mt-5 grid gap-3 ${section.gridClassName}`}>
                                {section.fields.map((field) => {
                                  const value = getTrackingConfigValue(configData, field.key);
                                  const isEmpty = value === undefined || value === null || value === '';
                                  const isTextField = field.inputType === 'text';

                                  return (
                                    <div
                                      key={field.key}
                                      className={`group rounded-lg border border-gray-200 bg-gray-50 p-4 ${field.cardSpanClassName ?? ''}`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{field.label}</p>
                                          <p className="mt-1 text-sm leading-6 text-gray-500">{field.description}</p>
                                        </div>
                                        {field.unit && !isTextField && (
                                          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                            {field.unit}
                                          </span>
                                        )}
                                      </div>

                                      {isTextField ? (
                                        <div className="mt-4 rounded-md border border-dashed border-gray-300 bg-white px-4 py-3">
                                          <p className={`text-sm ${isEmpty ? 'italic text-gray-400' : 'font-mono font-medium text-gray-900 break-all'}`}>
                                            {isEmpty ? 'Default endpoint is in use.' : String(value)}
                                          </p>
                                        </div>
                                      ) : (
                                        <div className="mt-5 flex items-end gap-2">
                                          <span className={`text-2xl font-semibold tracking-tight ${isEmpty ? 'text-gray-300' : 'text-gray-900'}`}>
                                            {isEmpty ? '—' : value}
                                          </span>
                                          {field.unit && <span className="pb-1 text-sm font-medium text-gray-500">{field.unit}</span>}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-[420px] flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm">
                      <Settings className="h-9 w-9 text-gray-300" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-gray-900">Configuration unavailable</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
                      We could not find a tracking configuration for this device yet. Try again after the backend publishes one for the selected tracker.
                    </p>
                  </div>
                )}
              </div>

              <div className="relative shrink-0 border-t border-gray-200 bg-white px-5 py-4 md:px-6">
                {configEditing ? (
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="max-w-2xl text-sm leading-6 text-gray-500">
                      Saving this draft writes the new values to the platform and immediately pushes them to the device.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={cancelConfigEditing}
                        disabled={configSaving}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Discard Draft
                      </button>
                      <button
                        onClick={saveConfig}
                        disabled={configSaving}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {configSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Save &amp; Push to Device
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="max-w-2xl text-sm leading-6 text-gray-500">
                      Live values are grouped here for quick review. Open edit mode when you want to send a polished update to the device.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      {device && configData && (
                        <button
                          onClick={() => setIsHeartbeatApplyMoreOpen(true)}
                          className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
                          title="Push this heartbeat interval to groups or other devices"
                        >
                          Apply heartbeat to more devices…
                        </button>
                      )}
                      <button
                        onClick={closeConfigModal}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Close
                      </button>
                      <button
                        onClick={startConfigEditing}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        Edit Configuration
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk upload modal ─────────────────────────────────────────────── */}
      {uploadModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700/50">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Bulk Upload GPS Data</p>
              <button onClick={() => setUploadModal(false)} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-500 dark:text-slate-400">Paste a JSON array of tracking point objects.</p>
              <textarea rows={10} value={uploadJson} onChange={(e) => setUploadJson(e.target.value)}
                placeholder={'[\n  {\n    "latitude": 33.684,\n    "longitude": 73.047,\n    "speed": 0,\n    "reason": "Distance",\n    ...\n  }\n]'}
                className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs text-gray-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 placeholder-gray-400 dark:placeholder-slate-500 resize-none" />
              {uploadMsg && (
                <div className={`text-xs px-3 py-2 rounded-lg ${uploadMsg.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
                  {uploadMsg.text}
                </div>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setUploadModal(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-700/50 rounded-xl text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">Close</button>
              <button onClick={handleBulkUpload} disabled={uploading || !uploadJson.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-600/25 transition-colors disabled:opacity-50">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
              </button>
            </div>
          </div>
        </div>
      )}
      {isHeartbeatApplyMoreOpen && device && (
        <BulkHeartbeatModal
          devices={devices ?? []}
          lockedDeviceUuids={[device.deviceUuid]}
          initialSeconds={configData?.heartbeatTimer ?? undefined}
          onClose={() => setIsHeartbeatApplyMoreOpen(false)}
        />
      )}
    </div>
  );
}


// ── Point hover popup ─────────────────────────────────────────────────────────
function PointPopup({ point, color, label }: { point: HistoryPoint; color: string; label?: string }) {
  if (!point) return null;
  const rows: [string, string][] = [
    ['Received At', formatDateTimeWithMillis(point.receivedAt)],
    ['Latitude',    point.latitude?.toFixed(6) ?? '-'],
    ['Longitude',   point.longitude?.toFixed(6) ?? '-'],
    ['Speed',       point.speed != null ? `${point.speed.toFixed(1)} km/h` : '-'],
    ['Accuracy',    point.accuracy != null ? `±${point.accuracy.toFixed(0)} m` : '-'],
    ['Altitude',    point.altitude != null ? `${point.altitude.toFixed(0)} m` : '-'],
    ['Bearing',     point.bearing != null ? `${point.bearing.toFixed(1)}°` : '-'],
    ['Satellites',  `${point.connectedSatellite ?? '-'} / ${point.availableSatellite ?? '-'}`],
    ['Provider',    point.provider || '-'],
    ['IG Status',   point.igStatus === 1 ? 'ON' : 'OFF'],
    ['Reason',      point.reason || '-'],
  ];
  return (
    <div style={{ fontFamily: 'system-ui,sans-serif', minWidth: 210 }}>
      <div style={{ background: color, borderRadius: '6px 6px 0 0', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', display: 'inline-block', flexShrink: 0 }} />
        <span style={{ color: 'white', fontWeight: 700, fontSize: 11, letterSpacing: '0.05em' }}>
          {label ?? point.reason?.toUpperCase() ?? 'LOCATION'}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '3px 6px', color: '#64748b', whiteSpace: 'nowrap', fontWeight: 600 }}>{k}</td>
              <td style={{ padding: '3px 6px', color: '#1e293b', fontFamily: k==='Latitude'||k==='Longitude' ? 'monospace' : 'inherit' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Geofence map popup ────────────────────────────────────────────────────────
function GeofencePopup({ geo, onEdit }: { geo: GeofenceData; onEdit: () => void }) {
  return (
    <div style={{ fontFamily: 'system-ui,sans-serif', minWidth: 180 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <strong style={{ fontSize: 12, color: '#1e293b' }}>{geo.name}</strong>
        <span style={{ fontSize: 10, background: geo.active ? '#dcfce7' : '#f1f5f9', color: geo.active ? '#16a34a' : '#64748b', padding: '1px 6px', borderRadius: 4, border: `1px solid ${geo.active ? '#bbf7d0' : '#e2e8f0'}` }}>
          {geo.active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <tbody>
          <tr><td style={{ color:'#64748b',padding:'2px 4px',fontWeight:600 }}>Type</td><td style={{ color:'#1e293b',padding:'2px 4px' }}>{geo.type}</td></tr>
          {geo.type === 'CIRCLE' && geo.radiusMeters != null && (
            <tr><td style={{ color:'#64748b',padding:'2px 4px',fontWeight:600 }}>Radius</td><td style={{ color:'#1e293b',padding:'2px 4px' }}>{geo.radiusMeters}m</td></tr>
          )}
          {geo.type === 'CIRCLE' && geo.centerLat != null && (
            <tr><td style={{ color:'#64748b',padding:'2px 4px',fontWeight:600 }}>Center</td><td style={{ color:'#1e293b',padding:'2px 4px',fontFamily:'monospace',fontSize:10 }}>{geo.centerLat.toFixed(5)}, {geo.centerLng?.toFixed(5)}</td></tr>
          )}
        </tbody>
      </table>
      <button onClick={onEdit}
        style={{ marginTop:8, width:'100%', padding:'5px 0', background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:6, color:'#fbbf24', fontSize:11, fontWeight:600, cursor:'pointer' }}>
        ✏ Edit Geofence
      </button>
    </div>
  );
}
