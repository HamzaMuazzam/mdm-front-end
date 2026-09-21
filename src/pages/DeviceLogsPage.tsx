import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldAlert,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  FileArchive,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UploadCloud,
  ScrollText,
} from 'lucide-react';
import { useDevicesQuery } from '@/hooks/useDevices';
import {
  useCollectDeviceLogs,
  useDeleteDeviceLogBundle,
  useDeviceLogs,
} from '@/hooks/useDeviceLogs';
import {
  deviceLogsService,
  type DeviceLogRequest,
  type DeviceLogStatus,
} from '@/api/services/deviceLogs.service';
import { ROUTES } from '@/utils/constants';
import { usePermissionStore } from '@/store/permissionStore';

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const PAGE_SIZE = 20;

function fmtTs(ts: string | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function fmtBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

const STATUS_META: Record<
  DeviceLogStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  REQUESTED: {
    label: 'Requested',
    icon: <Clock className="h-3.5 w-3.5" />,
    className: 'bg-gray-50 text-gray-600 border-gray-200',
  },
  CAPTURING: {
    label: 'Capturing',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  UPLOADING: {
    label: 'Uploading',
    icon: <UploadCloud className="h-3.5 w-3.5" />,
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  COMPLETED: {
    label: 'Ready',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  FAILED: {
    label: 'Failed',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
};

/* ─── row ─────────────────────────────────────────────────────────────────── */

function LogRow({
  row,
  canDownload,
  canDelete,
  onDelete,
  deleting,
}: {
  row: DeviceLogRequest;
  canDownload: boolean;
  canDelete: boolean;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const meta = STATUS_META[row.status] ?? STATUS_META.REQUESTED;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await deviceLogsService.download(row.id, row.fileName ?? `device-logs-${row.id}.zip`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="px-4 py-3 flex items-start gap-3 border-b border-gray-100 last:border-0">
      <div className="h-9 w-9 shrink-0 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
        <FileArchive className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
          >
            {meta.icon}
            {meta.label}
          </span>
          <span className="text-xs text-gray-500">{fmtTs(row.createdAt)}</span>
        </div>

        <p className="mt-1 text-xs text-gray-600 truncate">
          {row.status === 'COMPLETED' ? (
            <>
              {row.fileName} · {fmtBytes(row.fileSize)} zipped
              {row.rawSize ? ` · ${fmtBytes(row.rawSize)} raw` : ''}
              {row.fileCount ? ` · ${row.fileCount} files` : ''}
            </>
          ) : row.status === 'FAILED' ? (
            <span className="text-red-600">{row.errorMessage ?? 'Capture failed'}</span>
          ) : (
            <>
              {row.capturePath ?? 'Waiting for the device…'}
              {row.fileCount ? ` · ${row.fileCount} files` : ''}
            </>
          )}
        </p>

        {row.requestedByEmail && (
          <p className="mt-0.5 text-[11px] text-gray-400 truncate">
            Requested by {row.requestedByEmail}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {row.status === 'COMPLETED' && canDownload && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            title="Download bundle"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(row.id)}
            disabled={deleting}
            title="Delete bundle"
            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── page ────────────────────────────────────────────────────────────────── */

export function DeviceLogsPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canRead = hasPermission('device-logs:read');
  const canCollect = hasPermission('device-logs:collect');
  const canDownload = hasPermission('device-logs:download');
  const canDelete = hasPermission('device-logs:delete');

  const numericId = deviceId ? parseInt(deviceId, 10) : null;
  const { data: devices = [], isLoading: devicesLoading } = useDevicesQuery();
  const device = devices.find((d) => d.id === numericId);
  const deviceUuid = device?.deviceUuid ?? null;

  const [page, setPage] = useState(0);

  const {
    data: logsPage,
    isLoading: logsLoading,
    isError,
  } = useDeviceLogs(canRead ? deviceUuid : null, page, PAGE_SIZE);

  const collectMutation = useCollectDeviceLogs(deviceUuid);
  const deleteMutation = useDeleteDeviceLogBundle(deviceUuid);

  const rows = logsPage?.content ?? [];
  const totalPages = logsPage?.totalPages ?? 0;
  const capturing = rows.some(
    (r) => r.status === 'REQUESTED' || r.status === 'CAPTURING' || r.status === 'UPLOADING'
  );

  if (devicesLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(ROUTES.DASHBOARD, { state: { activeTab: 'devices' } })}
            className="p-2 -ml-1 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-8 w-8 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
            <ScrollText className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate text-sm leading-tight">
              {device?.deviceName ?? 'Unknown Device'}
            </p>
            <p className="text-[10px] text-gray-500 truncate">System Logs</p>
          </div>
          {canRead && canCollect && (
            <button
              type="button"
              onClick={() => collectMutation.mutate()}
              disabled={collectMutation.isPending || capturing || !deviceUuid}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {collectMutation.isPending || capturing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ScrollText className="h-3.5 w-3.5" />
              )}
              {capturing ? 'Collecting…' : 'Collect logs'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
        {!canRead ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="h-14 w-14 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-gray-600">Access restricted</p>
            <p className="text-xs text-gray-500 max-w-xs">
              You do not have permission to view system logs for this device.
            </p>
          </div>
        ) : (
          <>
            {collectMutation.isError && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                Could not send the collect command. The device may be offline.
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Collected bundles</p>
                <p className="text-[11px] text-gray-500">
                  {logsPage?.totalElements ?? 0} total · newest 5 kept per device
                </p>
              </div>

              {logsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <AlertTriangle className="h-6 w-6 text-red-400" />
                  <p className="text-xs text-gray-500">Could not load log collections.</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                  <FileArchive className="h-6 w-6 text-gray-300" />
                  <p className="text-sm font-medium text-gray-600">No logs collected yet</p>
                  <p className="text-xs text-gray-500 max-w-xs">
                    {canCollect
                      ? 'Use “Collect logs” to pull the OS system logs from this device.'
                      : 'You do not have permission to trigger a collection.'}
                  </p>
                </div>
              ) : (
                rows.map((row) => (
                  <LogRow
                    key={row.id}
                    row={row}
                    canDownload={canDownload}
                    canDelete={canDelete}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    deleting={deleteMutation.isPending}
                  />
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </button>
                <span className="text-xs text-gray-500">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
