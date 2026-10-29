import { X, Download, Loader2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useAuditExportJobs } from '@/hooks/useAuditLogs';
import { auditService } from '@/api/services/audit.service';
import type { AuditExportJob } from '@/types/audit.types';
import { fmtTime } from './auditMeta';

function fmtBytes(b: number | null): string {
  if (b === null) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const STATUS: Record<AuditExportJob['status'], { icon: React.ReactNode; cls: string }> = {
  QUEUED: { icon: <Clock className="h-3.5 w-3.5" />, cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  RUNNING: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  READY: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  FAILED: { icon: <AlertTriangle className="h-3.5 w-3.5" />, cls: 'bg-red-50 text-red-700 border-red-200' },
  EXPIRED: { icon: <Clock className="h-3.5 w-3.5" />, cls: 'bg-gray-50 text-gray-400 border-gray-200' },
};

export function AuditExportJobsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: jobs = [], isLoading } = useAuditExportJobs(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative h-full w-full sm:max-w-md bg-white shadow-xl flex flex-col">
        <div className="h-14 px-4 flex items-center gap-3 border-b border-gray-200">
          <p className="flex-1 text-sm font-semibold text-gray-900">Export jobs</p>
          <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-gray-100 text-gray-500"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : jobs.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500">No export jobs yet. Exports larger than the streaming limit appear here.</p>
          ) : jobs.map((j) => {
            const st = STATUS[j.status];
            return (
              <div key={j.id} className="px-4 py-3 border-b border-gray-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.icon}{j.status}</span>
                  <span className="text-gray-900 font-medium">#{j.id} · {j.format.toUpperCase()}</span>
                  <span className="text-gray-500 ml-auto">{fmtTime(j.createdAt)}</span>
                </div>
                <p className="mt-1 text-gray-600">{j.rowCount?.toLocaleString() ?? '?'} rows · {fmtBytes(j.fileSize)} · by {j.requestedBy ?? '—'}{j.expiresAt ? ` · expires ${fmtTime(j.expiresAt)}` : ''}</p>
                {j.error && <p className="mt-1 text-red-700">{j.error}</p>}
                {j.sha256 && <p className="mt-1 font-mono text-[10px] text-gray-400 break-all">sha256 {j.sha256}</p>}
                {j.status === 'READY' && (
                  <button type="button" onClick={() => auditService.downloadJob(j)} className="mt-2 inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700">
                    <Download className="h-3.5 w-3.5" /> Download .gz
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
