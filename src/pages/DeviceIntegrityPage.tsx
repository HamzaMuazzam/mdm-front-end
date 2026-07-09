import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Fingerprint,
  ScanLine,
} from 'lucide-react';
import { useDevicesQuery } from '@/hooks/useDevices';
import {
  useIntegrityEvents,
  useIntegrityStats,
  useRequestIntegrityScan,
} from '@/hooks/useDeviceIntegrity';
import {
  deviceIntegrityService,
  type IntegrityEvent,
  type IntegrityStatus,
} from '@/api/services/deviceIntegrity.service';
import { ROUTES } from '@/utils/constants';
import { usePermissionStore } from '@/store/permissionStore';

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const PAGE_SIZE = 50;

function fmtTs(ts: number | string | null | undefined): string {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const STATUS_META: Record<
  IntegrityStatus,
  { label: string; icon: React.ReactNode; badge: string; banner: string }
> = {
  CLEAN: {
    label: 'Clean',
    icon: <ShieldCheck className="h-5 w-5" />,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    banner: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  SUSPICIOUS: {
    label: 'Suspicious',
    icon: <Shield className="h-5 w-5" />,
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    banner: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  COMPROMISED: {
    label: 'Compromised',
    icon: <ShieldAlert className="h-5 w-5" />,
    badge: 'bg-red-50 text-red-700 border-red-200',
    banner: 'bg-red-50 border-red-300 text-red-800',
  },
};

function severityChip(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'LOW':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-4 border-t border-gray-100 mt-2">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-600 text-xs disabled:opacity-30 hover:text-gray-900 hover:bg-gray-50 transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Prev
      </button>
      <span className="text-xs text-gray-500 tabular-nums">
        Page {page + 1} of {totalPages}
      </span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages - 1}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-600 text-xs disabled:opacity-30 hover:text-gray-900 hover:bg-gray-50 transition-colors"
      >
        Next <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-lg font-semibold text-gray-900 truncate">{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

function EventRow({ event }: { event: IntegrityEvent }) {
  const meta = STATUS_META[event.status] ?? STATUS_META.CLEAN;
  const indicators = deviceIntegrityService.parseIndicators(event.indicators);
  return (
    <div
      className={`rounded-lg border p-3.5 ${
        event.securityAlert ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${meta.badge}`}
          >
            {meta.icon}
            {meta.label}
          </span>
          <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${severityChip(event.severity)}`}>
            {event.severity}
          </span>
          {event.scanTrigger && (
            <span className="text-[11px] text-gray-400">via {event.scanTrigger.toLowerCase()}</span>
          )}
        </div>
        <span className="shrink-0 text-[11px] text-gray-400 tabular-nums">
          {fmtTs(event.eventTimestamp)}
        </span>
      </div>

      {indicators.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {indicators.map((ind, i) => (
            <span
              key={i}
              title={ind.evidence ?? undefined}
              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${severityChip(ind.severity)}`}
            >
              {ind.type}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span>Attestation: {event.attestationStatus ?? 'UNAVAILABLE'}</span>
        {event.playIntegrityVerdict && <span>Verdict: {event.playIntegrityVerdict}</span>}
        {event.appVersion && <span>App {event.appVersion}</span>}
        {event.osVersion && <span>Android {event.osVersion}</span>}
      </div>
    </div>
  );
}

/* ─── page ────────────────────────────────────────────────────────────────── */

export function DeviceIntegrityPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canRead = hasPermission('device-integrity:read');
  const canScan = hasPermission('device-integrity:scan');

  const numericId = deviceId ? parseInt(deviceId, 10) : null;
  const { data: devices = [], isLoading: devicesLoading } = useDevicesQuery();
  const device = devices.find((d) => d.id === numericId);
  const deviceUuid = device?.deviceUuid ?? null;

  const [page, setPage] = useState(0);
  const [securityOnly, setSecurityOnly] = useState(false);

  const { data: stats } = useIntegrityStats(canRead ? deviceUuid : null);
  const {
    data: eventsPage,
    isLoading: eventsLoading,
    isError,
  } = useIntegrityEvents(canRead ? deviceUuid : null, page, PAGE_SIZE, securityOnly);
  const scanMutation = useRequestIntegrityScan(deviceUuid);

  const events = eventsPage?.content ?? [];
  const totalPages = eventsPage?.totalPages ?? 0;
  const currentStatus: IntegrityStatus = stats?.currentStatus ?? 'CLEAN';
  const banner = STATUS_META[currentStatus] ?? STATUS_META.CLEAN;

  if (devicesLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
            <Fingerprint className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate text-sm leading-tight">
              {device?.deviceName ?? 'Unknown Device'}
            </p>
            <p className="text-[10px] text-gray-500 truncate">Device Integrity — Root / Compromise</p>
          </div>
          {canScan && (
            <button
              type="button"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending || !deviceUuid}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {scanMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ScanLine className="h-3.5 w-3.5" />
              )}
              Run scan now
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5">
        {!canRead ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="h-14 w-14 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-gray-600">Access restricted</p>
            <p className="text-xs text-gray-500 max-w-xs">
              You do not have permission to view integrity logs for this device.
            </p>
          </div>
        ) : (
          <>
            {/* current status banner */}
            <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 mb-4 ${banner.banner}`}>
              {banner.icon}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Device is {banner.label.toLowerCase()}</p>
                <p className="text-[11px] opacity-80">
                  Severity {stats?.currentSeverity ?? 'NONE'} · attestation{' '}
                  {stats?.playIntegrityVerdict ?? 'unavailable'}
                </p>
              </div>
            </div>

            {/* stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <StatCard label="Total scans" value={String(stats?.totalScans ?? 0)} />
              <StatCard label="Compromised scans" value={String(stats?.compromisedScans ?? 0)} />
              <StatCard label="Last scan" value={stats?.lastScanAt ? fmtTs(stats.lastScanAt) : '—'} />
              <StatCard
                label="Last compromise"
                value={stats?.lastCompromisedAt ? fmtTs(stats.lastCompromisedAt) : '—'}
              />
            </div>

            {/* filter toggle */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500">
                {securityOnly ? 'Security-flagged scans' : 'All scans'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSecurityOnly((v) => !v);
                  setPage(0);
                }}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  securityOnly
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                {securityOnly ? 'Showing alerts only' : 'Security alerts only'}
              </button>
            </div>

            {/* list */}
            {eventsLoading && events.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
                <p className="text-sm text-gray-500">Loading integrity scans…</p>
              </div>
            )}

            {isError && (
              <div className="flex items-center gap-2.5 rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-sm text-red-700">Failed to load integrity logs.</p>
              </div>
            )}

            {!eventsLoading && !isError && events.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="h-14 w-14 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                  <RefreshCw className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {securityOnly ? 'No security alerts' : 'No integrity scans recorded yet'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs">
                    Root / compromise scan results reported by this device will appear here.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              {events.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
