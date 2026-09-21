import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, MinusCircle, Loader2, RotateCcw, ChevronRight, Download } from 'lucide-react';
import { useAppControlBatch, useAppControlBatchCommands, useAppControlRetry } from '@/hooks/useAppControl';
import { usePermissionStore } from '@/store/permissionStore';
import { toast } from '@/hooks/useToast';
import {
  APP_CONTROL_ACTION_LABELS,
  APP_CONTROL_METHOD_LABELS,
  APP_CONTROL_PERMISSIONS,
  APP_CONTROL_STATUS_META,
  type AppControlCommand,
  type AppControlStatus,
} from '@/types/appControl.types';

const TONE: Record<string, { chip: string; bar: string; icon: typeof Clock }> = {
  ok: { chip: 'border-green-200 bg-green-50 text-green-700', bar: 'bg-green-500', icon: CheckCircle2 },
  wait: { chip: 'border-blue-200 bg-blue-50 text-blue-700', bar: 'bg-blue-400', icon: Clock },
  warn: { chip: 'border-amber-200 bg-amber-50 text-amber-700', bar: 'bg-amber-400', icon: AlertTriangle },
  bad: { chip: 'border-red-200 bg-red-50 text-red-700', bar: 'bg-red-500', icon: XCircle },
  muted: { chip: 'border-gray-200 bg-gray-50 text-gray-600', bar: 'bg-gray-300', icon: MinusCircle },
};

const ORDER: AppControlStatus[] = ['SUCCESS', 'PARTIAL', 'SENT', 'PENDING', 'FAILED', 'EXPIRED', 'NOT_SUPPORTED', 'PROTECTED', 'NOT_INSTALLED', 'SKIPPED'];

