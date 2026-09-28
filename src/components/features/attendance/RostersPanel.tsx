import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, CalendarClock, MapPin, Users, Loader2, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissionStore } from '@/store/permissionStore';
import { useDevicesQuery } from '@/hooks/useDevices';
import { useDeviceGroupsQuery } from '@/hooks/useDeviceGroups';
import {
  useAssignRoster, useAssignmentsQuery, useCreateRoster, useCreateSite, useDeleteRoster, useDeleteSite, useRostersQuery, useSitesQuery,
  useUnassignRoster, useUpdateRoster, useUpdateSite,
} from '@/hooks/useAttendance';
import { BulkTargetPicker, emptySelection, isSelectionEmpty, selectionToTarget, describeSelection } from '@/components/features/devices/BulkTargetPicker';
import type { AttendanceSite, Roster, RosterRequest, SiteRequest } from '@/types/attendance.types';
import { DAY_LABELS } from '@/types/attendance.types';
import { AttModal, EmptyState, Field, selectClass, todayIso } from './shared';

// ─── Roster dialog ────────────────────────────────────────────────────────────

function RosterDialog({ roster, sites, onClose }: { roster: Roster | null; sites: AttendanceSite[]; onClose: () => void }) {
  const create = useCreateRoster();
  const update = useUpdateRoster();
  const [form, setForm] = useState<RosterRequest>({
    name: roster?.name ?? '', description: roster?.description ?? '',
    startTime: roster?.startTime?.slice(0, 5) ?? '09:00', endTime: roster?.endTime?.slice(0, 5) ?? '18:00',
    workingDays: roster?.workingDays ?? [1, 2, 3, 4, 5], timezone: roster?.timezone ?? 'Asia/Karachi',
    graceMinutes: roster?.graceMinutes ?? 15, earlyLeaveMinutes: roster?.earlyLeaveMinutes ?? 30,
    checkInWindowBeforeMinutes: roster?.checkInWindowBeforeMinutes ?? 60, autoCloseAfterHours: roster?.autoCloseAfterHours ?? 2,
    minDutyMinutes: roster?.minDutyMinutes ?? 0, checkOutSelfieRequired: roster?.checkOutSelfieRequired ?? false,
    siteId: roster?.siteId ?? null, active: roster?.active ?? true,
  });
  const [error, setError] = useState('');
  const set = (k: keyof RosterRequest, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const toggleDay = (d: number) => set('workingDays', form.workingDays.includes(d) ? form.workingDays.filter((x) => x !== d) : [...form.workingDays, d].sort());
  const overnight = form.endTime <= form.startTime;

  const submit = async () => {
    if (!form.name.trim()) return setError('Name is required.');
    if (form.workingDays.length === 0) return setError('Pick at least one working day.');
    setError('');
    try {
      if (roster) await update.mutateAsync({ id: roster.id, ...form });
      else await create.mutateAsync(form);
      onClose();
    } catch { /* toast */ }
  };
  const busy = create.isPending || update.isPending;

  return (
    <AttModal title={roster ? 'Edit roster' : 'New roster'} subtitle="A shift template you assign to devices" onClose={onClose} widthClass="max-w-2xl"
      footer={<><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{roster ? 'Save' : 'Create'}</Button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Morning shift" /></Field>
        <Field label="Site (geofence)" hint="Check-in must happen inside the site when set.">
          <select className={selectClass} value={form.siteId ?? ''} onChange={(e) => set('siteId', e.target.value ? Number(e.target.value) : null)}>
            <option value="">— Any location —</option>
            {sites.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.radiusMeters} m)</option>)}
          </select>
        </Field>
        <Field label="Start time"><Input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} /></Field>
        <Field label="End time" hint={overnight ? 'Ends next day (overnight shift).' : undefined}><Input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} /></Field>
        <div className="sm:col-span-2">
          <Field label="Working days">
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((l, i) => {
                const d = i + 1; const on = form.workingDays.includes(d);
                return <button key={d} type="button" onClick={() => toggleDay(d)} className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{l}</button>;
              })}
            </div>
          </Field>
        </div>
        <Field label="Grace (min)" hint="Late after this."><Input type="number" min={0} value={form.graceMinutes} onChange={(e) => set('graceMinutes', Number(e.target.value))} /></Field>
        <Field label="Early-leave threshold (min)"><Input type="number" min={0} value={form.earlyLeaveMinutes} onChange={(e) => set('earlyLeaveMinutes', Number(e.target.value))} /></Field>
        <Field label="Check-in opens before start (min)"><Input type="number" min={0} value={form.checkInWindowBeforeMinutes} onChange={(e) => set('checkInWindowBeforeMinutes', Number(e.target.value))} /></Field>
        <Field label="Auto check-out after end (hours)" hint="Also the absent cut-off."><Input type="number" min={0} max={12} value={form.autoCloseAfterHours} onChange={(e) => set('autoCloseAfterHours', Number(e.target.value))} /></Field>
        <Field label="Minimum duty (min)"><Input type="number" min={0} value={form.minDutyMinutes} onChange={(e) => set('minDutyMinutes', Number(e.target.value))} /></Field>
        <Field label="Timezone"><Input value={form.timezone ?? ''} onChange={(e) => set('timezone', e.target.value)} /></Field>
        <Field label="Check-out selfie">
          <select className={selectClass} value={form.checkOutSelfieRequired ? 'true' : 'false'} onChange={(e) => set('checkOutSelfieRequired', e.target.value === 'true')}>
            <option value="false">Not required</option><option value="true">Required</option>
          </select>
        </Field>
        <Field label="Status">
          <select className={selectClass} value={form.active ? 'true' : 'false'} onChange={(e) => set('active', e.target.value === 'true')}>
            <option value="true">Active</option><option value="false">Inactive</option>
          </select>
        </Field>
        <div className="sm:col-span-2"><Field label="Description"><Input value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field></div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </AttModal>
  );
}

