import { useEffect, useMemo, useState } from 'react';
import { Loader2, Camera, Flag, Pencil, ShieldAlert, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissionStore } from '@/store/permissionStore';
import { attendanceService } from '@/api/services/attendance.service';
import { useOverrideRecord, useRecordQuery, useRecordsQuery } from '@/hooks/useAttendance';
import { ATTENDANCE_STATUS_LABELS, formatDuration, type AttendanceRecord, type AttendanceStatus } from '@/types/attendance.types';
import { AttModal, EmptyState, Field, StatusBadge, fmtDateTime, fmtTime, selectClass, toInputDateTime, todayIso } from './shared';

const STATUSES = Object.keys(ATTENDANCE_STATUS_LABELS) as AttendanceStatus[];

function Selfie({ id, checkOut = false, session, size = 'lg' }: { id: number; checkOut?: boolean; session?: number; size?: 'lg' | 'sm' }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const box = size === 'lg' ? 'h-40 w-32' : 'h-20 w-16';
  useEffect(() => {
    let active = true; let objectUrl: string | null = null;
    attendanceService.selfieObjectUrl(id, checkOut, session).then((u) => { if (active) { objectUrl = u; setUrl(u); } else window.URL.revokeObjectURL(u); }).catch(() => active && setFailed(true));
    return () => { active = false; if (objectUrl) window.URL.revokeObjectURL(objectUrl); };
  }, [id, checkOut, session]);
  if (failed) return <div className={`flex ${box} items-center justify-center rounded-md bg-gray-100 text-[10px] text-muted-foreground`}>No image</div>;
  if (!url) return <div className={`flex ${box} items-center justify-center rounded-md bg-gray-100`}><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>;
  return <img src={url} alt={checkOut ? 'Check-out selfie' : 'Check-in selfie'} className={`${box} rounded-md object-cover shadow`} />;
}

function FaceScore({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-[10px] text-muted-foreground">face n/a</span>;
  const ok = score >= 0.363;
  return <span className={`text-[10px] font-medium ${ok ? 'text-green-700' : 'text-red-700'}`}>face {score.toFixed(2)}</span>;
}

function OverrideDialog({ record, onClose }: { record: AttendanceRecord; onClose: () => void }) {
  const override = useOverrideRecord();
  const [status, setStatus] = useState<AttendanceStatus | ''>('');
  const [checkInAt, setCheckInAt] = useState(toInputDateTime(record.checkInAt));
  const [checkOutAt, setCheckOutAt] = useState(toInputDateTime(record.checkOutAt));
  const [reason, setReason] = useState('');
  const submit = async () => {
    if (!reason.trim()) return;
    try {
      await override.mutateAsync({
        id: record.id, reason: reason.trim(), status: status || undefined,
        checkInAt: checkInAt && checkInAt !== toInputDateTime(record.checkInAt) ? `${checkInAt}:00` : undefined,
        checkOutAt: checkOutAt && checkOutAt !== toInputDateTime(record.checkOutAt) ? `${checkOutAt}:00` : undefined,
      });
      onClose();
    } catch { /* toast */ }
  };
  return (
    <AttModal title="Correct record" subtitle="Audited — the original values are kept in the event log" icon={Pencil} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={override.isPending || !reason.trim()}>{override.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save correction</Button></>}>
      <Field label="Status"><select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus | '')}><option value="">Keep ({ATTENDANCE_STATUS_LABELS[record.status]})</option>{STATUSES.map((s) => <option key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</option>)}</select></Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Check-in"><Input type="datetime-local" value={checkInAt} onChange={(e) => setCheckInAt(e.target.value)} /></Field>
        <Field label="Check-out"><Input type="datetime-local" value={checkOutAt} onChange={(e) => setCheckOutAt(e.target.value)} /></Field>
      </div>
      <Field label="Reason *" hint="Shown in the audit trail."><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. device battery died, verified by supervisor" /></Field>
    </AttModal>
  );
}

function RecordDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const { data: r, isLoading } = useRecordQuery(id);
  const [override, setOverride] = useState(false);
  return (
    <AttModal title={r ? `${r.employeeName ?? r.deviceName} · ${r.rosterDate}` : 'Record'} subtitle={r?.rosterName ?? undefined} icon={Clock} onClose={onClose} widthClass="max-w-3xl"
      footer={<>{r && hasPermission('attendance:records:override') && <Button variant="outline" onClick={() => setOverride(true)}><Pencil className="mr-2 h-4 w-4" />Correct</Button>}<Button onClick={onClose}>Close</Button></>}>
      {isLoading || !r ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex gap-3">
              {r.hasSelfie ? <Selfie id={r.id} /> : <div className="flex h-40 w-32 items-center justify-center rounded-md bg-gray-100 text-xs text-muted-foreground"><Camera className="mr-1 h-4 w-4" />No selfie</div>}
              {r.hasCheckOutSelfie && <Selfie id={r.id} checkOut />}
            </div>
            <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="col-span-2 flex items-center gap-2"><StatusBadge status={r.status} />{r.flagged && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"><Flag className="h-3 w-3" />{r.flagReason}</span>}{r.source === 'ADMIN_OVERRIDE' && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">Corrected</span>}</div>
              <div><div className="text-xs text-muted-foreground">Shift</div>{fmtTime(r.shiftStartAt)} – {fmtTime(r.shiftEndAt)}</div>
              <div><div className="text-xs text-muted-foreground">Duty · {r.sessionCount} session{r.sessionCount === 1 ? '' : 's'}</div><span className="font-semibold">{formatDuration(r.totalDutySeconds)}</span><span className="ml-2 text-xs text-green-700">inside {formatDuration(r.insideShiftSeconds)}</span><span className="ml-2 text-xs text-amber-700">outside {formatDuration(r.outsideShiftSeconds)}</span></div>
              <div><div className="text-xs text-muted-foreground">First in</div>{fmtDateTime(r.checkInAt)}{r.lateMinutes > 0 && <span className="ml-1 text-xs text-amber-700">({r.lateMinutes} min late)</span>}</div>
              <div><div className="text-xs text-muted-foreground">Last out</div>{fmtDateTime(r.checkOutAt)}{r.checkOutType && <span className="ml-1 text-xs text-muted-foreground">({r.checkOutType.toLowerCase()})</span>}</div>
              <div className="col-span-2 text-xs text-muted-foreground">
                {r.checkInLat != null && <a className="inline-flex items-center gap-1 text-blue-600 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${r.checkInLat},${r.checkInLng}`}><MapPin className="h-3 w-3" />Check-in location{r.checkInAccuracy != null && ` (±${Math.round(r.checkInAccuracy)} m)`}</a>}
                {r.livenessPassed != null && <span className="ml-3">Liveness: {r.livenessPassed ? 'passed' : 'failed'}</span>}
                <span className="ml-3">Device: {r.deviceName}</span>
              </div>
              {r.note && <div className="col-span-2 rounded-md bg-gray-50 p-2 text-xs">{r.note}</div>}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Check-in / check-out sessions</h4>
            {!r.sessions?.length ? <p className="text-xs text-muted-foreground">No sessions recorded.</p> : (
              <div className="space-y-2">
                {r.sessions.map((s) => (
                  <div key={s.id} className={`rounded-lg border p-3 ${s.flagged ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="font-semibold text-gray-900">Session #{s.sessionNo}{s.open && <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-[10px] text-green-700">open</span>}{s.closeType === 'AUTO' && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">auto-closed</span>}{s.closeType === 'ADMIN' && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">admin</span>}</div>
                      <div><span className="font-medium">{formatDuration(s.countedSeconds)}</span><span className="ml-2 text-green-700">inside {formatDuration(s.insideShiftSeconds)}</span><span className="ml-2 text-amber-700">outside {formatDuration(s.outsideShiftSeconds)}</span></div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        {s.hasInSelfie ? <Selfie id={r.id} session={s.sessionNo} size="sm" /> : <div className="flex h-20 w-16 items-center justify-center rounded-md bg-gray-100 text-[10px] text-muted-foreground">—</div>}
                        <div className="text-xs"><div className="text-muted-foreground">In</div><div className="font-medium">{fmtDateTime(s.inAt)}</div><FaceScore score={s.inFaceScore} />{s.inLat != null && <a className="ml-2 text-blue-600 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${s.inLat},${s.inLng}`}>map</a>}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.hasOutSelfie ? <Selfie id={r.id} session={s.sessionNo} checkOut size="sm" /> : <div className="flex h-20 w-16 items-center justify-center rounded-md bg-gray-100 text-[10px] text-muted-foreground">—</div>}
                        <div className="text-xs"><div className="text-muted-foreground">Out</div><div className="font-medium">{s.outAt ? fmtDateTime(s.outAt) : <span className="text-green-700">running</span>}</div>{s.outAt && <FaceScore score={s.outFaceScore} />}{s.outLat != null && <a className="ml-2 text-blue-600 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${s.outLat},${s.outLng}`}>map</a>}</div>
                      </div>
                    </div>
                    {s.flagReason && <div className="mt-2 text-[11px] text-amber-700">{s.flagReason}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Counted time (GPS pauses excluded)</h4>
            {!r.segments?.length ? <p className="text-xs text-muted-foreground">No duty time recorded.</p> : (
              <table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="py-1">Start</th><th className="py-1">End</th><th className="py-1">Ended by</th><th className="py-1 text-right">Duration</th></tr></thead>
                <tbody>{r.segments.map((s) => <tr key={s.id} className="border-t border-gray-100"><td className="py-1">{fmtDateTime(s.startAt)}</td><td className="py-1">{s.endAt ? fmtDateTime(s.endAt) : <span className="text-green-700">running</span>}</td><td className="py-1">{s.endReason ?? '—'}</td><td className="py-1 text-right">{formatDuration(s.seconds)}</td></tr>)}</tbody></table>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Events</h4>
            {!r.events?.length ? <p className="text-xs text-muted-foreground">No events.</p> : (
              <ul className="space-y-1 text-xs">
                {r.events.map((e) => (
                  <li key={e.id} className={`flex items-start gap-2 rounded-md px-2 py-1 ${e.violation ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700'}`}>
                    {e.violation ? <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />}
                    <span className="w-32 shrink-0 font-mono">{fmtDateTime(e.occurredAt)}</span>
                    <span className="font-medium">{e.type}</span>
                    <span className="text-muted-foreground">{e.details}{e.actorEmail && ` · by ${e.actorEmail}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {override && r && <OverrideDialog record={r} onClose={() => setOverride(false)} />}
    </AttModal>
  );
}

export function RecordsPanel() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState<AttendanceStatus | ''>('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<number | null>(null);
  const { data: records = [], isLoading } = useRecordsQuery({ from, to, status: status || undefined });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => !q || (r.employeeName ?? '').toLowerCase().includes(q) || (r.employeeCode ?? '').toLowerCase().includes(q) || r.deviceName.toLowerCase().includes(q));
  }, [records, search]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex lg:items-end">
        <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Status"><select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus | '')}><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</option>)}</select></Field>
        <Field label="Search"><Input placeholder="Employee / device" value={search} onChange={(e) => setSearch(e.target.value)} /></Field>
      </div>
      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : filtered.length === 0 ? <EmptyState text="No attendance records for this range." />
        : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Roster</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">First in</th><th className="px-4 py-3">Last out</th><th className="px-4 py-3 text-center">In/Out</th><th className="px-4 py-3 text-right">Inside</th><th className="px-4 py-3 text-right">Outside</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setDetail(r.id)}>
                    <td className="px-4 py-3 whitespace-nowrap">{r.rosterDate}</td>
                    <td className="px-4 py-3"><div className="font-medium text-gray-900">{r.employeeName ?? '—'}</div><div className="text-xs text-muted-foreground">{r.employeeCode ?? r.deviceName}</div></td>
                    <td className="px-4 py-3 text-gray-600">{r.rosterName ?? '—'}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1"><StatusBadge status={r.status} />{r.flagged && <Flag className="h-3.5 w-3.5 text-amber-600" />}{r.onDuty && <span className="h-2 w-2 rounded-full bg-green-500" title="On duty now" />}</div></td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtTime(r.checkInAt)}{r.lateMinutes > 0 && <span className="ml-1 text-[10px] text-amber-700">+{r.lateMinutes}m</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtTime(r.checkOutAt)}{r.checkOutType === 'AUTO' && <span className="ml-1 text-[10px] text-muted-foreground">auto</span>}</td>
                    <td className="px-4 py-3 text-center">×{r.sessionCount}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">{formatDuration(r.insideShiftSeconds)}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{formatDuration(r.outsideShiftSeconds)}</td>
                    <td className="px-4 py-3 text-right">{r.hasSelfie && <Camera className="h-4 w-4 text-gray-400" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {detail != null && <RecordDetail id={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
