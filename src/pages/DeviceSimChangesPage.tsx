import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Smartphone,
  ShieldAlert,
  Loader2,
  ChevronLeft,
  ChevronRight,
  SignalHigh,
  Trash2,
  PlusCircle,
  RefreshCcw,
  AlertTriangle,
} from 'lucide-react';
import { useDevicesQuery } from '@/hooks/useDevices';
import { useSimChangeEvents, useSimChangeStats } from '@/hooks/useSimChanges';
import type { SimChangeEvent, SimEventType } from '@/api/services/simChange.service';
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

function slotLabel(slotIndex: number | null): string {
  if (slotIndex === null || slotIndex < 0) return 'SIM';
  return `SIM ${slotIndex + 1}`;
}

function maskId(value: string | null): string {
  if (!value) return '—';
  if (value.length <= 4) return value;
  return `••••${value.slice(-4)}`;
}

const EVENT_META: Record<
  SimEventType,
  { label: string; icon: React.ReactNode; className: string }
> = {
  INSERTED: {
    label: 'Inserted',
    icon: <PlusCircle className="h-4 w-4" />,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  REMOVED: {
    label: 'Removed',
    icon: <Trash2 className="h-4 w-4" />,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  SWAPPED: {
    label: 'Swapped',
    icon: <RefreshCcw className="h-4 w-4" />,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  ABSENT: {
    label: 'Absent',
    icon: <SignalHigh className="h-4 w-4" />,
    className: 'bg-gray-50 text-gray-600 border-gray-200',
  },
  UNKNOWN: {
    label: 'Unknown',
    icon: <SignalHigh className="h-4 w-4" />,
    className: 'bg-gray-50 text-gray-600 border-gray-200',
  },
};

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

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
        accent ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div
        className={`h-9 w-9 rounded-md flex items-center justify-center ${
          accent ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-lg font-semibold ${accent ? 'text-red-700' : 'text-gray-900'}`}>
          {value}
        </p>
        <p className="text-[11px] text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: SimChangeEvent }) {
  const meta = EVENT_META[event.eventType] ?? EVENT_META.UNKNOWN;
  return (
    <div
      className={`rounded-lg border p-3.5 ${
        event.securityAlert ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${meta.className}`}
          >
            {meta.icon}
            {meta.label}
          </span>
          <span className="text-xs font-medium text-gray-500">{slotLabel(event.slotIndex)}</span>
          {event.securityAlert && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              <ShieldAlert className="h-3 w-3" /> Security Alert
            </span>
          )}
        </div>
        <span className="shrink-0 text-[11px] text-gray-400 tabular-nums">
          {fmtTs(event.eventTimestamp)}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        <Field label="Carrier" value={event.carrierName ?? event.displayName ?? '—'} />
        <Field label="Number" value={event.phoneNumber ?? '—'} />
        <Field label="SIM state" value={event.simState ?? '—'} />
        <Field label="ICCID" value={maskId(event.iccid)} mono />
        <Field label="IMSI" value={maskId(event.imsi)} mono />
        <Field label="Country" value={event.countryIso?.toUpperCase() ?? '—'} />
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`truncate text-xs text-gray-700 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

/* ─── page ────────────────────────────────────────────────────────────────── */

export function DeviceSimChangesPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const canRead = hasPermission('sim-changes:read');

  const numericId = deviceId ? parseInt(deviceId, 10) : null;
  const { data: devices = [], isLoading: devicesLoading } = useDevicesQuery();
  const device = devices.find((d) => d.id === numericId);
  const deviceUuid = device?.deviceUuid ?? null;

  const [page, setPage] = useState(0);
  const [securityOnly, setSecurityOnly] = useState(false);

  const { data: stats } = useSimChangeStats(canRead ? deviceUuid : null);
  const {
    data: eventsPage,
    isLoading: eventsLoading,
    isError,
  } = useSimChangeEvents(canRead ? deviceUuid : null, page, PAGE_SIZE, securityOnly);

  const events = eventsPage?.content ?? [];
  const totalPages = eventsPage?.totalPages ?? 0;

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
            <Smartphone className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate text-sm leading-tight">
              {device?.deviceName ?? 'Unknown Device'}
            </p>
            <p className="text-[10px] text-gray-500 truncate">SIM Change Logs</p>
          </div>
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
              You do not have permission to view SIM change logs for this device.
            </p>
          </div>
        ) : (
          <>
            {/* stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <StatCard
                label="Total changes"
                value={String(stats?.totalEvents ?? 0)}
                icon={<Smartphone className="h-4 w-4" />}
              />
              <StatCard
                label="Security alerts"
                value={String(stats?.securityAlerts ?? 0)}
                accent={(stats?.securityAlerts ?? 0) > 0}
                icon={<ShieldAlert className="h-4 w-4" />}
              />
              <StatCard
                label="Last change"
                value={stats?.lastChangeAt ? fmtTs(stats.lastChangeAt) : '—'}
                icon={<SignalHigh className="h-4 w-4" />}
              />
            </div>

            {/* filter toggle */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500">
                {securityOnly ? 'Security-flagged changes' : 'All SIM changes'}
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
                <p className="text-sm text-gray-500">Loading SIM changes…</p>
              </div>
            )}

            {isError && (
              <div className="flex items-center gap-2.5 rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-sm text-red-700">Failed to load SIM change logs.</p>
              </div>
            )}

            {!eventsLoading && !isError && events.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="h-14 w-14 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {securityOnly ? 'No security alerts' : 'No SIM changes recorded'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs">
                    SIM insert, remove and swap events reported by this device will appear here.
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
