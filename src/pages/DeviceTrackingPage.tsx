import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, RefreshCw, Loader2, Download,
  ChevronLeft, ChevronRight, Map, Table2, Shield,
  Plus, Pencil, Trash2, X, Check, Upload, Undo2, MousePointer2, LocateFixed,
} from 'lucide-react';
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

// ── Pulsing user-location marker ──────────────────────────────────────────────
function UserLocationMarker({ pos }: { pos: [number, number] }) {
  const icon = new L.DivIcon({
    className: '',
    html: `
      <div style="position:relative;width:22px;height:22px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;opacity:0.25;animation:ulpulse 2s ease-out infinite;"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:#3b82f6;border:2.5px solid #fff;box-shadow:0 0 0 1.5px #3b82f6;"></div>
      </div>
      <style>@keyframes ulpulse{0%{transform:scale(1);opacity:.35}70%{transform:scale(2.8);opacity:0}100%{transform:scale(2.8);opacity:0}}</style>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
  return (
    <Marker position={pos} icon={icon}>
      <Popup><span className="text-xs font-medium">Your Location</span></Popup>
    </Marker>
  );
}

// ── FitBounds helper ──────────────────────────────────────────────────────────
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const prev = useRef('');
  useEffect(() => {
    if (!positions.length) return;
    const key = `${positions[0]}${positions[positions.length-1]}`;
    if (key === prev.current) return;
    prev.current = key;
    map.fitBounds(L.latLngBounds(positions), { padding: [30, 30] });
  }, [positions, map]);
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

type ViewMode = 'map' | 'table' | 'geofences';

// ── Main page ─────────────────────────────────────────────────────────────────
export function DeviceTrackingPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate    = useNavigate();
  const { data: devices } = useDevicesQuery();
  const device      = devices?.find((d) => String(d.id) === deviceId);
  const deviceUuid  = device?.deviceUuid;

  const [viewMode, setViewMode] = useState<ViewMode>('map');

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

  // Drawing state
  const [draw, setDraw] = useState<DrawState>(BLANK_DRAW);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  // User's current GPS location
  const [userLocation, setUserLocation]       = useState<[number, number] | null>(null);
  const [centerTarget, setCenterTarget]       = useState<[number, number] | null>(null);
  const [locating, setLocating]               = useState(false);

  // Bulk upload
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadJson, setUploadJson]   = useState('');
  const [uploading, setUploading]     = useState(false);
  const [uploadMsg, setUploadMsg]     = useState<{ ok: boolean; text: string } | null>(null);

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
      }
    } catch { /**/ } finally { setLoading(false); setHasLoaded(true); }
  }, [deviceUuid, fromDt, toDt, pageSize]);

  // ── Fetch geofences ───────────────────────────────────────────────────────
  const fetchGeofences = useCallback(async () => {
    if (!deviceUuid) return;
    setGeoLoading(true);
    try {
      const resp = await trackingService.getGeofences(deviceUuid, { page: 0, size: 200 });
      if (resp.success && resp.data) setGeofences(resp.data.content);
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

  // ── Geolocation ───────────────────────────────────────────────────────────
  const locateUser = useCallback((andCenter = false) => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos: [number, number] = [coords.latitude, coords.longitude];
        setUserLocation(pos);
        if (andCenter) setCenterTarget([...pos]);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { fetchHistory(0); setPage(0); /* eslint-disable-next-line */ }, []);
  useEffect(() => { fetchGeofences(); fetchGeoTypes(); }, [fetchGeofences, fetchGeoTypes]);
  // Auto-center to user location on first load
  useEffect(() => { locateUser(true); }, [locateUser]);

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
    setViewMode('map');
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
      if (resp.success) { cancelDraw(); fetchGeofences(); }
    } catch { /**/ } finally { setGeoSaving(false); }
  }

  async function deleteGeofence(id: number) {
    if (!deviceUuid) return;
    setGeoDeleting(id);
    try {
      await trackingService.deleteGeofence(deviceUuid, id);
      setGeofences((prev) => prev.filter((g) => g.id !== id));
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

  // ── Map element ───────────────────────────────────────────────────────────
  const mapElement = (
    <div className="relative flex-1" style={{ minHeight: '55vh' }}>
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      )}

      <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', minHeight: '55vh' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <MapInteractionHandler draw={draw} onMapClick={handleMapClick} onMouseMove={handleMouseMove} />
        <CenterOnLocation target={centerTarget} />

        {polyline.length > 0 && !isDrawingActive && <FitBounds positions={polyline} />}

        {/* User current location */}
        {userLocation && <UserLocationMarker pos={userLocation} />}

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

      {/* ── Geofences toggle + My Location ────────────────────────────────── */}
      {!isDrawingActive && (
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 items-end">
          <button onClick={() => setShowGeoOnMap((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border shadow transition-colors ${
              showGeoOnMap ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-slate-800/80 border-slate-600 text-slate-400'
            }`}>
            <Shield className="w-3.5 h-3.5" />
            Geofences {showGeoOnMap ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => locateUser(true)}
            disabled={locating}
            title="Center map to my location"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border shadow transition-colors bg-blue-500/20 border-blue-500/40 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50">
            {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
            My Location
          </button>
        </div>
      )}

      {/* ── Route legend ──────────────────────────────────────────────────── */}
      {points.length > 0 && !isDrawingActive && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700/60 px-3 py-2 flex gap-3 text-xs text-slate-300 pointer-events-none">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 ring-1 ring-slate-900" />Moving</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500   ring-1 ring-slate-900" />Idle/Stopped</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500  ring-1 ring-slate-900" />Other</span>
        </div>
      )}

      {/* ── Drawing HUD ───────────────────────────────────────────────────── */}
      {isDrawingActive && (
        <DrawingHUD
          draw={draw}
          liveRadius={liveRadius}
          onUndo={undoLastPolygonPt}
          onFinishPolygon={finishPolygon}
          onFinishLine={finishLine}
          onCancel={cancelDraw}
          onNameChange={(name) => setDraw((d) => ({ ...d, name }))}
          onBufferChange={(v) => setDraw((d) => ({ ...d, bufferMeters: v }))}
          onSave={saveGeofence}
          saving={geoSaving}
          onRedraw={() => setDraw((d) => ({
            ...d,
            phase: d.type === 'CIRCLE' ? 'circle-center' : d.type === 'POLYGON' ? 'polygon' : 'line',
            circleCenter: null, circleRadius: null, polygonPts: [], mousePos: null,
          }))}
        />
      )}

      {/* No data overlay */}
      {hasLoaded && polyline.length === 0 && !loading && !isDrawingActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-slate-800/90 rounded-xl px-6 py-4 text-center">
            <MapPin className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
            <p className="text-sm text-slate-400">No location data for selected range</p>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-page-bg flex flex-col">

      {/* Header */}
      <div className="sticky top-0 z-50 bg-card-bg border-b border-slate-700/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <MapPin className="w-5 h-5 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">{device?.deviceName ?? deviceUuid ?? deviceId}</p>
            <p className="text-xs text-slate-500">Location History</p>
          </div>
        </div>
        <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
          {(['map', 'table', 'geofences'] as const).map((mode) => {
            const Icon = mode === 'map' ? Map : mode === 'table' ? Table2 : Shield;
            return (
              <button key={mode} onClick={() => { setViewMode(mode); if (mode !== 'map') cancelDraw(); }}
                className={`p-1.5 rounded transition-colors ${viewMode === mode ? 'bg-blue-600/40 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                title={mode.charAt(0).toUpperCase() + mode.slice(1)}>
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
        <button onClick={() => { setUploadModal(true); setUploadMsg(null); setUploadJson(''); }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 transition-colors" title="Bulk upload GPS data">
          <Upload className="w-4 h-4" />
        </button>
      </div>

      {/* Filter bar */}
      {viewMode !== 'geofences' && (
        <div className="bg-card-bg border-b border-slate-700/50 px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">From</label>
              <input type="datetime-local" step="1" value={fromDt} onChange={(e) => setFromDt(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">To</label>
              <input type="datetime-local" step="1" value={toDt} onChange={(e) => setToDt(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setPage(0); fetchHistory(0); }} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600/20 border border-blue-500/40 text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-600/30 transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Search
            </button>
            <button onClick={exportAllToExcel} disabled={loading || !hasLoaded || totalElements === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600/20 border border-green-500/40 text-green-400 rounded-xl text-sm font-medium hover:bg-green-600/30 transition-colors disabled:opacity-50">
              <Download className="w-4 h-4" /> Export Excel
            </button>
          </div>
          {hasLoaded && (
            <p className="text-xs text-slate-500 text-center">
              {totalElements.toLocaleString()} records{totalPages > 1 && ` · Page ${page + 1}/${totalPages}`}
            </p>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Map view ─────────────────────────────────────────────────── */}
        {viewMode === 'map' && mapElement}

        {/* ── Table view ───────────────────────────────────────────────── */}
        {viewMode === 'table' && (
          <div className="flex-1 overflow-auto p-4">
            {loading && <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>}
            {!loading && hasLoaded && points.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <MapPin className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No location data for selected range</p>
              </div>
            )}
            {!loading && points.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-800/70 text-slate-400 uppercase tracking-wider">
                    <tr>
                      {['#','Received At','Latitude','Longitude','Speed','Accuracy','Altitude','Bearing','Satellites','Provider','IG Status','Reason'].map((h) => (
                        <th key={h} className="px-3 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {points.map((p, i) => (
                      <tr key={p.id} className="bg-card-bg hover:bg-slate-700/20 transition-colors">
                        <td className="px-3 py-2 text-slate-500">{page * pageSize + i + 1}</td>
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{p.receivedAt ? new Date(p.receivedAt).toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-slate-200 font-mono">{p.latitude?.toFixed(6)}</td>
                        <td className="px-3 py-2 text-slate-200 font-mono">{p.longitude?.toFixed(6)}</td>
                        <td className="px-3 py-2 text-slate-300">{p.speed != null ? `${p.speed.toFixed(1)} km/h` : '-'}</td>
                        <td className="px-3 py-2 text-slate-300">{p.accuracy != null ? `±${p.accuracy.toFixed(0)} m` : '-'}</td>
                        <td className="px-3 py-2 text-slate-300">{p.altitude != null ? `${p.altitude.toFixed(0)} m` : '-'}</td>
                        <td className="px-3 py-2 text-slate-300">{p.bearing != null ? `${p.bearing.toFixed(1)}°` : '-'}</td>
                        <td className="px-3 py-2 text-slate-300">{p.connectedSatellite}/{p.availableSatellite}</td>
                        <td className="px-3 py-2 text-slate-300">{p.provider || '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.igStatus === 1 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                            {p.igStatus === 1 ? 'ON' : 'OFF'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate">{p.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Geofences view ───────────────────────────────────────────── */}
        {viewMode === 'geofences' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {mapElement}

            {/* Type-select panel (shown above the list when choosing type) */}
            {draw.phase === 'type-select' && (
              <div className="bg-slate-900 border-t-2 border-slate-600 px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-300">Select type to draw on map</p>
                  <button onClick={cancelDraw} className="p-1 text-slate-500 hover:text-slate-300 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => startDraw('CIRCLE')}
                    className="flex flex-col items-center gap-2 py-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all">
                    <div className="w-8 h-8 rounded-full border-2 border-amber-400" />
                    <span className="text-xs font-semibold">Circle</span>
                    <span className="text-xs text-slate-500 text-center leading-tight">Tap center, then edge</span>
                  </button>
                  <button onClick={() => startDraw('POLYGON')}
                    className="flex flex-col items-center gap-2 py-4 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400 hover:bg-purple-500/20 active:scale-95 transition-all">
                    <svg width="32" height="32" viewBox="0 0 32 32"><polygon points="16,2 30,22 24,30 8,30 2,22" fill="none" stroke="#a855f7" strokeWidth="2"/></svg>
                    <span className="text-xs font-semibold">Polygon</span>
                    <span className="text-xs text-slate-500 text-center leading-tight">Tap points on map</span>
                  </button>
                  <button onClick={() => startDraw('LINE')}
                    className="flex flex-col items-center gap-2 py-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 hover:bg-cyan-500/20 active:scale-95 transition-all">
                    <svg width="32" height="32" viewBox="0 0 32 32">
                      <path d="M4 26 L14 10 L24 18 L30 6" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 26 L14 10 L24 18 L30 6" fill="none" stroke="#06b6d4" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.2"/>
                      <circle cx="4" cy="26" r="2.5" fill="#06b6d4"/>
                      <circle cx="14" cy="10" r="2.5" fill="#06b6d4"/>
                      <circle cx="24" cy="18" r="2.5" fill="#06b6d4"/>
                      <circle cx="30" cy="6"  r="2.5" fill="#06b6d4"/>
                    </svg>
                    <span className="text-xs font-semibold">Line + Buffer</span>
                    <span className="text-xs text-slate-500 text-center leading-tight">Tap waypoints on map</span>
                  </button>
                </div>
              </div>
            )}

            {/* Geofence list */}
            {draw.phase === 'idle' && (
              <div className="bg-card-bg border-t border-slate-700/50 overflow-y-auto" style={{ maxHeight: '38vh' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <p className="text-sm font-semibold text-slate-200">Geofences</p>
                    <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{geofences.length}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={fetchGeofences} disabled={geoLoading}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors">
                      {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setDraw((d) => ({ ...d, phase: 'type-select' }))}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/30 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add Geofence
                    </button>
                  </div>
                </div>
                {geofences.length === 0 && !geoLoading && (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <Shield className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">No geofences configured</p>
                    <p className="text-xs mt-1">Tap Add Geofence to draw one on the map</p>
                  </div>
                )}
                <div className="divide-y divide-slate-700/30">
                  {geofences.map((g) => (
                    <div key={g.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/20 transition-colors">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${g.active ? 'bg-green-400' : 'bg-slate-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 font-medium truncate">{g.name}</p>
                        <p className="text-xs text-slate-500">
                          {g.type}{g.type === 'CIRCLE' && g.radiusMeters ? ` · r=${g.radiusMeters}m` : ''}
                          {g.type === 'CIRCLE' && g.centerLat ? ` · ${g.centerLat.toFixed(4)}, ${g.centerLng?.toFixed(4)}` : ''}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${g.active ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                        {g.active ? 'Active' : 'Inactive'}
                      </span>
                      <button onClick={() => startDraw(g.type, g)}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteGeofence(g.id)} disabled={geoDeleting === g.id}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-40">
                        {geoDeleting === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && viewMode !== 'geofences' && (
          <div className="bg-card-bg border-t border-slate-700/50 px-4 py-3 flex items-center justify-between">
            <button onClick={() => { setPage(page - 1); fetchHistory(page - 1); }} disabled={page === 0 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-40 disabled:pointer-events-none transition-colors">
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-xs text-slate-400">Page {page + 1} / {totalPages}</span>
            <button onClick={() => { setPage(page + 1); fetchHistory(page + 1); }} disabled={page >= totalPages - 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-40 disabled:pointer-events-none transition-colors">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Bulk upload modal ─────────────────────────────────────────────── */}
      {uploadModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
              <p className="text-sm font-semibold text-slate-100">Bulk Upload GPS Data</p>
              <button onClick={() => setUploadModal(false)} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700/50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-400">Paste a JSON array of tracking point objects.</p>
              <textarea rows={10} value={uploadJson} onChange={(e) => setUploadJson(e.target.value)}
                placeholder={'[\n  {\n    "latitude": 33.684,\n    "longitude": 73.047,\n    "speed": 0,\n    "reason": "Distance",\n    ...\n  }\n]'}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 placeholder-slate-500 resize-none" />
              {uploadMsg && (
                <div className={`text-xs px-3 py-2 rounded-lg ${uploadMsg.ok ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {uploadMsg.text}
                </div>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setUploadModal(false)} className="flex-1 py-2.5 bg-slate-700/50 rounded-xl text-sm text-slate-400 hover:bg-slate-700 transition-colors">Close</button>
              <button onClick={handleBulkUpload} disabled={uploading || !uploadJson.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600/20 border border-blue-500/40 text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-600/30 transition-colors disabled:opacity-50">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Drawing HUD — floats over the map ─────────────────────────────────────────
function DrawingHUD({
  draw, liveRadius, onUndo, onFinishPolygon, onFinishLine, onCancel,
  onNameChange, onBufferChange, onSave, saving, onRedraw,
}: {
  draw: DrawState;
  liveRadius: number | null;
  onUndo: () => void;
  onFinishPolygon: () => void;
  onFinishLine: () => void;
  onCancel: () => void;
  onNameChange: (n: string) => void;
  onBufferChange: (v: number) => void;
  onSave: () => void;
  saving: boolean;
  onRedraw: () => void;
}) {
  const color  = GEO_COLOR[draw.type] ?? '#f59e0b';
  const btnCls = draw.type === 'CIRCLE'
    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
    : draw.type === 'POLYGON'
    ? 'bg-purple-500/20 border-purple-500/40 text-purple-400 hover:bg-purple-500/30'
    : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30';

  const stepLabel =
      draw.phase === 'circle-center' ? 'Tap map to place center'
    : draw.phase === 'circle-radius' ? `Tap map to set radius${liveRadius ? ` · ${liveRadius.toLocaleString()}m` : ''}`
    : draw.phase === 'polygon'
      ? `${draw.polygonPts.length} point${draw.polygonPts.length !== 1 ? 's' : ''} placed${draw.polygonPts.length >= 3 ? ' · Ready' : ' · Need 3+'}`
    : draw.phase === 'line'
      ? `${draw.polygonPts.length} waypoint${draw.polygonPts.length !== 1 ? 's' : ''} placed${draw.polygonPts.length >= 2 ? ' · Ready' : ' · Need 2+'}`
    : '';

  const summaryLabel =
      draw.type === 'CIRCLE'
    ? `Circle · ${draw.circleCenter?.[0].toFixed(5)}, ${draw.circleCenter?.[1].toFixed(5)} · r=${draw.circleRadius}m`
    : draw.type === 'LINE'
    ? `Line · ${draw.polygonPts.length} waypoints`
    : `Polygon · ${draw.polygonPts.length} points`;

  const showBuffer = draw.type === 'LINE' || draw.type === 'CIRCLE';

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000]">

      {/* ── Instruction banner (while drawing) ─────────────────────────── */}
      {draw.phase !== 'confirm' && (
        <div className="mx-3 mb-2 rounded-2xl border shadow-xl overflow-hidden backdrop-blur-sm"
          style={{ borderColor: `${color}50`, background: '#0f172aef' }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <MousePointer2 className="w-4 h-4 shrink-0" style={{ color }} />
            <p className="flex-1 text-sm font-medium text-slate-200">{stepLabel}</p>
            <button onClick={onCancel} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-700/50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Polygon actions */}
          {draw.phase === 'polygon' && (
            <div className="flex gap-2 px-4 pb-3">
              <button onClick={onUndo} disabled={draw.polygonPts.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-400 border border-slate-600 hover:bg-slate-700/50 disabled:opacity-40 transition-colors">
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
              <button onClick={onFinishPolygon} disabled={draw.polygonPts.length < 3}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-40 ${btnCls}`}>
                <Check className="w-3.5 h-3.5" /> Finish Polygon
              </button>
            </div>
          )}

          {/* Line actions */}
          {draw.phase === 'line' && (
            <div className="flex gap-2 px-4 pb-3">
              <button onClick={onUndo} disabled={draw.polygonPts.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-400 border border-slate-600 hover:bg-slate-700/50 disabled:opacity-40 transition-colors">
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
              <button onClick={onFinishLine} disabled={draw.polygonPts.length < 2}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-40 ${btnCls}`}>
                <Check className="w-3.5 h-3.5" /> Finish Line
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Confirm panel ───────────────────────────────────────────────── */}
      {draw.phase === 'confirm' && (
        <div className="mx-3 mb-2 rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-sm"
          style={{ borderColor: `${color}50`, background: '#0f172af8' }}>

          {/* Summary + Redraw */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/50">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
            <p className="flex-1 text-xs font-medium text-slate-300 truncate">{summaryLabel}</p>
            <button onClick={onRedraw}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-700/50 transition-colors shrink-0">
              <Undo2 className="w-3 h-3" /> Redraw
            </button>
          </div>

          {/* Name + Buffer inputs */}
          <div className="px-4 py-3 space-y-2.5">
            <input
              autoFocus
              value={draw.name}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && draw.name.trim()) onSave(); if (e.key === 'Escape') onCancel(); }}
              placeholder="Geofence name…"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 placeholder-slate-500 transition-colors"
            />

            {/* Buffer input */}
            {showBuffer && (
              <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-3 py-2.5 border border-slate-700/50">
                <div>
                  <p className="text-xs font-semibold text-slate-300">Buffer Zone</p>
                  <p className="text-xs text-slate-500">
                    {draw.type === 'LINE' ? 'Corridor width on each side of the line' : 'Extra zone outside the circle'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <input
                    type="number" min="0" step="10"
                    value={draw.bufferMeters || ''}
                    onChange={(e) => onBufferChange(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-200 text-right focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-slate-400">m</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={onCancel}
                className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-200 bg-slate-700/50 hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button onClick={onSave} disabled={saving || !draw.name.trim()}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 ${btnCls}`}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {draw.editId != null ? 'Update Geofence' : 'Save Geofence'}
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
            <tr key={k} style={{ borderBottom: '1px solid #1e293b' }}>
              <td style={{ padding: '3px 6px', color: '#94a3b8', whiteSpace: 'nowrap', fontWeight: 600 }}>{k}</td>
              <td style={{ padding: '3px 6px', color: '#f1f5f9', fontFamily: k==='Latitude'||k==='Longitude' ? 'monospace' : 'inherit' }}>{v}</td>
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
        <strong style={{ fontSize: 12, color: '#f1f5f9' }}>{geo.name}</strong>
        <span style={{ fontSize: 10, background: geo.active ? '#14532d' : '#1e293b', color: geo.active ? '#4ade80' : '#94a3b8', padding: '1px 6px', borderRadius: 4 }}>
          {geo.active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <tbody>
          <tr><td style={{ color:'#94a3b8',padding:'2px 4px',fontWeight:600 }}>Type</td><td style={{ color:'#f1f5f9',padding:'2px 4px' }}>{geo.type}</td></tr>
          {geo.type === 'CIRCLE' && geo.radiusMeters != null && (
            <tr><td style={{ color:'#94a3b8',padding:'2px 4px',fontWeight:600 }}>Radius</td><td style={{ color:'#f1f5f9',padding:'2px 4px' }}>{geo.radiusMeters}m</td></tr>
          )}
          {geo.type === 'CIRCLE' && geo.centerLat != null && (
            <tr><td style={{ color:'#94a3b8',padding:'2px 4px',fontWeight:600 }}>Center</td><td style={{ color:'#f1f5f9',padding:'2px 4px',fontFamily:'monospace',fontSize:10 }}>{geo.centerLat.toFixed(5)}, {geo.centerLng?.toFixed(5)}</td></tr>
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
