import { useState } from 'react';
import { Loader2, History } from 'lucide-react';
import { useAppControlBatches } from '@/hooks/useAppControl';
import { APP_CONTROL_ACTION_LABELS, type AppControlAction, type AppControlBatch } from '@/types/appControl.types';
import { AppControlResults } from './AppControlResults';
import { Shell } from './AppActionsModal';

/** Every App Actions batch of the account, newest first; click one for its per-device results. */
export function AppControlHistoryPanel() {
  const [page, setPage] = useState(0);
  const [action, setAction] = useState<AppControlAction | ''>('');
  const [openBatch, setOpenBatch] = useState<AppControlBatch | null>(null);
  const { data, isLoading } = useAppControlBatches({ page, size: 15, action: action || undefined });

  return (
    <div className="rounded-lg border border-border bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><History className="h-4 w-4 text-blue-600" /> App Actions history</h3>
        <select value={action} onChange={(e) => { setAction(e.target.value as AppControlAction | ''); setPage(0); }} className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs">
          <option value="">All actions</option>
          {(Object.keys(APP_CONTROL_ACTION_LABELS) as AppControlAction[]).map((a) => <option key={a} value={a}>{APP_CONTROL_ACTION_LABELS[a]}</option>)}
        </select>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : !data || data.content.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No app actions yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {data.content.map((b) => {
            const ok = b.statusCounts.SUCCESS || 0;
            const bad = (b.statusCounts.FAILED || 0) + (b.statusCounts.EXPIRED || 0);
            return (
              <button key={b.id} type="button" onClick={() => setOpenBatch(b)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-gray-50">
                <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${b.action === 'CLEAR_DATA' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{APP_CONTROL_ACTION_LABELS[b.action]}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                  {b.packageIds[0] === '*' ? 'All user apps' : b.packageIds.slice(0, 2).join(', ') + (b.packageIds.length > 2 ? ` +${b.packageIds.length - 2}` : '')}
                  <span className="text-muted-foreground"> · {b.targetDescription}</span>
                </span>
                <span className="text-[11px] text-green-700">{ok} done</span>
                {b.openCount > 0 && <span className="text-[11px] text-blue-700">{b.openCount} waiting</span>}
                {bad > 0 && <span className="text-[11px] text-red-700">{bad} failed</span>}
                <span className="text-[11px] text-muted-foreground">{new Date(b.createdAt).toLocaleString()} · {b.initiatedByEmail}</span>
              </button>
            );
          })}
        </div>
      )}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>Page {data.number + 1} of {data.totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={data.first} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40">Prev</button>
            <button type="button" disabled={data.last} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
      {openBatch && (
        <Shell title={`${APP_CONTROL_ACTION_LABELS[openBatch.action]} — batch #${openBatch.id}`} subtitle={openBatch.targetDescription || undefined} onClose={() => setOpenBatch(null)}>
          <AppControlResults batchId={openBatch.id} />
        </Shell>
      )}
    </div>
  );
}
