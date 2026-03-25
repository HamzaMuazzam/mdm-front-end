import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  RefreshCw,
  Loader2,
  Download,
  ChevronLeft,
  ChevronRight,
  Map,
  Table2,
} from 'lucide-react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as XLSX from 'xlsx';
import { useDevicesQuery } from '@/hooks/useDevices';
import { trackingService, type HistoryPoint } from '@/api/services/tracking.service';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toDatetimeLocal(d);
}

function todayEnd(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 0);
  return toDatetimeLocal(d);
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(L.latLngBounds(positions), { padding: [30, 30] });
    }
  }, [positions, map]);
  return null;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function DeviceTrackingPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const { data: devices } = useDevicesQuery();
  const device = devices?.find((d) => String(d.id) === deviceId);
  const deviceUuid = device?.deviceUuid;

  const [viewMode, setViewMode] = useState<'map' | 'table'>('map');

  // Filter state — default to today
  const [fromDt, setFromDt] = useState(todayStart);
  const [toDt, setToDt] = useState(todayEnd);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize] = useState(2000);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Data
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const polyline: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
  const mapCenter: [number, number] =
    polyline.length > 0 ? polyline[Math.floor(polyline.length / 2)] : [33.6844, 73.0479];

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchHistory = useCallback(
    async (pg: number) => {
      if (!deviceUuid) return;
      setLoading(true);
      try {
        const resp = await trackingService.getHistory(deviceUuid, {
          from: fromDt,
          to: toDt,
          page: pg,
          size: pageSize,
        });
        if (resp.success && resp.data) {
          setPoints(resp.data.content);
          setTotalPages(resp.data.totalPages);
          setTotalElements(resp.data.totalElements);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
        setHasLoaded(true);
      }
    },
    [deviceUuid, fromDt, toDt, pageSize]
  );

  // Auto-load today on mount
  useEffect(() => {
    fetchHistory(0);
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch() {
    setPage(0);
    fetchHistory(0);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchHistory(newPage);
  }

  // ── Export ───────────────────────────────────────────────────────────────
  async function exportAllToExcel() {
    if (!deviceUuid) return;
    setLoading(true);
    try {
      let allPoints: HistoryPoint[] = [];
      let pg = 0;
      let last = false;

      while (!last) {
        const resp = await trackingService.getHistory(deviceUuid, {
          from: fromDt,
          to: toDt,
          page: pg,
          size: 200,
        });
        if (resp.success && resp.data) {
          allPoints = allPoints.concat(resp.data.content);
          last = resp.data.last;
          pg++;
        } else {
          break;
        }
      }

      const rows = allPoints.map((p) => ({
        ID: p.id,
        Latitude: p.latitude,
        Longitude: p.longitude,
        Speed: p.speed,
        Accuracy: p.accuracy,
        Bearing: p.bearing,
        Altitude: p.altitude,
        'Available Satellite': p.availableSatellite,
        'Connected Satellite': p.connectedSatellite,
        'Device RDT': p.deviceRdt,
        'GPS RDT': p.gpsRdt,
        'Received At': p.receivedAt,
        'Upload Retry': p.uploadRetryCount,
        Provider: p.provider,
        Version: p.versionNo,
        'IG Status': p.igStatus,
        Reason: p.reason,
        'Local Primary ID': p.localPrimaryId,
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'History');

      const fromLabel = fromDt.replace('T', '_').replace(/:/g, '-').slice(0, 16);
      const toLabel = toDt.replace('T', '_').replace(/:/g, '-').slice(0, 16);
      XLSX.writeFile(wb, `tracking_${deviceUuid}_${fromLabel}_to_${toLabel}.xlsx`);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-page-bg flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card-bg border-b border-slate-700/50 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <MapPin className="w-5 h-5 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">
              {device?.deviceName ?? deviceUuid ?? deviceId}
            </p>
            <p className="text-xs text-slate-500">Location History</p>
          </div>
        </div>
        {/* View mode toggle */}
        <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
          <button
            onClick={() => setViewMode('map')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'map' ? 'bg-blue-600/40 text-blue-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Map view"
          >
            <Map className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'table' ? 'bg-blue-600/40 text-blue-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Table view"
          >
            <Table2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-card-bg border-b border-slate-700/50 px-4 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">From</label>
            <input
              type="datetime-local"
              step="1"
              value={fromDt}
              onChange={(e) => setFromDt(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">To</label>
            <input
              type="datetime-local"
              step="1"
              value={toDt}
              onChange={(e) => setToDt(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600/20 border border-blue-500/40 text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-600/30 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Search
          </button>
          <button
            onClick={exportAllToExcel}
            disabled={loading || !hasLoaded || totalElements === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600/20 border border-green-500/40 text-green-400 rounded-xl text-sm font-medium hover:bg-green-600/30 transition-colors disabled:opacity-50"
            title="Export all pages to Excel"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
        {hasLoaded && (
          <p className="text-xs text-slate-500 text-center">
            {totalElements.toLocaleString()} total records
            {totalPages > 1 && ` · Page ${page + 1} of ${totalPages}`}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'map' ? (
          /* ── Map view ──────────────────────────────────────────────────── */
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            {loading && (
              <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/40">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              </div>
            )}
            <MapContainer
              center={mapCenter}
              zoom={13}
              style={{ height: '100%', width: '100%', minHeight: '60vh' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {polyline.length > 1 && (
                <>
                  <FitBounds positions={polyline} />
                  <Polyline positions={polyline} color="#3b82f6" weight={3} opacity={0.85} />

                  {/* Start marker */}
                  <Marker position={polyline[0]} icon={startIcon}>
                    <Popup>
                      <div className="text-xs space-y-0.5">
                        <strong>Start</strong>
                        <p>{points[0]?.receivedAt ? new Date(points[0].receivedAt).toLocaleString() : ''}</p>
                        <p>Speed: {points[0]?.speed?.toFixed(1)} km/h</p>
                      </div>
                    </Popup>
                  </Marker>

                  {/* End marker */}
                  <Marker position={polyline[polyline.length - 1]} icon={endIcon}>
                    <Popup>
                      <div className="text-xs space-y-0.5">
                        <strong>End</strong>
                        <p>
                          {points[points.length - 1]?.receivedAt
                            ? new Date(points[points.length - 1].receivedAt).toLocaleString()
                            : ''}
                        </p>
                        <p>Speed: {points[points.length - 1]?.speed?.toFixed(1)} km/h</p>
                      </div>
                    </Popup>
                  </Marker>
                </>
              )}

              {polyline.length === 1 && (
                <>
                  <Marker position={polyline[0]}>
                    <Popup>
                      <div className="text-xs">
                        {points[0]?.receivedAt ? new Date(points[0].receivedAt).toLocaleString() : ''}
                      </div>
                    </Popup>
                  </Marker>
                </>
              )}
            </MapContainer>

            {hasLoaded && polyline.length === 0 && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="bg-slate-800/90 rounded-xl px-6 py-4 text-center">
                  <MapPin className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-slate-400">No location data for selected range</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Table view ────────────────────────────────────────────────── */
          <div className="flex-1 overflow-auto p-4">
            {loading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              </div>
            )}
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
                      <th className="px-3 py-2.5 whitespace-nowrap">#</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Received At</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Latitude</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Longitude</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Speed</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Accuracy</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Altitude</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Bearing</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Satellites</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Provider</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">IG Status</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {points.map((p, i) => (
                      <tr
                        key={p.id}
                        className="bg-card-bg hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-3 py-2 text-slate-500">{page * pageSize + i + 1}</td>
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                          {p.receivedAt ? new Date(p.receivedAt).toLocaleString() : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-200 font-mono">{p.latitude?.toFixed(6)}</td>
                        <td className="px-3 py-2 text-slate-200 font-mono">{p.longitude?.toFixed(6)}</td>
                        <td className="px-3 py-2 text-slate-300">
                          {p.speed != null ? `${p.speed.toFixed(1)} km/h` : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {p.accuracy != null ? `±${p.accuracy.toFixed(0)} m` : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {p.altitude != null ? `${p.altitude.toFixed(0)} m` : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {p.bearing != null ? `${p.bearing.toFixed(1)}°` : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {p.connectedSatellite}/{p.availableSatellite}
                        </td>
                        <td className="px-3 py-2 text-slate-300">{p.provider || '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            p.igStatus === 1
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-slate-700 text-slate-400'
                          }`}>
                            {p.igStatus === 1 ? 'ON' : 'OFF'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate">
                          {p.reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-card-bg border-t border-slate-700/50 px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-xs text-slate-400">
              Page {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
