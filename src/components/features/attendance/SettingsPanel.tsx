import { useEffect, useState } from 'react';
import { Loader2, Save, ScanFace, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissionStore } from '@/store/permissionStore';
import { useAttendanceSettingsQuery, useUpdateAttendanceSettings } from '@/hooks/useAttendance';
import type { AttendanceSettings, FaceMatchMode, MissingReferencePolicy } from '@/types/attendance.types';
import { EmptyState, selectClass } from './shared';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${checked ? 'bg-blue-600' : 'bg-gray-300'} ${disabled ? 'opacity-50' : ''}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-xl"><div className="text-sm font-medium text-gray-900">{title}</div><div className="text-xs text-muted-foreground">{description}</div></div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPanel() {
  const canEdit = usePermissionStore((s) => s.hasPermission)('attendance:settings');
  const { data, isLoading } = useAttendanceSettingsQuery();
  const update = useUpdateAttendanceSettings();
  const [form, setForm] = useState<AttendanceSettings | null>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);
  const set = <K extends keyof AttendanceSettings>(k: K, v: AttendanceSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  if (isLoading || !form) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  if (!data) return <EmptyState text="Settings unavailable." />;
  const dirty = JSON.stringify(form) !== JSON.stringify(data);

  return (
    <div className="max-w-3xl space-y-6">
      <div className={`flex items-start gap-3 rounded-lg border p-4 ${data.faceServiceAvailable ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        <ScanFace className={`mt-0.5 h-5 w-5 ${data.faceServiceAvailable ? 'text-green-700' : 'text-amber-700'}`} />
        <div className="text-sm">
          <div className="font-medium text-gray-900">Face recognition service: {data.faceServiceAvailable ? 'running' : 'unavailable'}</div>
          <div className="text-xs text-muted-foreground">
            {data.faceServiceAvailable
              ? 'Embedded in the backend (OpenCV YuNet + SFace). Every selfie is compared with the employee\'s enrolled reference photo.'
              : `Selfies are accepted without face verification until it recovers. ${data.faceServiceStatus ?? ''}`}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white px-5">
        <Row title="Face verification" description="What happens when the selfie does not match the enrolled photo. Block rejects the punch and notifies admins; Flag accepts it but marks the record for review.">
          <select className={`${selectClass} w-44`} disabled={!canEdit} value={form.faceMatchMode} onChange={(e) => set('faceMatchMode', e.target.value as FaceMatchMode)}>
            <option value="BLOCK">Block + notify</option><option value="FLAG">Flag only</option><option value="OFF">Off</option>
          </select>
        </Row>
        <Row title="Match threshold" description="Minimum similarity (0–1) to accept. 0.363 is the recommended value for SFace; raise it for stricter matching, lower it if genuine employees get rejected in poor light.">
          <Input type="number" step="0.01" min={0.1} max={0.95} className="w-28" disabled={!canEdit} value={form.faceMatchThreshold} onChange={(e) => set('faceMatchThreshold', Number(e.target.value))} />
        </Row>
        <Row title="Employee without reference photo" description="Until an admin uploads a photo, allow the punch and flag it, or block it.">
          <select className={`${selectClass} w-44`} disabled={!canEdit} value={form.missingReferencePolicy} onChange={(e) => set('missingReferencePolicy', e.target.value as MissingReferencePolicy)}>
            <option value="ALLOW_FLAG">Allow + flag</option><option value="BLOCK">Block</option>
          </select>
        </Row>
        <Row title="Photo / screen replay detection" description={`Passive anti-spoofing on every selfie (MiniFASNet). Catches printed photos and videos played on another phone. ${data.antiSpoofAvailable ? '' : 'Model not loaded on the server — selfies are not checked until it is.'}`}>
          <select className={`${selectClass} w-44`} disabled={!canEdit} value={form.antiSpoofMode} onChange={(e) => set('antiSpoofMode', e.target.value as FaceMatchMode)}>
            <option value="BLOCK">Block + notify</option><option value="FLAG">Flag only</option><option value="OFF">Off</option>
          </select>
        </Row>
        <Row title="Live-face threshold" description="Minimum 'real face' probability (0–1). 0.5 is the model default; raise it to be stricter.">
          <Input type="number" step="0.05" min={0.1} max={0.95} className="w-28" disabled={!canEdit} value={form.antiSpoofThreshold} onChange={(e) => set('antiSpoofThreshold', Number(e.target.value))} />
        </Row>
        <Row title="Liveness challenge" description="Require a random two-step challenge on the device (blink, smile, turn left/right in random order) before the selfie is taken. When off, the device only needs one steady face in frame; the server-side replay detection above still applies.">
          <Toggle checked={form.livenessRequired} disabled={!canEdit} onChange={(v) => set('livenessRequired', v)} />
        </Row>
        <Row title="Site geofence" description="Check-in must happen inside the roster's site when one is bound. GPS must be on in all cases.">
          <Toggle checked={form.siteRequired} disabled={!canEdit} onChange={(v) => set('siteRequired', v)} />
        </Row>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{data.updatedByEmail ? `Last changed by ${data.updatedByEmail}` : 'Defaults — not saved yet'}</div>
        {canEdit && <Button disabled={!dirty || update.isPending} onClick={() => update.mutate(form)}>{update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save settings</Button>}
      </div>
      <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Employees can check in and out any number of times, before, during and after the shift. Time inside and outside the scheduled shift is reported separately.</div>
    </div>
  );
}