// ─── Assign dialog (devices + device groups) ─────────────────────────────────

function AssignDialog({ rosters, initialRosterId, onClose }: { rosters: Roster[]; initialRosterId?: number; onClose: () => void }) {
  const { data: devices = [] } = useDevicesQuery();
  const { data: groups = [], isLoading: groupsLoading } = useDeviceGroupsQuery();
  const assign = useAssignRoster();
  const [rosterId, setRosterId] = useState<number>(initialRosterId ?? rosters[0]?.id ?? 0);
  const [selection, setSelection] = useState(emptySelection());
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    if (!rosterId || isSelectionEmpty(selection)) return;
    try {
      const r = await assign.mutateAsync({ rosterId, target: selectionToTarget(selection, groups), effectiveFrom: from, effectiveTo: to || null });
      setResult(`${r.assigned} of ${r.requested} device(s) assigned${r.failed ? `, ${r.failed} failed` : ''}.`);
      if (r.failed === 0) setTimeout(onClose, 900);
    } catch { /* toast */ }
  };

  return (
    <AttModal title="Assign roster" subtitle="Pick devices or whole device groups" icon={Send} onClose={onClose} widthClass="max-w-2xl"
      footer={<>
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={submit} disabled={assign.isPending || !rosterId || isSelectionEmpty(selection)}>{assign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign to {describeSelection(selection, groups) || '…'}</Button>
      </>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Roster">
          <select className={selectClass} value={rosterId} onChange={(e) => setRosterId(Number(e.target.value))}>
            {rosters.filter((r) => r.active).map((r) => <option key={r.id} value={r.id}>{r.name} · {r.startTime.slice(0, 5)}–{r.endTime.slice(0, 5)}</option>)}
          </select>
        </Field>
        <Field label="Effective from"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Effective to (optional)"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <BulkTargetPicker devices={devices} groups={groups} groupsLoading={groupsLoading} value={selection} onChange={setSelection} />
      <p className="text-[11px] text-muted-foreground">An existing open-ended assignment on the same device is closed the day before the new one starts.</p>
      {result && <p className="text-sm text-green-700">{result}</p>}
    </AttModal>
  );
}

// ─── Site dialog ─────────────────────────────────────────────────────────────

function SiteDialog({ site, onClose }: { site: AttendanceSite | null; onClose: () => void }) {
  const create = useCreateSite();
  const update = useUpdateSite();
  const [form, setForm] = useState<SiteRequest>({ name: site?.name ?? '', address: site?.address ?? '', centerLat: site?.centerLat ?? 24.8607, centerLng: site?.centerLng ?? 67.0011, radiusMeters: site?.radiusMeters ?? 200, active: site?.active ?? true });
  const set = (k: keyof SiteRequest, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const [error, setError] = useState('');
  const submit = async () => {
    if (!form.name.trim()) return setError('Name is required.');
    if (Number.isNaN(form.centerLat) || Number.isNaN(form.centerLng)) return setError('Latitude / longitude are required.');
    setError('');
    try { if (site) await update.mutateAsync({ id: site.id, ...form }); else await create.mutateAsync(form); onClose(); } catch { /* toast */ }
  };
  const busy = create.isPending || update.isPending;
  const useMyLocation = () => navigator.geolocation?.getCurrentPosition((p) => { set('centerLat', Number(p.coords.latitude.toFixed(6))); set('centerLng', Number(p.coords.longitude.toFixed(6))); });
  return (
    <AttModal title={site ? 'Edit site' : 'New site'} subtitle="Circular geofence around a workplace" icon={MapPin} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{site ? 'Save' : 'Create'}</Button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Head office" /></Field></div>
        <div className="sm:col-span-2"><Field label="Address"><Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field></div>
        <Field label="Latitude"><Input type="number" step="0.000001" value={form.centerLat} onChange={(e) => set('centerLat', Number(e.target.value))} /></Field>
        <Field label="Longitude"><Input type="number" step="0.000001" value={form.centerLng} onChange={(e) => set('centerLng', Number(e.target.value))} /></Field>
        <Field label="Radius (m)"><Input type="number" min={20} max={50000} value={form.radiusMeters} onChange={(e) => set('radiusMeters', Number(e.target.value))} /></Field>
        <div className="flex items-end"><Button type="button" variant="outline" onClick={useMyLocation}><MapPin className="mr-2 h-4 w-4" />Use my location</Button></div>
      </div>
      <a className="text-xs text-blue-600 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${form.centerLat},${form.centerLng}`}>Preview on Google Maps</a>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </AttModal>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function RostersPanel() {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canCreate = hasPermission('attendance:rosters:create');
  const canUpdate = hasPermission('attendance:rosters:update');
  const canDelete = hasPermission('attendance:rosters:delete');
  const canAssign = hasPermission('attendance:assign');
  const canSites = hasPermission('attendance:sites:manage');

  const { data: rosters = [], isLoading } = useRostersQuery();
  const { data: sites = [] } = useSitesQuery();
  const { data: assignments = [] } = useAssignmentsQuery();
  const deleteRoster = useDeleteRoster();
  const deleteSite = useDeleteSite();
  const unassign = useUnassignRoster();

  const [rosterDialog, setRosterDialog] = useState<{ open: boolean; roster: Roster | null }>({ open: false, roster: null });
  const [siteDialog, setSiteDialog] = useState<{ open: boolean; site: AttendanceSite | null }>({ open: false, site: null });
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; rosterId?: number }>({ open: false });
  const [filterRoster, setFilterRoster] = useState<number | 'all'>('all');

  const visibleAssignments = useMemo(() => assignments.filter((a) => filterRoster === 'all' || a.rosterId === filterRoster), [assignments, filterRoster]);

  return (
    <div className="space-y-8">
      {/* Rosters */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><CalendarClock className="h-4 w-4 text-blue-600" />Rosters (shifts)</h3>
          <div className="flex gap-2">
            {canAssign && rosters.length > 0 && <Button variant="outline" onClick={() => setAssignDialog({ open: true })}><Send className="mr-2 h-4 w-4" />Assign to devices</Button>}
            {canCreate && <Button onClick={() => setRosterDialog({ open: true, roster: null })}><Plus className="mr-2 h-4 w-4" />New roster</Button>}
          </div>
        </div>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          : rosters.length === 0 ? <EmptyState text="No rosters yet. Create a shift template, then assign it to devices or device groups." />
          : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rosters.map((r) => (
                <div key={r.id} className={`rounded-lg border bg-white p-4 ${r.active ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-gray-900">{r.name}</div>
                      <div className="text-sm text-gray-600">{r.startTime.slice(0, 5)} – {r.endTime.slice(0, 5)}{r.overnight && <span className="ml-1 text-xs text-purple-600">(overnight)</span>}</div>
                    </div>
                    <div className="flex gap-1">
                      {canAssign && r.active && <button className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50" title="Assign" onClick={() => setAssignDialog({ open: true, rosterId: r.id })}><Send className="h-4 w-4" /></button>}
                      {canUpdate && <button className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" onClick={() => setRosterDialog({ open: true, roster: r })}><Pencil className="h-4 w-4" /></button>}
                      {canDelete && r.active && <button className="rounded-md p-1.5 text-red-500 hover:bg-red-50" onClick={() => { if (window.confirm(`Deactivate roster "${r.name}"?`)) deleteRoster.mutate(r.id); }}><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {DAY_LABELS.map((l, i) => <span key={l} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${r.workingDays.includes(i + 1) ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>{l}</span>)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>Grace {r.graceMinutes} min</span><span>Early-leave {r.earlyLeaveMinutes} min</span><span>Auto-close +{r.autoCloseAfterHours} h</span>
                    {r.siteName && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.siteName}</span>}
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{r.assignedDeviceCount} device(s)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
      </section>

      {/* Assignments */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Device assignments</h3>
          <select className={`${selectClass} w-auto`} value={filterRoster} onChange={(e) => setFilterRoster(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">All rosters</option>
            {rosters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        {visibleAssignments.length === 0 ? <EmptyState text="No devices assigned yet." /> : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-3">Device</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Roster</th><th className="px-4 py-3">Effective</th><th className="px-4 py-3">By</th>{canAssign && <th className="px-4 py-3 text-right">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="font-medium text-gray-900">{a.deviceName}</div><div className="font-mono text-[11px] text-muted-foreground">{a.deviceUuid}</div></td>
                    <td className="px-4 py-3">{a.employeeName ? <>{a.employeeName} <span className="text-xs text-muted-foreground">({a.employeeCode})</span></> : <span className="text-xs text-amber-600">No employee linked</span>}</td>
                    <td className="px-4 py-3">{a.rosterName}</td>
                    <td className="px-4 py-3 text-gray-600">{a.effectiveFrom} → {a.effectiveTo ?? 'open'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.assignedByEmail ?? '—'}</td>
                    {canAssign && <td className="px-4 py-3 text-right"><button className="rounded-md p-1.5 text-red-500 hover:bg-red-50" title="Remove assignment" onClick={() => { if (window.confirm(`Remove ${a.deviceName} from ${a.rosterName}?`)) unassign.mutate(a.id); }}><XCircle className="h-4 w-4" /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sites */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><MapPin className="h-4 w-4 text-blue-600" />Sites (geofences)</h3>
          {canSites && <Button variant="outline" onClick={() => setSiteDialog({ open: true, site: null })}><Plus className="mr-2 h-4 w-4" />New site</Button>}
        </div>
        {sites.length === 0 ? <EmptyState text="No sites. Add a site to require check-in at a specific location." /> : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sites.map((s) => (
              <div key={s.id} className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-4">
                <div>
                  <div className="font-semibold text-gray-900">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.address || `${s.centerLat.toFixed(5)}, ${s.centerLng.toFixed(5)}`}</div>
                  <div className="mt-1 text-xs text-gray-600">Radius {s.radiusMeters} m · used by {s.rosterCount} roster(s)</div>
                </div>
                {canSites && (
                  <div className="flex gap-1">
                    <button className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" onClick={() => setSiteDialog({ open: true, site: s })}><Pencil className="h-4 w-4" /></button>
                    <button className="rounded-md p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-40" disabled={s.rosterCount > 0} title={s.rosterCount > 0 ? 'Unlink from rosters first' : 'Delete'} onClick={() => { if (window.confirm(`Delete site "${s.name}"?`)) deleteSite.mutate(s.id); }}><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {rosterDialog.open && <RosterDialog roster={rosterDialog.roster} sites={sites} onClose={() => setRosterDialog({ open: false, roster: null })} />}
      {siteDialog.open && <SiteDialog site={siteDialog.site} onClose={() => setSiteDialog({ open: false, site: null })} />}
      {assignDialog.open && <AssignDialog rosters={rosters} initialRosterId={assignDialog.rosterId} onClose={() => setAssignDialog({ open: false })} />}
    </div>
  );
}
