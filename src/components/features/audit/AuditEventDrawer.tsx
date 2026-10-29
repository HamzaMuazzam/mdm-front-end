import { useState } from 'react';
import { X, Copy, Check, Loader2, Link2 } from 'lucide-react';
import { useAuditEvent } from '@/hooks/useAuditLogs';
import type { AuditEvent } from '@/types/audit.types';
import { CATEGORY_LABEL, OUTCOME_CLASS, SEVERITY_CLASS, fmtTime, fmtTimeFull, humanAction } from './auditMeta';

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  if (v === null || v === undefined || v === '') return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 py-1 text-xs border-b border-gray-50 last:border-0">
      <span className="text-gray-500">{k}</span>
      <span className={`text-gray-900 break-all ${mono ? 'font-mono text-[11px]' : ''}`}>{v}</span>
    </div>
  );
}

function Changes({ changes }: { changes: Record<string, { from: unknown; to: unknown }> }) {
  const keys = Object.keys(changes);
  if (keys.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Changes</p>
      <div className="rounded-md border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr] bg-gray-50 text-[11px] font-medium text-gray-500 px-2 py-1">
          <span>Field</span><span>Before</span><span>After</span>
        </div>
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-[1fr_1fr_1fr] px-2 py-1 text-xs border-t border-gray-100">
            <span className="font-mono text-[11px] text-gray-700 break-all">{k}</span>
            <span className="text-red-700 break-all">{String(changes[k].from ?? '—')}</span>
            <span className="text-emerald-700 break-all">{String(changes[k].to ?? '—')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuditEventDrawer({ eventId, onClose }: { eventId: number | null; onClose: () => void }) {
  const { data, isLoading } = useAuditEvent(eventId);
  const [copied, setCopied] = useState(false);
  if (eventId === null) return null;
  const e: AuditEvent | undefined = data?.event;
  const timeline = data?.timeline ?? [];
  const details = (e?.details ?? {}) as Record<string, unknown>;
  const changes = details.changes as Record<string, { from: unknown; to: unknown }> | undefined;

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(e, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative h-full w-full sm:max-w-xl bg-white shadow-xl flex flex-col">
        <div className="h-14 px-4 flex items-center gap-3 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{e ? humanAction(e.action) : 'Audit event'}</p>
            <p className="text-[11px] text-gray-500 truncate">{e ? fmtTimeFull(e.eventTime) : ''}</p>
          </div>
          <button type="button" onClick={copyJson} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} JSON
          </button>
          <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-gray-100 text-gray-500"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading || !e ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${OUTCOME_CLASS[e.outcome]}`}>{e.outcome}</span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${SEVERITY_CLASS[e.severity]}`}>{e.severity}</span>
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">{CATEGORY_LABEL[e.category] ?? e.category}</span>
              </div>
              <Row k="Action" v={<span className="font-mono text-[11px]">{e.action}</span>} />
              <Row k="Actor" v={<>{e.actorLabel ?? '—'} <span className="text-gray-400">({e.actorType}{e.actorSecurityGroup ? ` · ${e.actorSecurityGroup}` : ''})</span></>} />
              <Row k="Target" v={e.targetType ? `${e.targetType} · ${e.targetLabel ?? ''} ${e.targetId ? `#${e.targetId}` : ''}` : null} />
              <Row k="Device" v={e.deviceUuid ? `${e.targetType === 'DEVICE' && e.targetLabel ? e.targetLabel + ' · ' : ''}${e.deviceUuid}` : null} mono />
              <Row k="Request" v={e.httpMethod || e.pathTemplate ? `${e.httpMethod ?? ''} ${e.pathTemplate ?? ''} ${e.httpStatus ? `→ ${e.httpStatus}` : ''} ${e.durationMs != null ? `(${e.durationMs} ms)` : ''}` : null} mono />
              <Row k="Permission" v={e.permissionRequired} mono />
              <Row k="Client IP" v={e.clientIp} mono />
              <Row k="User agent" v={e.userAgent} />
              <Row k="Request id" v={e.requestId} mono />
              <Row k="Correlation" v={e.correlationId} mono />
              <Row k="Row hash" v={e.rowHash} mono />
              <Row k="Prev hash" v={e.prevHash} mono />

              {changes && <Changes changes={changes} />}

              {timeline.length > 1 && (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 inline-flex items-center gap-1"><Link2 className="h-3 w-3" /> Command timeline</p>
                  <ol className="relative border-l border-gray-200 ml-2">
                    {timeline.map((t) => (
                      <li key={t.id} className="ml-3 pb-2">
                        <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border border-white ${t.outcome === 'PENDING' ? 'bg-amber-400' : t.outcome === 'FAILURE' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        <p className="text-xs text-gray-900">{humanAction(t.action)} <span className={`ml-1 inline-flex rounded-full border px-1.5 text-[10px] ${OUTCOME_CLASS[t.outcome]}`}>{t.outcome}</span></p>
                        <p className="text-[11px] text-gray-500">{fmtTime(t.eventTime)} · {t.actorLabel ?? t.actorType}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="mt-4">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Details</p>
                <pre className="rounded-md bg-gray-900 text-gray-100 text-[11px] p-3 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(details, null, 2)}</pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
