import { ShieldCheck } from 'lucide-react';
import { AuditLogTable } from './AuditLogTable';

export function AuditLogsPage() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Audit Logs</h2>
          <p className="text-xs text-gray-500">Who did what, to which device or account, when, from where — and whether it succeeded. Append-only and hash-chained.</p>
        </div>
      </div>
      <AuditLogTable />
    </div>
  );
}
