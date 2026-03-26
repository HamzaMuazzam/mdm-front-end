import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import mqtt, { MqttClient } from 'mqtt';
import {
  ArrowLeft, MapPin, RefreshCw, Loader2, Download,
  ChevronLeft, ChevronRight, Shield, Sheet, LayoutPanelTop,
  Plus, Pencil, Trash2, X, Check, Upload, Undo2, MousePointer2,
  PanelRightClose, PanelRightOpen, Maximize2, Minimize2, Activity,
  Settings, Timer, Gauge, SatelliteDish, Link2, SlidersHorizontal,
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
const startPin = makePin('#22c55e');
const endPin   = makePin('#ef4444');

function getPointColor(reason: string): string {
  const r = (reason ?? '').toLowerCase().trim();
  if (r.includes('moving') || r.includes('drive') || r.includes('motion') || r.includes('start') || r.includes('trip')) return '#22c55e';
  if (r.includes('idle') || r.includes('stop') || r.includes('park') || r.includes('stationary') || r.includes('halt')) return '#ef4444';
  return '#3b82f6';
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
  CIRCLE:  '#f59e0b',   // amber
  POLYGON: '#a855f7',   // purple
  LINE:    '#06b6d4',   // cyan
};

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

// ── Main page ─────────────────────────────────────────────────────────────────
export function DeviceTrackingPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate    = useNavigate();
  const { data: devices } = useDevicesQuery();
  const device      = devices?.find((d) => String(d.id) === deviceId);
  const deviceUuid  = device?.deviceUuid;

  const [rightOpen, setRightOpen]   = useState(true);
  const [tableOpen, setTableOpen]   = useState(true);
  const [leftMode, setLeftMode]     = useState<'split' | 'map' | 'table'>('map');

  // History
  const [fromDt, setFromDt]       = useState(todayStart);
  const [toDt, setToDt]           = useState(todayEnd);
  const [page, setPage]           = useState(0);
  const [pageSize]                = useState(2000);
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

  // Drawing state
  const [draw, setDraw] = useState<DrawState>(BLANK_DRAW);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  // Controls when FitBounds runs — only incremented on history fetch, never on MQTT
  const [fitBoundsKey, setFitBoundsKey]       = useState(0);

  // Live tracking via MQTT
  const [centerTarget, setCenterTarget]       = useState<[number, number] | null>(null);
  const trackingClientRef                     = useRef<MqttClient | null>(null);

  // Bulk upload
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadJson, setUploadJson]   = useState('');
  const [uploading, setUploading]     = useState(false);
  const [uploadMsg, setUploadMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  // Mobile bottom nav
  const [mobileTab, setMobileTab] = useState<'map' | 'history' | 'geofences' | 'events'>('map');

  // Tracking config modal
  const [configModal, setConfigModal]     = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving]   = useState(false);
  const [configData, setConfigData]       = useState<TrackingConfigResponse | null>(null);
  const [configEditing, setConfigEditing] = useState(false);
  const BLANK_CONFIG: TrackingConfigRequest = {
    configurationTimer: undefined, uploadTimer: undefined, movingTimer: undefined,
    stopTimer: undefined, heartbeatTimer: undefined, angleThreshold: undefined,
    overSpeedingThreshold: undefined, distanceThreshold: undefined, retryCounter: undefined,
    setMinUpdateIntervalMillis: undefined, setMinUpdateDistanceMeters: undefined, baseURL: undefined,
  };
  const [configForm, setConfigForm] = useState<TrackingConfigRequest>(BLANK_CONFIG);

  const polyline: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
  const mapCenter: [number, number]  = polyline.length > 0
    ? polyline[Math.floor(polyline.length / 2)] : [33.6844, 73.0479];

  // ── Fetch history ─────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async (pg: number) => {
    if (!deviceUuid) return;
    setLoading(true);
    try {
      const resp = await trackingService.getHistory(deviceUuid, { from: fromDt, to: toDt, page: pg, size: pageSize });
      if (resp.success && resp.data) {
        setPoints(resp.data.content); setTotalPages(resp.data.totalPages); setTotalElements(resp.data.totalElements);
        setFitBoundsKey((k) => k + 1);
      }
    } catch { /**/ } finally { setLoading(false); setHasLoaded(true); }
  }, [deviceUuid, fromDt, toDt, pageSize]);

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

  useEffect(() => { fetchHistory(0); setPage(0); /* eslint-disable-next-line */ }, []);
  useEffect(() => { fetchGeofences(); fetchGeoTypes(); fetchGeoEvents(); }, [fetchGeofences, fetchGeoTypes, fetchGeoEvents]);
  // Mobile: auto-switch tabs during draw workflow so the map is visible while drawing
  useEffect(() => {
    if (window.innerWidth >= 768) return;
    if (draw.phase === 'confirm') setMobileTab('geofences');
    else if (!['idle', 'type-select'].includes(draw.phase)) setMobileTab('map');
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
  async function openConfig() {
    setConfigModal(true);
    setConfigEditing(false);
    if (!deviceUuid) return;
    setConfigLoading(true);
    try {
      const resp = await trackingService.getConfig(deviceUuid);
      if (resp.success && resp.data) setConfigData(resp.data);
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
      if (resp.success && resp.data) setConfigData(resp.data);
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
        'Device RDT': p.deviceRdt, 'GPS RDT': p.gpsRdt, 'Received At': p.receivedAt,
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

  // ── Map element ───────────────────────────────────────────────────────────
  const mapElement = (
    <div className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden md:rounded-[28px] border border-white/70 bg-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/5 dark:border-slate-700/60 dark:ring-white/10">
      <div className="pointer-events-none absolute inset-0 z-[450] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_28%)]" />
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      )}
      {/* Mobile: floating draw instruction bar */}
      {!['idle', 'type-select', 'confirm'].includes(draw.phase) && (
        <div className="md:hidden pointer-events-auto absolute top-4 left-4 right-4 z-[1000] flex items-center gap-3 rounded-2xl border border-white/70 bg-white/96 px-4 py-3 shadow-xl backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-950/94">
          <MousePointer2 className="w-4 h-4 shrink-0" style={{ color: GEO_COLOR[draw.type] }} />
          <p className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200">
            {draw.phase === 'circle-center' && 'Tap to place center'}
            {draw.phase === 'circle-radius' && `Tap to set radius${liveRadius ? ` · ${liveRadius.toLocaleString()}m` : ''}`}
            {draw.phase === 'polygon' && `${draw.polygonPts.length} pts${draw.polygonPts.length >= 3 ? ' · Tap Done' : ' · need 3+'}`}
            {draw.phase === 'line' && `${draw.polygonPts.length} wpts${draw.polygonPts.length >= 2 ? ' · Tap Done' : ' · need 2+'}`}
          </p>
          <div className="flex items-center gap-1.5">
            {(draw.phase === 'polygon' || draw.phase === 'line') && (
              <button onClick={draw.phase === 'polygon' ? finishPolygon : finishLine}
                disabled={(draw.phase === 'polygon' && draw.polygonPts.length < 3) || (draw.phase === 'line' && draw.polygonPts.length < 2)}
                className="rounded-xl px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                style={{ background: GEO_COLOR[draw.type] }}>
                Done
              </button>
            )}
            <button onClick={cancelDraw} className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-500/10">
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

        <InvalidateMapSize layoutKey={`${leftMode}-${tableOpen}-${rightOpen}`} />
        <MapInteractionHandler draw={draw} onMapClick={handleMapClick} onMouseMove={handleMouseMove} />
        <CenterOnLocation target={centerTarget} />

        {polyline.length > 0 && !isDrawingActive && <FitBounds positions={polyline} trigger={fitBoundsKey} />}

        {/* Route */}
        {polyline.length > 1 && (
          <>
            <Polyline positions={polyline} color="#0f172a" weight={9} opacity={0.5} />
            <Polyline positions={polyline} color="#3b82f6" weight={5} opacity={1} />
          </>
        )}
        {points.map((p) => {
          const color = getPointColor(p.reason);
          return (
            <CircleMarker key={p.id} center={[p.latitude, p.longitude]} radius={5}
              pathOptions={{ color: '#0f172a', weight: 1.5, fillColor: color, fillOpacity: 0.95 }}
              eventHandlers={{ mouseover: (e) => e.target.openPopup(), mouseout: (e) => e.target.closePopup() }}>
              <Popup minWidth={220} maxWidth={280} autoPan={false}><PointPopup point={p} color={color} /></Popup>
            </CircleMarker>
          );
        })}
        {polyline.length > 0 && (
          <Marker position={polyline[0]} icon={startPin}>
            <Popup minWidth={220} maxWidth={280} autoPan={false}><PointPopup point={points[0]} color="#22c55e" label="START" /></Popup>
          </Marker>
        )}
        {polyline.length > 1 && (
          <Marker position={polyline[polyline.length - 1]} icon={endPin}>
            <Popup minWidth={220} maxWidth={280} autoPan={false}><PointPopup point={points[points.length - 1]} color="#ef4444" label="END" /></Popup>
          </Marker>
        )}

        {/* Saved geofence overlays */}
        {showGeoOnMap && geofences.filter((g) => g.active).map((g) => {
          const color = GEO_COLOR[g.type] ?? '#f59e0b';
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
          const dc = GEO_COLOR[draw.type] ?? '#f59e0b';
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

      {/* ── Route legend ──────────────────────────────────────────────────── */}
      {points.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] flex gap-3 rounded-2xl border border-white/60 bg-white/92 px-3.5 py-2.5 text-xs text-slate-700 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-950/88 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 ring-1 ring-white dark:ring-slate-900" />Moving</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500   ring-1 ring-white dark:ring-slate-900" />Idle/Stopped</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500  ring-1 ring-white dark:ring-slate-900" />Other</span>
        </div>
      )}

      {/* No data overlay */}
      {hasLoaded && polyline.length === 0 && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-lg rounded-xl px-6 py-4 text-center">
            <MapPin className="w-8 h-8 text-gray-400 dark:text-slate-500 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-gray-500 dark:text-slate-400">No location data for selected range</p>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_52%,#e9f1fb_100%)] dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_48%,#111827_100%)]">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="z-50 shrink-0 border-b border-slate-200/70 bg-white/80 px-5 py-4 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-950/72">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-2xl border border-white/70 bg-white/80 p-2.5 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_50%,#22d3ee_100%)] shadow-[0_18px_45px_rgba(37,99,235,0.28)]">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{device?.deviceName ?? deviceUuid ?? deviceId}</p>
              <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Tracking</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Live route intelligence, geofence tooling, and export-grade location history</p>
          </div>
          {/* Config button */}
          <button onClick={openConfig} title="Tracking configuration"
            className="rounded-2xl border border-white/70 bg-white/80 p-2.5 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-blue-600 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-blue-400">
            <Settings className="w-5 h-5" />
          </button>
          {/* Panel toggle */}
          <button onClick={() => setRightOpen((v) => !v)}
            title={rightOpen ? 'Close panel' : 'Open panel'}
            className="hidden md:flex rounded-2xl border border-white/70 bg-white/80 p-2.5 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-sky-600 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-sky-300">
            {rightOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row min-h-0 flex-1 md:gap-4 overflow-hidden md:px-4 md:pt-3 md:pb-4">

        {/* ── Left: Map (top) + Table (bottom) ─────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:gap-4">

          {/* Map */}
          <div className={`relative flex min-h-0 min-w-0 overflow-hidden transition-all duration-300 ease-out ${mapPaneClass}`}>
            {mapElement}

            {/* ── View-mode switcher overlay ──────────────────────────── */}
            <div className="hidden md:flex absolute right-4 top-4 z-[1000] items-center gap-1 rounded-2xl border border-white/65 bg-white/86 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-950/84">
              <button
                onClick={() => setLeftMode('map')}
                title="Full map"
                className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${leftMode === 'map' ? 'bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_54%,#38bdf8_100%)] text-white shadow-lg shadow-blue-500/25' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70'}`}>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
              <button
                onClick={() => setLeftMode('split')}
                title="Split view"
                className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${leftMode === 'split' ? 'bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_54%,#38bdf8_100%)] text-white shadow-lg shadow-blue-500/25' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70'}`}>
                <LayoutPanelTop className="w-3.5 h-3.5" />
                <span>Split</span>
              </button>
              <button
                onClick={() => setLeftMode('table')}
                title="Full table"
                className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${leftMode === 'table' ? 'bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_54%,#38bdf8_100%)] text-white shadow-lg shadow-blue-500/25' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70'}`}>
                <Sheet className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>
          </div>

          {/* Table section */}
          <div className={`max-md:hidden flex flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/75 shadow-[0_22px_70px_rgba(15,23,42,0.10)] backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-950/55 transition-all duration-300 ease-out ${
            leftMode === 'map' ? 'hidden' :
            leftMode === 'table' ? 'flex-1 min-h-0' :
            tableOpen ? 'flex-[0.95] min-h-0' : 'flex-none h-12'
          }`}>

            {/* Table header / toggle bar */}
            <div className={`shrink-0 select-none border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(241,245,249,0.7))] px-4 py-3 dark:border-slate-700/50 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.66))] ${leftMode === 'split' ? 'cursor-pointer' : ''}`}
              onClick={() => leftMode === 'split' && setTableOpen((v) => !v)}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">Excel View</span>
                    {hasLoaded && <span className="text-[11px] text-slate-500 dark:text-slate-400">{totalElements.toLocaleString()} route records</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Pagination */}
                  {totalPages > 1 && isTableExpanded && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => { setPage(page - 1); fetchHistory(page - 1); }} disabled={page === 0 || loading}
                        className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="min-w-[60px] text-center text-xs text-slate-500 dark:text-slate-400">{page + 1} / {totalPages}</span>
                      <button onClick={() => { setPage(page + 1); fetchHistory(page + 1); }} disabled={page >= totalPages - 1 || loading}
                        className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {/* Fullscreen table toggle */}
                  <button onClick={(e) => { e.stopPropagation(); setLeftMode((m) => m === 'table' ? 'split' : 'table'); }}
                    title={leftMode === 'table' ? 'Exit fullscreen' : 'Fullscreen table'}
                    className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-sky-500/10 hover:text-sky-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-sky-300">
                    {leftMode === 'table' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                  {/* Collapse toggle (split mode only) */}
                  {leftMode === 'split' && (
                    <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${tableOpen ? 'rotate-90' : '-rotate-90'}`} />
                  )}
                </div>
              </div>
            </div>

            {/* Table content */}
            {isTableExpanded && (
              <div className="flex-1 overflow-auto min-h-0">
                {loading && <div className="flex items-center justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-blue-400" /></div>}
                {!loading && hasLoaded && points.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
                    <MapPin className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">No location data for selected range</p>
                  </div>
                )}
                {!loading && points.length > 0 && (
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] text-slate-500 uppercase tracking-wider dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.92))] dark:text-slate-400">
                      <tr>
                        {['#','ID','Local Primary ID','Received At','Device RDT','GPS RDT','Lat','Lng','Speed','Accuracy','Alt','Bearing','Satellites','Provider','Version','Upload Retry','IG','Reason'].map((h) => (
                          <th key={h} className="whitespace-nowrap border-b border-slate-200/70 px-3 py-2.5 dark:border-slate-700/50">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/90 dark:divide-slate-700/30">
                      {points.map((p, i) => (
                        <tr key={p.id} className="bg-white/80 transition-colors hover:bg-sky-50/60 dark:bg-transparent dark:hover:bg-slate-800/40">
                          <td className="px-3 py-2 text-slate-400 dark:text-slate-500">{page * pageSize + i + 1}</td>
                          <td className="px-3 py-2 font-mono text-slate-400 dark:text-slate-500">{p.id > 0 ? p.id : '-'}</td>
                          <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">{p.localPrimaryId || '-'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{p.receivedAt ? new Date(p.receivedAt).toLocaleString() : '-'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{p.deviceRdt || '-'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{p.gpsRdt || '-'}</td>
                          <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200">{p.latitude?.toFixed(6)}</td>
                          <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200">{p.longitude?.toFixed(6)}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.speed != null ? p.speed.toFixed(1) : '-'}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.accuracy != null ? `±${p.accuracy.toFixed(0)}` : '-'}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.altitude != null ? p.altitude.toFixed(0) : '-'}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.bearing != null ? `${p.bearing.toFixed(1)}°` : '-'}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.connectedSatellite}/{p.availableSatellite}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.provider || '-'}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.versionNo || '-'}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.uploadRetryCount ?? '-'}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.igStatus === 1 ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                              {p.igStatus === 1 ? 'ON' : 'OFF'}
                            </span>
                          </td>
                          <td className="max-w-[160px] truncate px-3 py-2 text-slate-500 dark:text-slate-400">{p.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right collapsible panel ───────────────────────────────────── */}
        <div className={`max-md:hidden shrink-0 flex flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-sm transition-all duration-300 ease-in-out dark:border-slate-700/60 dark:bg-slate-950/60 ${rightOpen ? 'w-80' : 'w-0 border-transparent bg-transparent shadow-none'}`}>
          {rightOpen && (
            <div className="w-80 h-full flex flex-col overflow-hidden">

              {/* ── Section: History Filters ──────────────────────────── */}
              <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-200 dark:border-slate-700/50 space-y-3">
                <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">History Filters</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-400 dark:text-slate-500 block mb-1">From</label>
                    <input type="datetime-local" step="1" value={fromDt} onChange={(e) => setFromDt(e.target.value)}
                      className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 dark:text-slate-500 block mb-1">To</label>
                    <input type="datetime-local" step="1" value={toDt} onChange={(e) => setToDt(e.target.value)}
                      className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setPage(0); fetchHistory(0); }} disabled={loading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-600/25 transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Search
                  </button>
                  <button onClick={exportAllToExcel} disabled={loading || !hasLoaded || totalElements === 0}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600/15 border border-green-500/30 text-green-600 dark:text-green-400 rounded-lg text-xs font-semibold hover:bg-green-600/25 transition-colors disabled:opacity-50">
                    <Download className="w-3.5 h-3.5" /> Excel
                  </button>
                  <button onClick={() => { setUploadModal(true); setUploadMsg(null); setUploadJson(''); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-slate-700/50 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ── Section: Geofences ──────────────────────────────────── */}
              <div className="flex-[0.48] flex flex-col overflow-hidden min-h-0">

                {/* Geofence header */}
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Geofences</span>
                    {geoTotal > 0 && (
                      <span className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">{geoTotal}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Geofences ON/OFF toggle */}
                    <button onClick={() => setShowGeoOnMap((v) => !v)}
                      title={showGeoOnMap ? 'Hide on map' : 'Show on map'}
                      className={`p-1.5 rounded-lg text-xs transition-colors ${showGeoOnMap ? 'text-amber-500 bg-amber-500/15' : 'text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700/50'}`}>
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => fetchGeofences(geoPage)} disabled={geoLoading}
                      className="p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                      {geoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>
                    {draw.phase === 'idle' && (
                      <button onClick={() => setDraw((d) => ({ ...d, phase: 'type-select' }))}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-semibold hover:bg-amber-500/25 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    )}
                    {draw.phase !== 'idle' && (
                      <button onClick={cancelDraw}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-colors">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Drawing: type-select */}
                {draw.phase === 'type-select' && (
                  <div className="shrink-0 px-4 py-4 border-b border-gray-200 dark:border-slate-700/50 space-y-3">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Select a shape to draw on the map</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => startDraw('CIRCLE')}
                        className="flex flex-col items-center gap-1.5 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 hover:bg-amber-500/20 active:scale-95 transition-all">
                        <div className="w-7 h-7 rounded-full border-2 border-amber-500" />
                        <span className="text-xs font-semibold">Circle</span>
                      </button>
                      <button onClick={() => startDraw('POLYGON')}
                        className="flex flex-col items-center gap-1.5 py-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-500 hover:bg-purple-500/20 active:scale-95 transition-all">
                        <svg width="28" height="28" viewBox="0 0 32 32"><polygon points="16,2 30,22 24,30 8,30 2,22" fill="none" stroke="#a855f7" strokeWidth="2.5"/></svg>
                        <span className="text-xs font-semibold">Polygon</span>
                      </button>
                      <button onClick={() => startDraw('LINE')}
                        className="flex flex-col items-center gap-1.5 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-500 hover:bg-cyan-500/20 active:scale-95 transition-all">
                        <svg width="28" height="28" viewBox="0 0 32 32">
                          <path d="M4 26 L14 10 L24 18 L30 6" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M4 26 L14 10 L24 18 L30 6" fill="none" stroke="#06b6d4" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.18"/>
                        </svg>
                        <span className="text-xs font-semibold">Line</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Drawing: active phase (polygon/line/circle drawing) */}
                {(draw.phase === 'circle-center' || draw.phase === 'circle-radius' || draw.phase === 'polygon' || draw.phase === 'line') && (
                  <div className="shrink-0 px-4 py-4 border-b border-gray-200 dark:border-slate-700/50 space-y-3">
                    {/* Status */}
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
                      style={{ borderColor: `${GEO_COLOR[draw.type]}40`, background: `${GEO_COLOR[draw.type]}10` }}>
                      <MousePointer2 className="w-4 h-4 shrink-0" style={{ color: GEO_COLOR[draw.type] }} />
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
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
                          className="flex items-center gap-1 px-3 py-2 text-xs text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700/50 disabled:opacity-40 transition-colors">
                          <Undo2 className="w-3.5 h-3.5" /> Undo
                        </button>
                      )}
                      {draw.phase === 'polygon' && (
                        <button onClick={finishPolygon} disabled={draw.polygonPts.length < 3}
                          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold border rounded-lg transition-colors disabled:opacity-40 bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25">
                          <Check className="w-3.5 h-3.5" /> Finish
                        </button>
                      )}
                      {draw.phase === 'line' && (
                        <button onClick={finishLine} disabled={draw.polygonPts.length < 2}
                          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold border rounded-lg transition-colors disabled:opacity-40 bg-cyan-500/15 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/25">
                          <Check className="w-3.5 h-3.5" /> Finish
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Drawing: confirm phase */}
                {draw.phase === 'confirm' && (
                  <div className="shrink-0 px-4 py-4 border-b border-gray-200 dark:border-slate-700/50 space-y-3">
                    {/* Summary */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/50">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: GEO_COLOR[draw.type] }} />
                      <p className="flex-1 text-xs text-gray-600 dark:text-slate-300 truncate">
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
                      }))} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 flex items-center gap-0.5 transition-colors">
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
                      className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 placeholder-gray-400 dark:placeholder-slate-500"
                    />
                    {/* Buffer (LINE or CIRCLE) */}
                    {(draw.type === 'LINE' || draw.type === 'CIRCLE') && (
                      <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl px-3 py-2.5 border border-gray-200 dark:border-slate-700/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Buffer Zone</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{draw.type === 'LINE' ? 'Corridor on each side' : 'Extra zone outside'}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input type="number" min="0" step="10"
                            value={draw.bufferMeters || ''}
                            onChange={(e) => setDraw((d) => ({ ...d, bufferMeters: Number(e.target.value) || 0 }))}
                            placeholder="0"
                            className="w-16 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm text-gray-800 dark:text-slate-200 text-right focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-xs text-gray-500 dark:text-slate-400">m</span>
                        </div>
                      </div>
                    )}
                    {/* Save/Cancel */}
                    <div className="flex gap-2">
                      <button onClick={cancelDraw}
                        className="px-4 py-2 rounded-xl text-sm text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700/50 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                        Cancel
                      </button>
                      <button onClick={saveGeofence} disabled={geoSaving || !draw.name.trim()}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 ${
                          draw.type === 'CIRCLE' ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                          : draw.type === 'POLYGON' ? 'bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25'
                          : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/25'
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
                      <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    </div>
                  )}
                  {!geoLoading && geofences.length === 0 && draw.phase === 'idle' && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-slate-500">
                      <Shield className="w-7 h-7 mb-2 opacity-25" />
                      <p className="text-sm">No geofences yet</p>
                      <p className="text-xs mt-1 text-center px-4">Click Add to draw one on the map</p>
                    </div>
                  )}
                  {!geoLoading && (
                    <div className="divide-y divide-gray-100 dark:divide-slate-700/30">
                      {geofences.map((g) => (
                        <div key={g.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/20 transition-colors">
                          <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `${GEO_COLOR[g.type]}20`, border: `1.5px solid ${GEO_COLOR[g.type]}60` }}>
                            <div className="w-2 h-2 rounded-full" style={{ background: GEO_COLOR[g.type] }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-800 dark:text-slate-200 font-semibold truncate">{g.name}</p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">
                              {g.type}{g.type === 'CIRCLE' && g.radiusMeters ? ` · ${g.radiusMeters}m` : ''}
                              {g.bufferMeters ? ` · buf=${g.bufferMeters}m` : ''}
                            </p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${g.active ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                            {g.active ? 'Active' : 'Off'}
                          </span>
                          <button onClick={() => startDraw(g.type, g)}
                            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => deleteGeofence(g.id)} disabled={geoDeleting === g.id}
                            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-40">
                            {geoDeleting === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Geofence pagination footer */}
                {geoTotalPages > 1 && (
                  <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-slate-700/40 bg-gray-50/60 dark:bg-slate-800/30">
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">
                      Page {geoPage + 1} of {geoTotalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => fetchGeofences(geoPage - 1)} disabled={geoPage === 0 || geoLoading}
                        className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      {Array.from({ length: Math.min(geoTotalPages, 7) }, (_, i) => {
                        const start = Math.max(0, Math.min(geoPage - 3, geoTotalPages - 7));
                        return start + i;
                      }).map((i) => (
                        <button key={i} onClick={() => fetchGeofences(i)} disabled={geoLoading}
                          className={`w-5 h-5 rounded text-[10px] font-semibold transition-colors ${i === geoPage ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-200 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                          {i + 1}
                        </button>
                      ))}
                      <button onClick={() => fetchGeofences(geoPage + 1)} disabled={geoPage >= geoTotalPages - 1 || geoLoading}
                        className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Section: Geofence Events ─────────────────────────────── */}
              <div className="flex-[0.52] flex flex-col overflow-hidden min-h-0 border-t border-gray-200 dark:border-slate-700/50">

                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Events</span>
                    {geoEventsTotal > 0 && (
                      <span className="text-xs bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">{geoEventsTotal}</span>
                    )}
                  </div>
                  <button onClick={() => fetchGeoEvents(0)} disabled={geoEventsLoading}
                    className="p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                    {geoEventsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Events list */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {geoEventsLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    </div>
                  )}
                  {!geoEventsLoading && geoEvents.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-slate-500">
                      <Activity className="w-7 h-7 mb-2 opacity-25" />
                      <p className="text-sm">No events yet</p>
                      <p className="text-xs mt-1 text-center px-4">ENTER / EXIT events appear here</p>
                    </div>
                  )}
                  {!geoEventsLoading && (
                    <div className="divide-y divide-gray-100 dark:divide-slate-700/30">
                      {geoEvents.map((ev) => (
                        <div key={ev.id} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/20 transition-colors">
                          <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            ev.eventType === 'ENTER'
                              ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                              : 'bg-red-500/15 text-red-600 dark:text-red-400'
                          }`}>
                            {ev.eventType}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate">{ev.geofenceName}</p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                              {ev.latitude.toFixed(5)}, {ev.longitude.toFixed(5)}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
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
                  <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-slate-700/40 bg-gray-50/60 dark:bg-slate-800/30">
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">
                      Page {geoEventsPage + 1} of {geoEventsTotalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => fetchGeoEvents(geoEventsPage - 1)} disabled={geoEventsPage === 0 || geoEventsLoading}
                        className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] text-gray-500 dark:text-slate-400 min-w-[2rem] text-center">
                        {geoEventsPage + 1} / {geoEventsTotalPages}
                      </span>
                      <button onClick={() => fetchGeoEvents(geoEventsPage + 1)} disabled={geoEventsPage >= geoEventsTotalPages - 1 || geoEventsLoading}
                        className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MOBILE BOTTOM SHEET  (md:hidden)
            Slides up from bottom when a non-map tab is active.
            Active drawing phases auto-switch to 'map' via useEffect so the
            map is always fully visible while the user draws.
        ══════════════════════════════════════════════════════════════════ */}
        {(() => {
          const activeDrawing = ['circle-center', 'circle-radius', 'polygon', 'line'].includes(draw.phase);
          const sheetOpen     = mobileTab !== 'map' && !activeDrawing;
          return (
            <div className={`md:hidden flex flex-col bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700/60 rounded-t-3xl shadow-[0_-8px_32px_rgba(15,23,42,0.14)] overflow-hidden transition-all duration-300 ease-out ${sheetOpen ? 'flex-[0.58]' : 'h-0'}`}>

              {/* Drag handle */}
              <div className="shrink-0 flex justify-center pt-3 pb-0.5">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
              </div>

              {/* ── History tab ─────────────────────────────────────────── */}
              {mobileTab === 'history' && (
                <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                  <div className="shrink-0 px-4 pt-2 pb-3 space-y-2 border-b border-gray-100 dark:border-slate-700/40">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">From</p>
                        <input type="datetime-local" step="1" value={fromDt} onChange={(e) => setFromDt(e.target.value)}
                          className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-2.5 py-2 text-[11px] text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">To</p>
                        <input type="datetime-local" step="1" value={toDt} onChange={(e) => setToDt(e.target.value)}
                          className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-2.5 py-2 text-[11px] text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setPage(0); fetchHistory(0); }} disabled={loading}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-semibold disabled:opacity-50">
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Search
                      </button>
                      <button onClick={exportAllToExcel} disabled={loading || !hasLoaded || totalElements === 0}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600/15 border border-green-500/30 text-green-600 dark:text-green-400 rounded-xl text-xs font-semibold disabled:opacity-50">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setUploadModal(true); setUploadMsg(null); setUploadJson(''); }}
                        className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-xl text-xs font-semibold">
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {hasLoaded && totalElements > 0 && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">{totalElements.toLocaleString()} points · page {page + 1}/{totalPages || 1}</p>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>}
                    {!loading && hasLoaded && points.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-slate-500">
                        <MapPin className="w-8 h-8 mb-2 opacity-25" />
                        <p className="text-sm">No data for selected range</p>
                      </div>
                    )}
                    <div className="divide-y divide-gray-100 dark:divide-slate-700/30">
                      {points.map((p) => {
                        const color = getPointColor(p.reason);
                        return (
                          <div key={p.id} className="flex items-start gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-slate-800/40 cursor-pointer"
                            onClick={() => { setCenterTarget([p.latitude, p.longitude]); setMobileTab('map'); }}>
                            <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: color }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate">{p.reason || 'Location'}</p>
                                <span className="text-[10px] text-gray-400 shrink-0">{p.speed != null ? `${p.speed.toFixed(0)} km/h` : ''}</span>
                              </div>
                              <p className="text-[10px] font-mono text-gray-400 dark:text-slate-500">{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</p>
                              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{p.receivedAt ? new Date(p.receivedAt).toLocaleString() : '-'}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {totalPages > 1 && (
                    <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-slate-700/40 bg-gray-50/60 dark:bg-slate-900/60">
                      <button onClick={() => { setPage(page - 1); fetchHistory(page - 1); }} disabled={page === 0 || loading}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 disabled:opacity-40">
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                      </button>
                      <span className="text-xs text-gray-500">{page + 1} / {totalPages}</span>
                      <button onClick={() => { setPage(page + 1); fetchHistory(page + 1); }} disabled={page >= totalPages - 1 || loading}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 disabled:opacity-40">
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Geofences tab ────────────────────────────────────────── */}
              {mobileTab === 'geofences' && (
                <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                  <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700/40">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-800 dark:text-slate-100">Geofences</p>
                      {geoTotal > 0 && <span className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">{geoTotal}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {draw.phase === 'idle' && (
                        <button onClick={() => setDraw((d) => ({ ...d, phase: 'type-select' }))}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-semibold">
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      )}
                      {draw.phase !== 'idle' && (
                        <button onClick={cancelDraw}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-semibold">
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  {draw.phase === 'type-select' && (
                    <div className="shrink-0 px-4 py-4 border-b border-gray-100 dark:border-slate-700/40 space-y-3">
                      <p className="text-xs text-gray-500 dark:text-slate-400">Select a shape to draw on the map</p>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => startDraw('CIRCLE')} className="flex flex-col items-center gap-1.5 py-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500 active:scale-95 transition-all">
                          <div className="w-8 h-8 rounded-full border-2 border-amber-500" />
                          <span className="text-xs font-semibold">Circle</span>
                        </button>
                        <button onClick={() => startDraw('POLYGON')} className="flex flex-col items-center gap-1.5 py-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-purple-500 active:scale-95 transition-all">
                          <svg width="32" height="32" viewBox="0 0 32 32"><polygon points="16,2 30,22 24,30 8,30 2,22" fill="none" stroke="#a855f7" strokeWidth="2.5"/></svg>
                          <span className="text-xs font-semibold">Polygon</span>
                        </button>
                        <button onClick={() => startDraw('LINE')} className="flex flex-col items-center gap-1.5 py-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-500 active:scale-95 transition-all">
                          <svg width="32" height="32" viewBox="0 0 32 32"><path d="M4 26 L14 10 L24 18 L30 6" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 26 L14 10 L24 18 L30 6" fill="none" stroke="#06b6d4" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.18"/></svg>
                          <span className="text-xs font-semibold">Line</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {draw.phase === 'confirm' && (
                    <div className="shrink-0 px-4 py-4 border-b border-gray-100 dark:border-slate-700/40 space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/50">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: GEO_COLOR[draw.type] }} />
                        <p className="flex-1 text-xs text-gray-600 dark:text-slate-300 truncate">
                          {draw.type === 'CIRCLE' ? `Circle · r=${draw.circleRadius}m` : draw.type === 'LINE' ? `Line · ${draw.polygonPts.length} waypoints` : `Polygon · ${draw.polygonPts.length} pts`}
                        </p>
                        <button onClick={() => setDraw((d) => ({ ...d, phase: d.type === 'CIRCLE' ? 'circle-center' : d.type === 'POLYGON' ? 'polygon' : 'line', circleCenter: null, circleRadius: null, polygonPts: [], mousePos: null }))}
                          className="text-gray-400 hover:text-gray-700 transition-colors"><Undo2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <input autoFocus value={draw.name} onChange={(e) => setDraw((d) => ({ ...d, name: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && draw.name.trim()) saveGeofence(); }}
                        placeholder="Geofence name…"
                        className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-2xl px-4 py-3.5 text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 placeholder-gray-400" />
                      {(draw.type === 'LINE' || draw.type === 'CIRCLE') && (
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl px-4 py-3 border border-gray-200 dark:border-slate-700/50">
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Buffer</p>
                            <p className="text-[10px] text-gray-400">{draw.type === 'LINE' ? 'Corridor width' : 'Extra zone'}</p>
                          </div>
                          <input type="number" min="0" step="10" value={draw.bufferMeters || ''} onChange={(e) => setDraw((d) => ({ ...d, bufferMeters: Number(e.target.value) || 0 }))} placeholder="0"
                            className="w-16 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl px-2 py-2 text-sm text-right focus:outline-none focus:border-blue-500" />
                          <span className="text-xs text-gray-500">m</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button onClick={cancelDraw} className="px-4 py-3 rounded-2xl text-sm text-gray-500 bg-gray-100 dark:bg-slate-800">Cancel</button>
                        <button onClick={saveGeofence} disabled={geoSaving || !draw.name.trim()}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold disabled:opacity-50 ${draw.type === 'CIRCLE' ? 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400' : draw.type === 'POLYGON' ? 'bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400' : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400'}`}>
                          {geoSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          {draw.editId != null ? 'Update' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {geoLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-amber-500" /></div>}
                    {!geoLoading && geofences.length === 0 && draw.phase === 'idle' && (
                      <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-slate-500">
                        <Shield className="w-8 h-8 mb-2 opacity-25" />
                        <p className="text-sm">No geofences yet</p>
                        <p className="text-xs mt-1">Tap Add to draw one on the map</p>
                      </div>
                    )}
                    <div className="divide-y divide-gray-100 dark:divide-slate-700/30">
                      {geofences.map((g) => (
                        <div key={g.id} className="flex items-center gap-3 px-4 py-3.5">
                          <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${GEO_COLOR[g.type]}20`, border: `2px solid ${GEO_COLOR[g.type]}60` }}>
                            <div className="w-3 h-3 rounded-full" style={{ background: GEO_COLOR[g.type] }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">{g.name}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">
                              {g.type}{g.type === 'CIRCLE' && g.radiusMeters ? ` · ${g.radiusMeters}m` : ''}
                              {g.bufferMeters ? ` · buf ${g.bufferMeters}m` : ''}
                            </p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${g.active ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                            {g.active ? 'Active' : 'Off'}
                          </span>
                          <button onClick={() => { startDraw(g.type, g); }}
                            className="p-2.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteGeofence(g.id)} disabled={geoDeleting === g.id}
                            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors disabled:opacity-40">
                            {geoDeleting === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {geoTotalPages > 1 && (
                    <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-slate-700/40 bg-gray-50/60 dark:bg-slate-900/60">
                      <button onClick={() => fetchGeofences(geoPage - 1)} disabled={geoPage === 0 || geoLoading}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 disabled:opacity-40">
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                      </button>
                      <span className="text-xs text-gray-500">{geoPage + 1} / {geoTotalPages}</span>
                      <button onClick={() => fetchGeofences(geoPage + 1)} disabled={geoPage >= geoTotalPages - 1 || geoLoading}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 disabled:opacity-40">
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Events tab ───────────────────────────────────────────── */}
              {mobileTab === 'events' && (
                <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                  <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700/40">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-800 dark:text-slate-100">Geofence Events</p>
                      {geoEventsTotal > 0 && <span className="text-xs bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-semibold">{geoEventsTotal}</span>}
                    </div>
                    <button onClick={() => fetchGeoEvents(0)} disabled={geoEventsLoading}
                      className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                      {geoEventsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {geoEventsLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>}
                    {!geoEventsLoading && geoEvents.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-slate-500">
                        <Activity className="w-8 h-8 mb-2 opacity-25" />
                        <p className="text-sm">No events yet</p>
                        <p className="text-xs mt-1">ENTER / EXIT events appear here</p>
                      </div>
                    )}
                    <div className="divide-y divide-gray-100 dark:divide-slate-700/30">
                      {geoEvents.map((ev) => (
                        <div key={ev.id} className="flex items-start gap-3 px-4 py-4">
                          <span className={`mt-0.5 shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${ev.eventType === 'ENTER' ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
                            {ev.eventType}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">{ev.geofenceName}</p>
                            <p className="text-xs font-mono text-gray-400 dark:text-slate-500">{ev.latitude.toFixed(5)}, {ev.longitude.toFixed(5)}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{new Date(ev.eventTime).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {geoEventsTotalPages > 1 && (
                    <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-slate-700/40 bg-gray-50/60 dark:bg-slate-900/60">
                      <button onClick={() => fetchGeoEvents(geoEventsPage - 1)} disabled={geoEventsPage === 0 || geoEventsLoading}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 disabled:opacity-40">
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                      </button>
                      <span className="text-xs text-gray-500">{geoEventsPage + 1} / {geoEventsTotalPages}</span>
                      <button onClick={() => fetchGeoEvents(geoEventsPage + 1)} disabled={geoEventsPage >= geoEventsTotalPages - 1 || geoEventsLoading}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 disabled:opacity-40">
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            MOBILE BOTTOM NAV BAR  (md:hidden)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="md:hidden shrink-0 relative flex items-stretch border-t border-gray-200/80 dark:border-slate-700/60 bg-white/97 dark:bg-slate-950/97 backdrop-blur-xl">
          {([
            { id: 'map'       as const, Icon: MapPin,   label: 'Map'       },
            { id: 'history'   as const, Icon: Sheet,    label: 'History'   },
            { id: 'geofences' as const, Icon: Shield,   label: 'Fences'    },
            { id: 'events'    as const, Icon: Activity, label: 'Events'    },
          ]).map(({ id, Icon, label }) => (
            <button key={id} onClick={() => setMobileTab(id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-3 relative transition-colors ${mobileTab === id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}`}>
              {mobileTab === id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
              <Icon className={`w-5 h-5 transition-transform duration-150 ${mobileTab === id ? 'scale-110' : ''}`} />
              <span className={`text-[10px] font-semibold tracking-wide ${mobileTab === id ? 'text-blue-600 dark:text-blue-400' : ''}`}>{label}</span>
            </button>
          ))}
        </div>

      </div>

      {/* ── Tracking config modal ────────────────────────────────────────── */}
      {configModal && (
        <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm px-0 md:px-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-700/60 rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl shadow-2xl flex flex-col max-h-[92vh] md:max-h-[85vh]">

            {/* Modal header */}
            <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-slate-700/50">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1e3a5f_0%,#2563eb_50%,#38bdf8_100%)] shadow-[0_8px_24px_rgba(37,99,235,0.28)]">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-slate-100">Tracking Configuration</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{device?.deviceName ?? deviceUuid}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!configEditing ? (
                  <button onClick={() => {
                    setConfigEditing(true);
                    setConfigForm({
                      configurationTimer:        configData?.configurationTimer        ?? undefined,
                      uploadTimer:               configData?.uploadTimer               ?? undefined,
                      movingTimer:               configData?.movingTimer               ?? undefined,
                      stopTimer:                 configData?.stopTimer                 ?? undefined,
                      heartbeatTimer:            configData?.heartbeatTimer            ?? undefined,
                      angleThreshold:            configData?.angleThreshold            ?? undefined,
                      overSpeedingThreshold:     configData?.overSpeedingThreshold     ?? undefined,
                      distanceThreshold:         configData?.distanceThreshold         ?? undefined,
                      retryCounter:              configData?.retryCounter              ?? undefined,
                      setMinUpdateIntervalMillis: configData?.setMinUpdateIntervalMillis ?? undefined,
                      setMinUpdateDistanceMeters: configData?.setMinUpdateDistanceMeters ?? undefined,
                      baseURL:                   configData?.baseURL                   ?? '',
                    });
                  }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Edit Config
                  </button>
                ) : (
                  <>
                    <button onClick={() => setConfigEditing(false)} disabled={configSaving}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                      Cancel
                    </button>
                    <button onClick={saveConfig} disabled={configSaving}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600/25 transition-colors disabled:opacity-50">
                      {configSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Send
                    </button>
                  </>
                )}
                <button onClick={() => { setConfigModal(false); setConfigEditing(false); }}
                  className="p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {configLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm text-gray-400 dark:text-slate-500">Loading configuration…</p>
                </div>
              ) : configData ? (
                <div className="p-5 space-y-5">

                  {/* ── Current Config Display — all 12 fields ──────────── */}
                  {!configEditing && <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-slate-500">Current Device Config</p>

                    {/* Timers — 5 fields */}
                    <div className="rounded-2xl border border-gray-100 dark:border-slate-700/50 bg-gray-50/60 dark:bg-slate-800/30 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-slate-700/40">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10">
                          <Timer className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Timers</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 ml-auto">5 fields</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-gray-100 dark:bg-slate-700/30">
                        {[
                          { label: 'Configuration Timer',    desc: 'Config fetch interval',     value: configData.configurationTimer, unit: 's'   },
                          { label: 'Upload Timer',           desc: 'Live data upload interval',  value: configData.uploadTimer,        unit: 's'   },
                          { label: 'Moving Timer',           desc: 'Trip start detection',       value: configData.movingTimer,        unit: 's'   },
                          { label: 'Stop Timer',             desc: 'Idle / stop detection',      value: configData.stopTimer,          unit: 's'   },
                          { label: 'Heartbeat Timer',        desc: 'Keep-alive interval',        value: configData.heartbeatTimer,     unit: 's'   },
                        ].map(({ label, desc, value, unit }) => (
                          <div key={label} className="bg-white dark:bg-slate-900/60 px-4 py-3">
                            <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 truncate">{label}</p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-1 truncate">{desc}</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                              {value ?? '—'}<span className="text-xs font-normal text-gray-400 dark:text-slate-500 ml-1">{unit}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Thresholds — 4 fields */}
                    <div className="rounded-2xl border border-gray-100 dark:border-slate-700/50 bg-gray-50/60 dark:bg-slate-800/30 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-slate-700/40">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/10">
                          <Gauge className="w-3.5 h-3.5 text-orange-500" />
                        </div>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Thresholds &amp; Retries</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 ml-auto">4 fields</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100 dark:bg-slate-700/30">
                        {[
                          { label: 'Angle Threshold',       desc: 'Direction change trigger',  value: configData.angleThreshold,         unit: '°'    },
                          { label: 'Over-Speed Threshold',  desc: 'Speed alert limit',         value: configData.overSpeedingThreshold,  unit: 'km/h' },
                          { label: 'Distance Threshold',    desc: 'Min distance to log point', value: configData.distanceThreshold,      unit: 'm'    },
                          { label: 'Retry Counter',         desc: 'Upload retry attempts',     value: configData.retryCounter,           unit: ''     },
                        ].map(({ label, desc, value, unit }) => (
                          <div key={label} className="bg-white dark:bg-slate-900/60 px-4 py-3">
                            <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 truncate">{label}</p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-1 truncate">{desc}</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                              {value ?? '—'}<span className="text-xs font-normal text-gray-400 dark:text-slate-500 ml-1">{unit}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* GPS Update + Base URL — 3 fields */}
                    <div className="rounded-2xl border border-gray-100 dark:border-slate-700/50 bg-gray-50/60 dark:bg-slate-800/30 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-slate-700/40">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-500/10">
                          <SatelliteDish className="w-3.5 h-3.5 text-green-500" />
                        </div>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">GPS &amp; Connection</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 ml-auto">3 fields</span>
                      </div>
                      <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-slate-700/30">
                        {[
                          { label: 'Min GPS Update Interval', desc: 'Minimum time between GPS fixes',    value: configData.setMinUpdateIntervalMillis,  unit: 'ms' },
                          { label: 'Min GPS Update Distance', desc: 'Minimum movement between GPS fixes', value: configData.setMinUpdateDistanceMeters,  unit: 'm'  },
                        ].map(({ label, desc, value, unit }) => (
                          <div key={label} className="bg-white dark:bg-slate-900/60 px-4 py-3">
                            <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 truncate">{label}</p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-1 truncate">{desc}</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                              {value ?? '—'}<span className="text-xs font-normal text-gray-400 dark:text-slate-500 ml-1">{unit}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                      {/* Base URL — always shown */}
                      <div className="bg-white dark:bg-slate-900/60 border-t border-gray-100 dark:border-slate-700/30 px-4 py-3 flex items-center gap-3">
                        <Link2 className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400">Server Base URL</p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500">Override server address sent to device</p>
                          </div>
                          <p className="text-xs font-mono text-gray-700 dark:text-slate-300 break-all">{configData.baseURL || <span className="text-gray-300 dark:text-slate-600 italic">not set</span>}</p>
                        </div>
                      </div>
                    </div>
                  </div>}

                  {/* ── Edit Config Form — all 12 fields ───────────────── */}
                  {configEditing && (() => {
                    const numField = (key: keyof TrackingConfigRequest, label: string, desc: string, unit: string, step = 1) => (
                      <div key={key} className="bg-white dark:bg-slate-900/60 px-4 py-3">
                        <label className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 block truncate">{label}</label>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-1.5 truncate">{desc}</p>
                        <div className="flex items-center gap-1.5">
                          <input type="number" min="0" step={step} placeholder="—"
                            value={(configForm[key] as number | undefined) ?? ''}
                            onChange={(e) => setConfigForm((f) => ({ ...f, [key]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                            className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 placeholder-gray-300 dark:placeholder-slate-600" />
                          {unit && <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 shrink-0">{unit}</span>}
                        </div>
                      </div>
                    );
                    return (
                      <div className="space-y-3">
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center">Saved to database and pushed to device via MQTT.</p>

                        {/* Timers — 5 fields */}
                        <div className="rounded-2xl border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-500/5 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-indigo-100 dark:border-indigo-500/20">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10">
                              <Timer className="w-3.5 h-3.5 text-indigo-500" />
                            </div>
                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">Timers</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-indigo-100/60 dark:bg-indigo-500/10">
                            {numField('configurationTimer', 'Configuration Timer', 'Config fetch interval', 's')}
                            {numField('uploadTimer',        'Upload Timer',        'Live data upload interval', 's')}
                            {numField('movingTimer',        'Moving Timer',        'Trip start detection', 's')}
                            {numField('stopTimer',          'Stop Timer',          'Idle / stop detection', 's')}
                            {numField('heartbeatTimer',     'Heartbeat Timer',     'Keep-alive interval', 's')}
                          </div>
                        </div>

                        {/* Thresholds & Retries — 4 fields */}
                        <div className="rounded-2xl border border-orange-100 dark:border-orange-500/20 bg-orange-50/30 dark:bg-orange-500/5 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-orange-100 dark:border-orange-500/20">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/10">
                              <Gauge className="w-3.5 h-3.5 text-orange-500" />
                            </div>
                            <span className="text-xs font-bold text-orange-700 dark:text-orange-300 uppercase tracking-wide">Thresholds &amp; Retries</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-orange-100/60 dark:bg-orange-500/10">
                            {numField('angleThreshold',       'Angle Threshold',       'Direction change trigger',   '°',    0.5)}
                            {numField('overSpeedingThreshold','Over-Speed Threshold',  'Speed alert limit',          'km/h'     )}
                            {numField('distanceThreshold',    'Distance Threshold',    'Min distance to log point',  'm'        )}
                            {numField('retryCounter',         'Retry Counter',         'Upload retry attempts',      ''         )}
                          </div>
                        </div>

                        {/* GPS & Connection — 3 fields */}
                        <div className="rounded-2xl border border-green-100 dark:border-green-500/20 bg-green-50/30 dark:bg-green-500/5 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-green-100 dark:border-green-500/20">
                            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-500/10">
                              <SatelliteDish className="w-3.5 h-3.5 text-green-500" />
                            </div>
                            <span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">GPS &amp; Connection</span>
                          </div>
                          <div className="grid grid-cols-2 gap-px bg-green-100/60 dark:bg-green-500/10">
                            {numField('setMinUpdateIntervalMillis', 'Min GPS Update Interval', 'Min time between GPS fixes',     'ms')}
                            {numField('setMinUpdateDistanceMeters', 'Min GPS Update Distance', 'Min movement between GPS fixes', 'm', 0.5)}
                          </div>
                          <div className="bg-white dark:bg-slate-900/60 border-t border-green-100 dark:border-green-500/10 px-4 py-3">
                            <label className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 block mb-0.5">Server Base URL</label>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-1.5">Override server address sent to device</p>
                            <input type="text" placeholder="https://…"
                              value={configForm.baseURL ?? ''}
                              onChange={(e) => setConfigForm((f) => ({ ...f, baseURL: e.target.value }))}
                              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm font-mono text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 placeholder-gray-300 dark:placeholder-slate-600" />
                          </div>
                        </div>

                        {/* Save / Cancel */}
                        <div className="flex gap-3 pt-1">
                          <button onClick={() => setConfigEditing(false)} disabled={configSaving}
                            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                            Cancel
                          </button>
                          <button onClick={saveConfig} disabled={configSaving}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-[linear-gradient(135deg,#1e3a5f_0%,#2563eb_54%,#38bdf8_100%)] text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-shadow disabled:opacity-50">
                            {configSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Save &amp; Push to Device
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Settings className="w-10 h-10 text-gray-200 dark:text-slate-700" />
                  <p className="text-sm text-gray-400 dark:text-slate-500">No configuration found</p>
                </div>
              )}
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
    </div>
  );
}


// ── Point hover popup ─────────────────────────────────────────────────────────
function PointPopup({ point, color, label }: { point: HistoryPoint; color: string; label?: string }) {
  if (!point) return null;
  const rows: [string, string][] = [
    ['Received At', point.receivedAt ? new Date(point.receivedAt).toLocaleString() : '-'],
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
