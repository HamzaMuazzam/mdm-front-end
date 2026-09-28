import { useState } from 'react';
import { Plus, Trash2, Check, X, Loader2, CalendarDays, Palmtree, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissionStore } from '@/store/permissionStore';
import {
  useCancelLeave, useCreateHoliday, useCreateLeave, useDecideLeave, useDeleteHoliday, useEmployeesQuery, useHolidaysQuery, useLeaveBalanceQuery, useLeavesQuery,
} from '@/hooks/useAttendance';
import type { LeaveCreateRequest, LeaveStatus, LeaveType } from '@/types/attendance.types';
import { AttModal, EmptyState, Field, selectClass, todayIso } from './shared';

const LEAVE_TYPES: LeaveType[] = ['CASUAL', 'SICK', 'ANNUAL', 'OTHER'];
const STATUS_CLASS: Record<LeaveStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700', APPROVED: 'bg-green-50 text-green-700', REJECTED: 'bg-red-50 text-red-700', CANCELLED: 'bg-gray-100 text-gray-500',
};

function LeaveDialog({ onClose }: { onClose: () => void }) {
  const { data: employees = [] } = useEmployeesQuery();
  const create = useCreateLeave();
  const canApprove = usePermissionStore((s) => s.hasPermission)('attendance:leave:approve');
  const [form, setForm] = useState<LeaveCreateRequest>({ employeeId: employees[0]?.id ?? 0, type: 'CASUAL', fromDate: todayIso(), toDate: todayIso(), reason: '', autoApprove: false });
  const { data: balance } = useLeaveBalanceQuery(form.employeeId || null);
  const set = (k: keyof LeaveCreateRequest, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => { if (!form.employeeId) return; try { await create.mutateAsync(form); onClose(); } catch { /* toast */ } };
  return (
    <AttModal title="New leave" subtitle="Approved leave days are reported as On leave instead of Absent" icon={Palmtree} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={create.isPending || !form.employeeId}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create</Button></>}>
      <Field label="Employee">
        <select className={selectClass} value={form.employeeId} onChange={(e) => set('employeeId', Number(e.target.value))}>
          <option value={0}>— Select —</option>
          {employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
        </select>
      </Field>
      {balance && <div className="flex flex-wrap gap-2 text-[11px]">{balance.lines.map((l) => <span key={l.type} className="rounded-full bg-gray-100 px-2 py-0.5">{l.type}: {l.remaining}/{l.quota} left</span>)}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Type"><select className={selectClass} value={form.type} onChange={(e) => set('type', e.target.value as LeaveType)}>{LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
        <Field label="From"><Input type="date" value={form.fromDate} onChange={(e) => set('fromDate', e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={form.toDate} onChange={(e) => set('toDate', e.target.value)} /></Field>
      </div>
      <Field label="Reason"><Input value={form.reason ?? ''} onChange={(e) => set('reason', e.target.value)} /></Field>
      {canApprove && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.autoApprove} onChange={(e) => set('autoApprove', e.target.checked)} />Approve immediately</label>}
    </AttModal>
  );
}

export function LeaveHolidayPanel() {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canLeave = hasPermission('attendance:leave:manage');
  const canApprove = hasPermission('attendance:leave:approve');
  const canHolidays = hasPermission('attendance:holidays:manage');

  const [status, setStatus] = useState<LeaveStatus | ''>('');
  const { data: leaves = [], isLoading } = useLeavesQuery({ status: status || undefined });
  const decide = useDecideLeave();
  const cancel = useCancelLeave();
  const [leaveDialog, setLeaveDialog] = useState(false);

  const { data: holidays = [] } = useHolidaysQuery();
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const [hName, setHName] = useState('');
  const [hDate, setHDate] = useState(todayIso());
  const [hRecurring, setHRecurring] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
      <section className="space-y-3 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Palmtree className="h-4 w-4 text-blue-600" />Leave requests</h3>
          <div className="flex gap-2">
            <select className={`${selectClass} w-auto`} value={status} onChange={(e) => setStatus(e.target.value as LeaveStatus | '')}>
              <option value="">All statuses</option>{(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as LeaveStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {canLeave && <Button onClick={() => setLeaveDialog(true)}><Plus className="mr-2 h-4 w-4" />New leave</Button>}
          </div>
        </div>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          : leaves.length === 0 ? <EmptyState text="No leave requests." /> : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {leaves.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="font-medium text-gray-900">{l.employeeName}</div><div className="text-xs text-muted-foreground">{l.employeeCode}</div></td>
                      <td className="px-4 py-3">{l.type}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{l.fromDate} → {l.toDate} <span className="text-xs text-muted-foreground">({l.days}d)</span></td>
                      <td className="px-4 py-3 text-gray-600">{l.reason || '—'}{l.decisionNote && <div className="text-xs text-muted-foreground">Note: {l.decisionNote}</div>}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[l.status]}`}>{l.status}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {l.status === 'PENDING' && canApprove && <>
                            <button className="rounded-md p-1.5 text-green-600 hover:bg-green-50" title="Approve" onClick={() => decide.mutate({ id: l.id, approve: true })}><Check className="h-4 w-4" /></button>
                            <button className="rounded-md p-1.5 text-red-500 hover:bg-red-50" title="Reject" onClick={() => { const note = window.prompt('Reason for rejection (optional)') ?? undefined; decide.mutate({ id: l.id, approve: false, note }); }}><X className="h-4 w-4" /></button>
                          </>}
                          {(l.status === 'PENDING' || l.status === 'APPROVED') && canLeave && <button className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" title="Cancel leave" onClick={() => { if (window.confirm('Cancel this leave?')) cancel.mutate(l.id); }}><Ban className="h-4 w-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><CalendarDays className="h-4 w-4 text-blue-600" />Holidays</h3>
        {canHolidays && (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
            <Input placeholder="Holiday name" value={hName} onChange={(e) => setHName(e.target.value)} />
            <div className="flex gap-2"><Input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} /><Button disabled={!hName.trim() || createHoliday.isPending} onClick={async () => { await createHoliday.mutateAsync({ name: hName.trim(), date: hDate, recurringYearly: hRecurring }); setHName(''); }}><Plus className="h-4 w-4" /></Button></div>
            <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={hRecurring} onChange={(e) => setHRecurring(e.target.checked)} />Repeats every year</label>
          </div>
        )}
        {holidays.length === 0 ? <EmptyState text="No holidays configured." /> : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div><div className="font-medium text-gray-900">{h.name}</div><div className="text-xs text-muted-foreground">{h.date}{h.recurringYearly && ' · yearly'}</div></div>
                {canHolidays && <button className="rounded-md p-1.5 text-red-500 hover:bg-red-50" onClick={() => deleteHoliday.mutate(h.id)}><Trash2 className="h-4 w-4" /></button>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {leaveDialog && <LeaveDialog onClose={() => setLeaveDialog(false)} />}
    </div>
  );
}
