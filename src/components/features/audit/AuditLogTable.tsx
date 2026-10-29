import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Download, Filter, FolderDown, Loader2, RefreshCw, Search, Settings2, ShieldCheck, X,
} from 'lucide-react';
import { usePermissionStore } from '@/store/permissionStore';
import { useAuditExport, useAuditFacets, useAuditHealth, useAuditSearch, useAuditSummary, useAuditVerify, useDeviceAudit } from '@/hooks/useAuditLogs';
import type { AuditEvent, AuditFilter } from '@/types/audit.types';
import { PERMISSIONS } from '@/utils/permissions';
import { AuditEventDrawer } from './AuditEventDrawer';
import { AuditExportJobsDrawer } from './AuditExportJobsDrawer';
import { AuditSettingsDialog } from './AuditSettingsDialog';
import { CATEGORY_LABEL, OUTCOME_CLASS, RANGE_PRESETS, SEVERITY_STRIPE, fmtTime, humanAction } from './auditMeta';

const PAGE_SIZE = 50;

interface Props {
  /** When set, the table is the device Audit tab: fixed device, no device column, no tiles. */
  deviceId?: number;
}

function Tile({ label, value, tone = 'gray', onClick, active }: { label: string; value: number | string; tone?: 'gray' | 'red' | 'amber' | 'blue'; onClick?: () => void; active?: boolean }) {
  const tones = { gray: 'text-gray-900', red: 'text-red-700', amber: 'text-amber-700', blue: 'text-blue-700' };
  return (
    <button type="button" onClick={onClick} className={`text-left rounded-lg border px-3 py-2 bg-white hover:bg-gray-50 transition-colors ${active ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'}`}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
    </button>
  );
}