export function StatusChip({ status }: { status: AppControlStatus }) {
  const meta = APP_CONTROL_STATUS_META[status];
  const tone = TONE[meta.tone];
  const Icon = tone.icon;
  return (
    <span title={meta.hint} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${tone.chip}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

/** One short human sentence out of the agent's result detail. */
function describeDetail(c: AppControlCommand): string | null {
  const d = c.resultDetail;
  const parts: string[] = [];
  if (d) {
    if (typeof d.freedBytes === 'number') parts.push(`${(d.freedBytes / (1024 * 1024)).toFixed(1)} MB freed`);
    if (Array.isArray(d.applied) && d.applied.length) parts.push(`${d.state === 'DENY' ? 'Denied' : d.state === 'DEFAULT' ? 'Reset' : 'Granted'}: ${d.applied.join(', ')}`);
    if (Array.isArray(d.skippedNotRequested) && d.skippedNotRequested.length) parts.push(`Not requested by app: ${d.skippedNotRequested.join(', ')}`);
    if (d.failed && typeof d.failed === 'object' && Object.keys(d.failed).length) parts.push(`Could not set: ${Object.keys(d.failed).join(', ')}`);
    if (typeof d.note === 'string') parts.push(d.note);
  }
  if (c.errorMessage) parts.push(c.errorMessage);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Live results of one batch: progress bar, status filter chips, per-device rows that expand to the
 * per-app outcome. Polls while anything is still waiting for a device, then goes quiet.
 */
export function AppControlResults({ batchId, compact = false }: { batchId: number; compact?: boolean }) {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const [filter, setFilter] = useState<AppControlStatus | null>(null);
  const [page, setPage] = useState(0);
  const [openDevice, setOpenDevice] = useState<string | null>(null);

  const { data: batch } = useAppControlBatch(batchId);
  const live = (batch?.openCount ?? 1) > 0;
  const { data: commands, isLoading } = useAppControlBatchCommands(batchId, { page, size: 200, status: filter ? [filter] : undefined }, live);
  const retry = useAppControlRetry();

  const total = batch?.commandCount || 0;
  const counts = batch?.statusCounts || {};
  const settled = total - (batch?.openCount || 0);

  const byDevice = useMemo(() => {
    const map: Record<string, { name: string; rows: AppControlCommand[] }> = {};
    (commands?.content || []).forEach((c) => {
      (map[c.deviceUuid] ||= { name: c.deviceName || c.deviceUuid, rows: [] }).rows.push(c);
    });
    return Object.entries(map);
  }, [commands]);

  const handleRetry = async () => {
    try {
      await retry.mutateAsync(batchId);
      toast({ variant: 'success', title: 'Retry sent', description: 'Failed and expired commands were sent again.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Retry failed', description: error?.response?.data?.message || 'Please try again.' });
    }
  };

  const exportCsv = () => {
    const rows = [['Device', 'Device UUID', 'App', 'Package', 'Action', 'Status', 'Method', 'Detail', 'Executed at']];
    (commands?.content || []).forEach((c) =>
      rows.push([c.deviceName || '', c.deviceUuid, c.appName || '', c.packageName, APP_CONTROL_ACTION_LABELS[c.action],
        APP_CONTROL_STATUS_META[c.status].label, c.method ? APP_CONTROL_METHOD_LABELS[c.method] || c.method : '', describeDetail(c) || '', c.executedAt || ''])
    );
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `app-control-batch-${batchId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!batch) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading results…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`shrink-0 space-y-3 border-b border-border ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">{settled}</span> of {total} answered
            {live ? (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin" /> live
              </span>
            ) : (
              <span className="ml-2 text-xs text-muted-foreground">finished</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50">
              <Download className="h-3 w-3" /> CSV
            </button>
            {batch.retryableCount > 0 && hasPermission(APP_CONTROL_PERMISSIONS.execute) && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={retry.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {retry.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                Retry {batch.retryableCount} failed
              </button>
            )}
          </div>
        </div>

        <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
          {ORDER.map((s) => {
            const n = counts[s] || 0;
            if (!n || !total) return null;
            return <div key={s} className={TONE[APP_CONTROL_STATUS_META[s].tone].bar} style={{ width: `${(n / total) * 100}%` }} title={`${APP_CONTROL_STATUS_META[s].label}: ${n}`} />;
          })}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => { setFilter(null); setPage(0); }}
            className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${filter === null ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            All {total}
          </button>
          {ORDER.filter((s) => counts[s]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setFilter(filter === s ? null : s); setPage(0); }}
              title={APP_CONTROL_STATUS_META[s].hint}
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${filter === s ? 'ring-2 ring-gray-400 ' : ''}${TONE[APP_CONTROL_STATUS_META[s].tone].chip}`}
            >
              {APP_CONTROL_STATUS_META[s].label} {counts[s]}
            </button>
          ))}
        </div>
        {(counts.SENT || counts.PENDING) && batch.expiresAt ? (
          <p className="text-[11px] text-muted-foreground">
            Offline devices run the command when they reconnect — until {new Date(batch.expiresAt).toLocaleDateString()}.
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : byDevice.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nothing here.</div>
        ) : (
          byDevice.map(([uuid, dev]) => {
            const single = dev.rows.length === 1;
            const expanded = single || openDevice === uuid;
            const worst = dev.rows.find((r) => ['FAILED', 'EXPIRED'].includes(r.status)) || dev.rows.find((r) => r.status !== 'SUCCESS') || dev.rows[0];
            return (
              <div key={uuid}>
                <button
                  type="button"
                  disabled={single}
                  onClick={() => setOpenDevice(expanded ? null : uuid)}
                  className={`flex w-full items-center gap-2 text-left ${compact ? 'px-4' : 'px-5'} py-2 ${single ? '' : 'hover:bg-gray-50'}`}
                >
                  {!single && <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{dev.name}</span>
                  {!single && <span className="text-[11px] text-muted-foreground">{dev.rows.length} apps</span>}
                  {!expanded && <StatusChip status={worst.status} />}
                </button>
                {expanded &&
                  dev.rows.map((c) => {
                    const detail = describeDetail(c);
                    return (
                      <div key={c.id} className={`flex items-start gap-2 ${compact ? 'px-4' : 'px-5'} pb-2 ${single ? '' : 'pl-10'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-gray-700">
                            {c.appName || c.packageName} <span className="font-mono text-[10px] text-muted-foreground">{c.appName ? c.packageName : ''}</span>
                          </p>
                          {detail && <p className="text-[11px] text-muted-foreground">{detail}</p>}
                        </div>
                        {c.method && <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{APP_CONTROL_METHOD_LABELS[c.method] || c.method}</span>}
                        <StatusChip status={c.status} />
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>

      {commands && commands.totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-2 text-xs text-muted-foreground">
          <span>Page {commands.number + 1} of {commands.totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={commands.first} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40">Prev</button>
            <button type="button" disabled={commands.last} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
