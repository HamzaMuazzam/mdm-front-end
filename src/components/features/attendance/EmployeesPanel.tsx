import { useMemo, useState } from 'react';
import { Plus, Pencil, Search, Smartphone, Trash2, UserRound, Loader2, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissionStore } from '@/store/permissionStore';
import { useDevicesQuery } from '@/hooks/useDevices';
import { useCreateEmployee, useDeleteEmployee, useEmployeesQuery, useUpdateEmployee, useUploadEmployeePhoto } from '@/hooks/useAttendance';
import type { Employee, EmployeeRequest } from '@/types/attendance.types';
import { AttModal, EmptyState, Field, selectClass } from './shared';

function EmployeeDialog({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const { data: devices = [] } = useDevicesQuery();
  const { data: employees = [] } = useEmployeesQuery();
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const [form, setForm] = useState<EmployeeRequest>({
    employeeCode: employee?.employeeCode ?? '',
    fullName: employee?.fullName ?? '',
    designation: employee?.designation ?? '',
    department: employee?.department ?? '',
    phone: employee?.phone ?? '',
    deviceUuid: employee?.deviceUuid ?? '',
    casualLeaveQuota: employee?.casualLeaveQuota ?? 10,
    sickLeaveQuota: employee?.sickLeaveQuota ?? 8,
    annualLeaveQuota: employee?.annualLeaveQuota ?? 14,
    active: employee?.active ?? true,
  });
  const [error, setError] = useState('');
  const takenDevices = useMemo(() => new Set(employees.filter((e) => e.id !== employee?.id && e.deviceUuid).map((e) => e.deviceUuid as string)), [employees, employee]);
  const set = (k: keyof EmployeeRequest, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.employeeCode.trim()) return setError('Employee code is required.');
    if (!form.fullName.trim()) return setError('Full name is required.');
    setError('');
    const payload: EmployeeRequest = { ...form, deviceUuid: form.deviceUuid || null };
    try {
      if (employee) await update.mutateAsync({ id: employee.id, ...payload });
      else await create.mutateAsync(payload);
      onClose();
    } catch { /* toast shown by hook */ }
  };
  const busy = create.isPending || update.isPending;

  return (
    <AttModal title={employee ? 'Edit employee' : 'New employee'} subtitle="One device belongs to exactly one employee" icon={UserRound} onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{employee ? 'Save' : 'Create'}</Button>
      </>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Employee code *"><Input value={form.employeeCode} onChange={(e) => set('employeeCode', e.target.value)} placeholder="EMP-0001" /></Field>
        <Field label="Full name *"><Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
        <Field label="Designation"><Input value={form.designation ?? ''} onChange={(e) => set('designation', e.target.value)} /></Field>
        <Field label="Department"><Input value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} /></Field>
        <Field label="Phone"><Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Linked device" hint="Devices already linked to another employee are hidden.">
          <select className={selectClass} value={form.deviceUuid ?? ''} onChange={(e) => set('deviceUuid', e.target.value)}>
            <option value="">— Not linked —</option>
            {devices.filter((d) => !takenDevices.has(d.deviceUuid)).map((d) => (
              <option key={d.deviceUuid} value={d.deviceUuid}>{d.deviceName} · {d.deviceUuid}</option>
            ))}
          </select>
        </Field>
        <Field label="Casual leave / year"><Input type="number" min={0} value={form.casualLeaveQuota ?? 0} onChange={(e) => set('casualLeaveQuota', Number(e.target.value))} /></Field>
        <Field label="Sick leave / year"><Input type="number" min={0} value={form.sickLeaveQuota ?? 0} onChange={(e) => set('sickLeaveQuota', Number(e.target.value))} /></Field>
        <Field label="Annual leave / year"><Input type="number" min={0} value={form.annualLeaveQuota ?? 0} onChange={(e) => set('annualLeaveQuota', Number(e.target.value))} /></Field>
        <Field label="Status">
          <select className={selectClass} value={form.active ? 'true' : 'false'} onChange={(e) => set('active', e.target.value === 'true')}>
            <option value="true">Active</option><option value="false">Inactive</option>
          </select>
        </Field>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </AttModal>
  );
}

export function EmployeesPanel() {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canManage = hasPermission('attendance:employees:manage');
  const { data: employees = [], isLoading } = useEmployeesQuery();
  const del = useDeleteEmployee();
  const upload = useUploadEmployeePhoto();
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; employee: Employee | null }>({ open: false, employee: null });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => !q || e.fullName.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q) || (e.deviceName ?? '').toLowerCase().includes(q));
  }, [employees, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input className="pl-9" placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {canManage && <Button onClick={() => setDialog({ open: true, employee: null })}><Plus className="mr-2 h-4 w-4" />New employee</Button>}
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        : filtered.length === 0 ? <EmptyState text="No employees yet. Create one and link it to a device to enable attendance." />
        : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Designation</th><th className="px-4 py-3">Device</th><th className="px-4 py-3">Status</th>{canManage && <th className="px-4 py-3 text-right">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{e.employeeCode}</td>
                    <td className="px-4 py-3"><div className="font-medium text-gray-900">{e.fullName}</div><div className="text-xs text-muted-foreground">{e.department ?? ''}</div></td>
                    <td className="px-4 py-3 text-gray-600">{e.designation ?? '—'}</td>
                    <td className="px-4 py-3">{e.deviceUuid ? <span className="inline-flex items-center gap-1 text-gray-700"><Smartphone className="h-3.5 w-3.5" />{e.deviceName ?? e.deviceUuid}</span> : <span className="text-xs text-amber-600">Not linked</span>}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${e.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{e.active ? 'Active' : 'Inactive'}</span></td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <label className="cursor-pointer rounded-md p-1.5 text-gray-500 hover:bg-gray-100" title={e.hasReferencePhoto ? 'Replace reference photo' : 'Upload reference photo'}>
                            <ImagePlus className={`h-4 w-4 ${e.hasReferencePhoto ? 'text-green-600' : ''}`} />
                            <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) upload.mutate({ id: e.id, file: f }); ev.target.value = ''; }} />
                          </label>
                          <button className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" onClick={() => setDialog({ open: true, employee: e })}><Pencil className="h-4 w-4" /></button>
                          {e.active && <button className="rounded-md p-1.5 text-red-500 hover:bg-red-50" onClick={() => { if (window.confirm(`Deactivate ${e.fullName} and unlink the device?`)) del.mutate(e.id); }}><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {dialog.open && <EmployeeDialog employee={dialog.employee} onClose={() => setDialog({ open: false, employee: null })} />}
    </div>
  );
}