function MultiSelect({ label, options, value, onChange, format }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; format?: (s: string) => string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs ${value.length ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-700'} hover:bg-gray-50`}>
        {label}{value.length ? ` · ${value.length}` : ''}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 w-64 max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg p-1">
            {options.length === 0 && <p className="px-2 py-1.5 text-xs text-gray-400">Nothing in this range</p>}
            {options.map((o) => {
              const checked = value.includes(o);
              return (
                <label key={o} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-gray-50 rounded cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => onChange(checked ? value.filter((v) => v !== o) : [...value, o])} />
                  <span className="truncate">{format ? format(o) : o}</span>
                </label>
              );
            })}
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="w-full text-left px-2 py-1 text-[11px] text-blue-600 hover:underline">Clear</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function AuditLogTable({ deviceId }: Props) {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canExport = hasPermission(PERMISSIONS.AUDIT_LOGS_EXPORT);
  const canVerify = hasPermission(PERMISSIONS.AUDIT_LOGS_SETTINGS);
  const embedded = deviceId !== undefined;

  // Filters live in the URL so a view can be bookmarked / pasted into a ticket.
  const [sp, setSp] = useSearchParams();
  const get = (k: string) => sp.get(`a_${k}`) ?? '';
  const getList = (k: string) => sp.getAll(`a_${k}`);
  const set = (patch: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => {
      next.delete(`a_${k}`);
      if (Array.isArray(v)) v.forEach((x) => next.append(`a_${k}`, x));
      else if (v) next.set(`a_${k}`, v);
    });
    if (!('page' in patch)) next.delete('a_page');
    setSp(next, { replace: true });
  };

  const range = get('range') || '24h';
  const page = parseInt(get('page') || '0', 10) || 0;
  const [q, setQ] = useState(get('q'));

  const filter = useMemo<AuditFilter>(() => {
    const now = new Date();
    const preset = RANGE_PRESETS.find((p) => p.key === range);
    const from = get('from') || (preset ? new Date(now.getTime() - preset.hours * 3600_000).toISOString() : undefined);
    const to = get('to') || undefined;
    return {
      from, to,
      category: getList('category'), action: getList('action'), outcome: getList('outcome'), severity: getList('severity'),
      actorType: get('actorType') || undefined, actor: get('actor') || undefined,
      targetType: get('targetType') || undefined, ip: get('ip') || undefined, permission: get('permission') || undefined,
      q: get('q') || undefined, deviceId, page, size: PAGE_SIZE,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, deviceId]);

  const searchQ = useAuditSearch(filter, !embedded);
  const deviceQ = useDeviceAudit(deviceId ?? null, filter, embedded);
  const { data, isLoading, isFetching, isError, refetch } = embedded ? deviceQ : searchQ;
  const { data: summary } = useAuditSummary({ from: filter.from, to: filter.to, deviceId }, true);
  const { data: facets } = useAuditFacets(filter);
  const { data: health } = useAuditHealth();
  const exportMut = useAuditExport();
  const verifyMut = useAuditVerify();
  const [selected, setSelected] = useState<number | null>(null);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const rows: AuditEvent[] = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const total = data?.totalElements ?? 0;
  const activeChips: { k: string; label: string }[] = [];
  (['category', 'action', 'outcome', 'severity'] as const).forEach((k) => getList(k).forEach((v) => activeChips.push({ k, label: `${k}: ${v}` })));
  (['actorType', 'actor', 'targetType', 'ip', 'permission', 'q'] as const).forEach((k) => { if (get(k)) activeChips.push({ k, label: `${k}: ${get(k)}` }); });

  const writeFailures = health && health.failedWrites > 0;

  return (
    <div className="space-y-3">
      {writeFailures && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{health.failedWrites} audit event(s) could not be recorded{health.lastFailureAt ? ` (last at ${fmtTime(health.lastFailureAt)})` : ''}.</p>
            <p className="text-red-700">{health.lastFailureMessage ?? 'Check the backend log.'} The gap itself is visible to auditors; do not ignore it.</p>
          </div>
        </div>
      )}

      {!embedded && summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Tile label="Events" value={summary.total.toLocaleString()} />
          <Tile label="Failures" value={summary.byOutcome?.FAILURE ?? 0} tone="red" active={getList('outcome').includes('FAILURE')} onClick={() => set({ outcome: ['FAILURE'] })} />
          <Tile label="Denied" value={summary.denied} tone="red" active={getList('outcome').includes('DENIED')} onClick={() => set({ outcome: ['DENIED'] })} />
          <Tile label="Login failures" value={summary.loginFailures} tone="amber" active={getList('action').includes('LOGIN_FAILURE')} onClick={() => set({ action: ['LOGIN_FAILURE'] })} />
          <Tile label="Pending commands" value={summary.pendingCommands} tone="amber" active={getList('outcome').includes('PENDING')} onClick={() => set({ outcome: ['PENDING'] })} />
          <Tile label="Exports" value={summary.exports} tone="blue" active={getList('category').includes('EXPORT')} onClick={() => set({ category: ['EXPORT'] })} />
        </div>
      )}

      {/* filter bar */}
      <div className="rounded-lg border border-gray-200 bg-white p-2 flex flex-wrap items-center gap-2">
        <select value={range} onChange={(e) => set({ range: e.target.value, from: null, to: null })} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white">
          {RANGE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          <option value="custom">Custom…</option>
        </select>
        {range === 'custom' && (
          <>
            <input type="datetime-local" value={get('from') ? get('from').slice(0, 16) : ''} onChange={(e) => set({ from: e.target.value ? new Date(e.target.value).toISOString() : null })} className="rounded-md border border-gray-200 px-2 py-1 text-xs" />
            <span className="text-xs text-gray-400">to</span>
            <input type="datetime-local" value={get('to') ? get('to').slice(0, 16) : ''} onChange={(e) => set({ to: e.target.value ? new Date(e.target.value).toISOString() : null })} className="rounded-md border border-gray-200 px-2 py-1 text-xs" />
          </>
        )}
        <MultiSelect label="Category" options={facets?.categories ?? []} value={getList('category')} onChange={(v) => set({ category: v })} format={(c) => CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL] ?? c} />
        <MultiSelect label="Action" options={facets?.actions ?? []} value={getList('action')} onChange={(v) => set({ action: v })} format={humanAction} />
        <MultiSelect label="Outcome" options={facets?.outcomes ?? []} value={getList('outcome')} onChange={(v) => set({ outcome: v })} />
        <MultiSelect label="Severity" options={facets?.severities ?? []} value={getList('severity')} onChange={(v) => set({ severity: v })} />
        <select value={get('actorType')} onChange={(e) => set({ actorType: e.target.value || null })} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs bg-white">
          <option value="">Any actor</option><option value="USER">Users</option><option value="DEVICE">Devices</option><option value="SYSTEM">System</option><option value="ANONYMOUS">Anonymous</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); set({ q }); }} className="flex items-center gap-1 flex-1 min-w-[180px]">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, action, target, IP, details…" className="w-full rounded-md border border-gray-200 pl-7 pr-2 py-1.5 text-xs" />
          </div>
          <button type="submit" className="rounded-md border border-gray-200 px-2 py-1.5 text-xs hover:bg-gray-50"><Filter className="h-3.5 w-3.5" /></button>
        </form>
        <button type="button" onClick={() => refetch()} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs hover:bg-gray-50" title="Refresh"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /></button>
        {canExport && (
          <div className="flex items-center gap-1">
            <button type="button" disabled={exportMut.isPending} onClick={() => exportMut.mutate({ filter: { ...filter, page: undefined, size: undefined }, format: 'csv' })} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {exportMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} CSV
            </button>
            <button type="button" disabled={exportMut.isPending} onClick={() => exportMut.mutate({ filter: { ...filter, page: undefined, size: undefined }, format: 'jsonl' })} className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs hover:bg-gray-50">JSONL</button>
            <button type="button" onClick={() => setJobsOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs hover:bg-gray-50" title="Async export jobs"><FolderDown className="h-3.5 w-3.5" /> Exports</button>
          </div>
        )}
        {canVerify && !embedded && (
          <button type="button" onClick={() => setSettingsOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs hover:bg-gray-50" title="Retention, alerts, SIEM"><Settings2 className="h-3.5 w-3.5" /> Settings</button>
        )}
        {canVerify && !embedded && (
          <button type="button" disabled={verifyMut.isPending} onClick={() => verifyMut.mutate({ from: filter.from ?? new Date(0).toISOString(), to: filter.to ?? new Date().toISOString() })} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs hover:bg-gray-50" title="Recompute the hash chain for this range">
            {verifyMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Verify
          </button>
        )}
      </div>

      {verifyMut.data && (
        <div className={`rounded-md border px-3 py-2 text-xs ${verifyMut.data.result === 'PASS' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          <span className="font-semibold">Integrity {verifyMut.data.result}</span> · {verifyMut.data.rowsChecked.toLocaleString()} of {verifyMut.data.rowsInRange.toLocaleString()} rows verified
          {verifyMut.data.firstBadRowId !== null && <> · first broken row <button type="button" className="underline" onClick={() => setSelected(verifyMut.data!.firstBadRowId)}>#{verifyMut.data.firstBadRowId}</button> ({verifyMut.data.reason})</>}
        </div>
      )}

      {activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activeChips.map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
              {c.label}
              <button type="button" onClick={() => { const list = getList(c.k); set({ [c.k]: list.length ? list.filter((v) => `${c.k}: ${v}` !== c.label) : null }); if (c.k === 'q') setQ(''); }}><X className="h-3 w-3" /></button>
            </span>
          ))}
          <button type="button" onClick={() => { setQ(''); set({ category: null, action: null, outcome: null, severity: null, actorType: null, actor: null, targetType: null, ip: null, permission: null, q: null }); }} className="text-[11px] text-blue-600 hover:underline px-1">Clear all</button>
        </div>
      )}

      {/* table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="hidden md:grid grid-cols-[6px_150px_1fr_1.2fr_1fr_90px_110px_60px] gap-2 px-3 py-2 bg-gray-50 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
          <span /><span>Time</span><span>Actor</span><span>Action</span><span>{embedded ? 'Target' : 'Target / device'}</span><span>Outcome</span><span>IP</span><span className="text-right">ms</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : isError ? (
          <p className="px-4 py-8 text-center text-sm text-red-600">Could not load audit events.</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">No events match this filter.</p>
        ) : rows.map((r) => (
          <button type="button" key={r.id} onClick={() => setSelected(r.id)} className="w-full text-left grid grid-cols-1 md:grid-cols-[6px_150px_1fr_1.2fr_1fr_90px_110px_60px] gap-1 md:gap-2 px-3 py-2 border-t border-gray-100 hover:bg-gray-50 text-xs items-center">
            <span className={`hidden md:block h-6 w-1 rounded ${SEVERITY_STRIPE[r.severity]}`} />
            <span className="text-gray-600 tabular-nums" title={r.eventTime}>{fmtTime(r.eventTime)}</span>
            <span className="truncate text-gray-900">
              {r.actorLabel ?? <span className="text-gray-400">{r.actorType.toLowerCase()}</span>}
              {r.actorSecurityGroup && <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] text-gray-500">{r.actorSecurityGroup}</span>}
            </span>
            <span className="truncate text-gray-900">
              <span className={`md:hidden inline-block h-2 w-2 rounded-full mr-1 ${SEVERITY_STRIPE[r.severity]}`} />
              {humanAction(r.action)}
              <span className="ml-1 text-[10px] text-gray-400">{CATEGORY_LABEL[r.category] ?? r.category}</span>
            </span>
            <span className="truncate text-gray-700">{r.targetLabel ?? r.targetId ?? r.pathTemplate ?? '—'}{!embedded && r.deviceUuid && r.targetType !== 'DEVICE' ? <span className="text-gray-400"> · {r.deviceUuid.slice(0, 8)}</span> : null}</span>
            <span><span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${OUTCOME_CLASS[r.outcome]}`}>{r.outcome}</span>{r.httpStatus ? <span className="ml-1 text-[10px] text-gray-400">{r.httpStatus}</span> : null}</span>
            <span className="font-mono text-[11px] text-gray-600 truncate">{r.clientIp ?? ''}</span>
            <span className="hidden md:block text-right tabular-nums text-gray-500">{r.durationMs ?? ''}</span>
          </button>
        ))}
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 text-xs text-gray-500">
          <span>{total.toLocaleString()} event{total === 1 ? '' : 's'}{health?.lastWriteAt ? ` · last write ${fmtTime(health.lastWriteAt)}` : ''}</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 0} onClick={() => set({ page: String(page - 1) })} className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span className="tabular-nums">{totalPages === 0 ? 0 : page + 1} / {totalPages}</span>
            <button type="button" disabled={page + 1 >= totalPages} onClick={() => set({ page: String(page + 1) })} className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <AuditEventDrawer eventId={selected} onClose={() => setSelected(null)} />
      <AuditExportJobsDrawer open={jobsOpen} onClose={() => setJobsOpen(false)} />
      <AuditSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
