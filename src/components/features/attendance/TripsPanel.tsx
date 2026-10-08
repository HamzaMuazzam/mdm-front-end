import { Fragment, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Route, Flag, MapPin, Clock, Gauge, RefreshCw, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEmployeesQuery, useTripsQuery } from '@/hooks/useAttendance';
import { formatDuration, type AttendanceTrip } from '@/types/attendance.types';
import { EmptyState, Field, fmtDateTime, fmtTime, selectClass } from './shared';

// ── helpers ──────────────────────────────────────────────────────────────────
const PALETTE = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#db2777'];
const colorFor = (i: number) => PALETTE[i % PALETTE.length];

function pin(color: string, label: string) {
  return new L.DivIcon({
    className: '',
    iconSize: [26, 36],
    iconAnchor: [13, 36],
    popupAnchor: [0, -32],
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 24 36">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <text x="12" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" font-family="system-ui">${label}</text></svg>`,
  });
}

const localInputNow = (d = new Date()) => {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return localInputNow(d); };
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 0, 0); return localInputNow(d); };
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);

function tripLatLngs(t: AttendanceTrip): [number, number][] {
  const pts: [number, number][] = (t.points ?? []).map((p) => [p.lat, p.lng]);
  if (pts.length === 0) {
    if (t.inLat != null && t.inLng != null) pts.push([t.inLat, t.inLng]);
    if (t.outLat != null && t.outLng != null) pts.push([t.outLat, t.outLng]);
  }
  return pts;
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) { map.setView(positions[0], 16); return; }
    map.fitBounds(L.latLngBounds(positions), { padding: [32, 32] });
  }, [map, positions]);
  return null;
}

function FaceChip({ score, liveness }: { score?: number | null; liveness?: boolean | null }) {
  if (score == null) return <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{liveness ? 'liveness only' : 'no face check'}</span>;
  const ok = score >= 0.363;
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>face {(score * 100).toFixed(0)}%</span>;
}

// ── panel ────────────────────────────────────────────────────────────────────
export function TripsPanel() {
  const { data: employees = [] } = useEmployeesQuery();
  const linked = useMemo(() => employees.filter((e) => e.deviceUuid), [employees]);
  const [deviceUuid, setDeviceUuid] = useState('');
  const [from, setFrom] = useState(startOfToday);
  const [to, setTo] = useState(endOfToday);
  const [applied, setApplied] = useState<{ deviceUuid: string; from: string; to: string } | null>(null);
  const [selected, setSelected] = useState<number | 'all'>('all');

  useEffect(() => { if (!deviceUuid && linked.length > 0) setDeviceUuid(linked[0].deviceUuid!); }, [linked, deviceUuid]);
  useEffect(() => { if (deviceUuid && !applied) setApplied({ deviceUuid, from: `${from}:00`, to: `${to}:59` }); }, [deviceUuid, applied, from, to]);

  const { data: trips = [], isLoading, isFetching, refetch } = useTripsQuery(applied ?? { deviceUuid: '' }, !!applied);
  useEffect(() => { setSelected('all'); }, [trips]);

  const shown = useMemo(() => (selected === 'all' ? trips : trips.filter((t) => t.sessionId === selected)), [trips, selected]);
  const bounds = useMemo(() => shown.flatMap(tripLatLngs), [shown]);
  const totals = useMemo(() => ({
    counted: trips.reduce((a, t) => a + t.countedSeconds, 0),
    inside: trips.reduce((a, t) => a + t.insideShiftSeconds, 0),
    outside: trips.reduce((a, t) => a + t.outsideShiftSeconds, 0),
    dist: trips.reduce((a, t) => a + t.distanceMeters, 0),
  }), [trips]);

  const apply = () => { if (deviceUuid) setApplied({ deviceUuid, from: `${from}:00`, to: `${to}:59` }); };
  const setDay = (d: Date) => { const s = new Date(d); s.setHours(0, 0, 0, 0); const e = new Date(d); e.setHours(23, 59, 0, 0); setFrom(localInputNow(s)); setTo(localInputNow(e)); };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Employee / device">
          <select className={selectClass} value={deviceUuid} onChange={(e) => setDeviceUuid(e.target.value)}>
            {linked.length === 0 && <option value="">No employee has a linked device</option>}
            {linked.map((e) => <option key={e.id} value={e.deviceUuid!}>{e.fullName} ({e.employeeCode}){e.deviceName ? ` · ${e.deviceName}` : ''}</option>)}
          </select>
        </Field>
        <Field label="From"><Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <div className="flex items-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setDay(new Date())}>Today</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setDay(d); }}>Yesterday</Button>
        </div>
        <div className="flex items-end gap-2">
          <Button type="button" onClick={apply} disabled={!deviceUuid} className="flex-1">Show trips</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={!applied} title="Refresh">
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Totals */}
      {trips.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['Trips (in → out)', String(trips.length)],
            ['Duty time', formatDuration(totals.counted)],
            ['Inside shift', formatDuration(totals.inside)],
            ['Outside shift', formatDuration(totals.outside)],
            ['Distance', km(totals.dist)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">{k}</p>
              <p className="text-base font-semibold text-gray-900">{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        {/* Trip list */}
        <div className="flex max-h-[640px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-sm font-semibold text-gray-800">Trips</span>
            {trips.length > 1 && (
              <button type="button" onClick={() => setSelected('all')} className={`text-xs ${selected === 'all' ? 'font-semibold text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>Show all</button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {!applied && <EmptyState text="Pick an employee and a time range." />}
            {applied && isLoading && <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}
            {applied && !isLoading && trips.length === 0 && <EmptyState text="No check-in / check-out in this range." />}
            {trips.map((t, i) => {
              const active = selected === t.sessionId;
              return (
                <button
                  key={t.sessionId}
                  type="button"
                  onClick={() => setSelected(active ? 'all' : t.sessionId)}
                  className={`block w-full border-b border-gray-100 px-3 py-2.5 text-left transition hover:bg-gray-50 ${active ? 'bg-blue-50/60' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: colorFor(i) }}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {fmtDateTime(t.inAt)} → {t.open ? <span className="text-green-700">on duty</span> : fmtTime(t.outAt)}
                      </p>
                      <p className="text-[11px] text-gray-500">{t.rosterDate} · session #{t.sessionNo}{t.shiftStartAt ? ` · shift ${fmtTime(t.shiftStartAt)}–${fmtTime(t.shiftEndAt)}` : ' · no shift'}</p>
                    </div>
                    {t.flagged && <Flag className="h-4 w-4 shrink-0 text-amber-500" aria-label={t.flagReason ?? 'flagged'} />}
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1 text-[11px] text-gray-600">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(t.countedSeconds)}</span>
                    <span className="inline-flex items-center gap-1"><Route className="h-3 w-3" />{km(t.distanceMeters)}</span>
                    <span className="inline-flex items-center gap-1"><Gauge className="h-3 w-3" />{t.maxSpeedKmh != null ? `${t.maxSpeedKmh} km/h` : '—'}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
                    <span>in {formatDuration(t.insideShiftSeconds)} · out {formatDuration(t.outsideShiftSeconds)}</span>
                    <span className="mx-0.5">·</span>
                    <Camera className="h-3 w-3" /><FaceChip score={t.inFaceScore} liveness={t.inLivenessPassed} />
                    {!t.open && <FaceChip score={t.outFaceScore} liveness={t.outLivenessPassed} />}
                    <span className="ml-auto">{t.pointCount} pts</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Map */}
        <div className="h-[640px] overflow-hidden rounded-lg border border-gray-200">
          <MapContainer center={[30.3753, 69.3451]} zoom={5} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds positions={bounds} />
            {shown.map((t) => {
              const i = trips.indexOf(t);
              const color = colorFor(i);
              const pts = (t.points ?? []).map((p) => [p.lat, p.lng] as [number, number]);
              return (
                <Fragment key={t.sessionId}>
                  {pts.length > 1 && <Polyline positions={pts} pathOptions={{ color, weight: 4, opacity: 0.85 }} />}
                  {selected !== 'all' && pts.map((p, j) => (
                    <CircleMarker key={j} center={p} radius={j === 0 || j === pts.length - 1 ? 5 : 3.5} pathOptions={{ color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 1 }}>
                      <Popup>
                        <b>Point {j + 1} / {pts.length}</b><br />
                        {fmtDateTime(t.points![j].at)}<br />
                        {t.points![j].speedKmh != null ? `${t.points![j].speedKmh} km/h` : 'speed —'}
                        {t.points![j].accuracy != null ? ` · ±${Math.round(t.points![j].accuracy!)} m` : ''}
                      </Popup>
                    </CircleMarker>
                  ))}
                  {t.inLat != null && t.inLng != null && (
                    <Marker position={[t.inLat, t.inLng]} icon={pin(color, 'IN')}>
                      <Popup><b>Check-in #{t.sessionNo}</b><br />{fmtDateTime(t.inAt)}<br />{t.inFaceScore != null ? `Face match ${(t.inFaceScore * 100).toFixed(0)}%` : 'No face score'}</Popup>
                    </Marker>
                  )}
                  {!t.open && t.outLat != null && t.outLng != null && (
                    <Marker position={[t.outLat, t.outLng]} icon={pin(color, 'OUT')}>
                      <Popup><b>Check-out #{t.sessionNo}</b><br />{fmtDateTime(t.outAt)}<br />{formatDuration(t.countedSeconds)} · {km(t.distanceMeters)}</Popup>
                    </Marker>
                  )}
                </Fragment>
              );
            })}
          </MapContainer>
        </div>
      </div>
      <p className="flex items-center gap-1 text-[11px] text-gray-400"><MapPin className="h-3 w-3" /> A trip is one check-in → check-out; the trail is the device's normal tracking between the two punches (speed as reported by the device). Times are shown in your browser's time zone.</p>
    </div>
  );
}
