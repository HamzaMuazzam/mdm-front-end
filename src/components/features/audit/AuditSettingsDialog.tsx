import { useEffect, useState } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { useAuditSettings, useUpdateAuditSettings } from '@/hooks/useAuditLogs';
import type { AuditSettings } from '@/types/audit.types';
import { CATEGORY_LABEL } from './auditMeta';

const CATEGORIES = Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-xs">
      <span className="text-gray-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

const input = 'w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs';

export function AuditSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading } = useAuditSettings(open);
  const save = useUpdateAuditSettings();
  const [form, setForm] = useState<AuditSettings | null>(null);
  const [emails, setEmails] = useState('');
  useEffect(() => { if (data) { setForm(data); setEmails(data.alertEmails.join(', ')); } }, [data]);
  if (!open) return null;
  const f = form;
  const set = (patch: Partial<AuditSettings>) => setForm((p) => (p ? { ...p, ...patch } : p));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col">
        <div className="h-14 px-4 flex items-center gap-3 border-b border-gray-200">
          <p className="flex-1 text-sm font-semibold text-gray-900">Audit settings</p>
          <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-gray-100 text-gray-500"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {isLoading || !f ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <section>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Retention (days)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Field label="Default"><input type="number" min={1} className={input} value={f.defaultRetentionDays} onChange={(e) => set({ defaultRetentionDays: Number(e.target.value) })} /></Field>
                  {CATEGORIES.map((c) => (
                    <Field key={c} label={CATEGORY_LABEL[c]}>
                      <input type="number" min={1} className={input} placeholder={String(f.defaultRetentionDays)} value={f.retentionDays[c] ?? ''}
                        onChange={(e) => { const v = e.target.value; const rd = { ...f.retentionDays }; if (v) rd[c] = Number(v); else delete rd[c]; set({ retentionDays: rd }); }} />
                    </Field>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Monthly partitions are archived to uploads/audit-archive as JSONL.gz and then dropped once every category in them is past its retention.</p>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">E-mail alerts</h3>
                <Field label="Recipients (comma-separated)" hint="Leave empty to disable e-mail alerts.">
                  <input className={input} value={emails} onChange={(e) => { setEmails(e.target.value); set({ alertEmails: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }); }} placeholder="soc@bank.com, itsec@bank.com" />
                </Field>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={f.alertOnCritical} onChange={(e) => set({ alertOnCritical: e.target.checked })} /> Critical actions (wipe, clear data, SOS…)</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={f.alertOnLockout} onChange={(e) => set({ alertOnLockout: e.target.checked })} /> Account lockouts</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={f.alertOnPermissionChange} onChange={(e) => set({ alertOnPermissionChange: e.target.checked })} /> Security / permission changes</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={f.alertOnIntegrityFail} onChange={(e) => set({ alertOnIntegrityFail: e.target.checked })} /> Integrity check FAIL</label>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">SIEM forwarding (syslog / CEF)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Field label="Host"><input className={input} value={f.syslogHost ?? ''} onChange={(e) => set({ syslogHost: e.target.value })} placeholder="empty = off" /></Field>
                  <Field label="Port"><input type="number" className={input} value={f.syslogPort} onChange={(e) => set({ syslogPort: Number(e.target.value) })} /></Field>
                  <Field label="Protocol">
                    <select className={input} value={f.syslogProtocol} onChange={(e) => set({ syslogProtocol: e.target.value as 'UDP' | 'TCP' })}><option>UDP</option><option>TCP</option></select>
                  </Field>
                  <Field label="Min severity">
                    <select className={input} value={f.syslogMinSeverity} onChange={(e) => set({ syslogMinSeverity: e.target.value as AuditSettings['syslogMinSeverity'] })}>
                      <option>INFO</option><option>NOTICE</option><option>HIGH</option><option>CRITICAL</option>
                    </select>
                  </Field>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Daily export &amp; lockout</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.dailyExportEnabled} onChange={(e) => set({ dailyExportEnabled: e.target.checked })} /> Daily JSONL.gz export</label>
                  <Field label="Pickup directory"><input className={input} value={f.dailyExportDir} onChange={(e) => set({ dailyExportDir: e.target.value })} /></Field>
                  <Field label="Lockout after N failures"><input type="number" min={1} className={input} value={f.lockoutThreshold} onChange={(e) => set({ lockoutThreshold: Number(e.target.value) })} /></Field>
                  <Field label="Lock for (min)"><input type="number" min={1} className={input} value={f.lockoutMinutes} onChange={(e) => set({ lockoutMinutes: Number(e.target.value) })} /></Field>
                </div>
              </section>
            </>
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50">Cancel</button>
          <button type="button" disabled={!f || save.isPending} onClick={() => f && save.mutate(f, { onSuccess: onClose })} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
