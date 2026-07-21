import { useState, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  AppWindow,
  BatteryMedium,
  Download,
  FileSpreadsheet,
  Gauge,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserRound,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useApplicationReportQuery,
  useDeviceReportQuery,
  useDownloadReportCsv,
  useReportOverviewQuery,
  useSecurityReportQuery,
  useUsageReportQuery,
  useUserReportQuery,
} from '@/hooks/useReports';
import type {
  ReportExportType,
  ReportNameCount,
  ReportTrendPoint,
} from '@/types/report.types';

const nf = new Intl.NumberFormat('en-US');
const pf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

type ReportTab = 'overview' | 'devices' | 'security' | 'applications' | 'users' | 'usage';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'devices', label: 'Devices & Compliance' },
  { id: 'security', label: 'Security' },
  { id: 'applications', label: 'Applications' },
  { id: 'users', label: 'Users' },
  { id: 'usage', label: 'Usage & Health' },
];

// ── Formatting helpers ───────────────────────────────────────────────────────

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const normalized = value.replace(/(\.\d{3})\d+/, '$1');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${pf.format(bytes / 1024 ** i)} ${units[i]}`;
}

function formatHours(hours: number): string {
  if (hours >= 1) return `${pf.format(hours)} h`;
  return `${nf.format(Math.round(hours * 60))} min`;
}

// ── Building blocks ──────────────────────────────────────────────────────────

function CardTitleRow({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {right}
    </div>
  );
}

interface KpiTileProps {
  title: string;
  value: string;
  sub: string;
  icon: ReactNode;
  accent: string;
}

function KpiTile({ title, value, sub, icon, accent }: KpiTileProps) {
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <p className="truncate text-[11px] font-medium text-gray-500">{title}</p>
          <div className={`rounded p-1 ${accent}`}>{icon}</div>
        </div>
        <p className="mt-1 text-xl font-semibold leading-none tracking-tight text-gray-900">{value}</p>
        <p className="mt-1 truncate text-[11px] text-gray-400">{sub}</p>
      </CardContent>
    </Card>
  );
}

interface Segment {
  label: string;
  value: number;
  color: string;
}

function Donut({ segments, size = 84, thickness = 11, center }: { segments: Segment[]; size?: number; thickness?: number; center: ReactNode }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  let acc = 0;
  const stops = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = (acc / total) * 100;
      acc += s.value;
      const end = (acc / total) * 100;
      return `${s.color} ${start}% ${end}%`;
    })
    .join(', ');
  const background = total > 0 ? `conic-gradient(${stops})` : '#e5e7eb';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size, borderRadius: '9999px', background }}>
      <div className="absolute flex items-center justify-center rounded-full bg-white text-center" style={{ inset: thickness }}>
        {center}
      </div>
    </div>
  );
}

function Legend({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className="w-full flex-1">
      {segments.map((s) => (
        <div key={s.label} className="flex items-center justify-between py-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="truncate text-[12px] text-gray-600">{s.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-gray-900">{nf.format(s.value)}</span>
            <span className="w-9 text-right text-[10px] tabular-nums text-gray-400">
              {total > 0 ? pf.format((s.value / total) * 100) : 0}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DistributionCard({ title, segments, centerValue, centerLabel }: { title: string; segments: Segment[]; centerValue: string; centerLabel: string }) {
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <CardTitleRow title={title} />
        <div className="flex items-center gap-4">
          <Donut
            segments={segments}
            center={
              <div>
                <p className="text-base font-semibold leading-none text-gray-900">{centerValue}</p>
                <p className="mt-0.5 text-[9px] uppercase tracking-wide text-gray-400">{centerLabel}</p>
              </div>
            }
          />
          <Legend segments={segments} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Horizontal bar list — used for OS / model / top-app distributions. */
function BarListCard({ title, items, barColor, valueFormatter }: { title: string; items: { label: string; value: number }[]; barColor: string; valueFormatter?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const fmt = valueFormatter ?? ((v: number) => nf.format(v));
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <CardTitleRow title={title} />
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500">No data.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((it) => (
              <div key={it.label}>
                <div className="flex items-center justify-between">
                  <span className="truncate pr-2 text-[12px] text-gray-600">{it.label}</span>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-gray-900">{fmt(it.value)}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, backgroundColor: barColor }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendChart({ title, points, strokeColor }: { title: string; points: ReportTrendPoint[]; strokeColor: string }) {
  const total = points.reduce((s, p) => s + p.value, 0);

  if (points.length === 0) {
    return (
      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <CardTitleRow title={title} />
          <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500">No trend data.</p>
        </CardContent>
      </Card>
    );
  }

  const width = 520;
  const height = 130;
  const px = 30;
  const py = 14;
  const xSpan = width - px * 2;
  const ySpan = height - py * 2;
  const maxValue = Math.max(1, ...points.map((p) => p.value));
  const denom = points.length > 1 ? points.length - 1 : 1;
  const coords = points.map((p, i) => ({ x: px + (i / denom) * xSpan, y: height - py - (p.value / maxValue) * ySpan }));
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - py} L ${coords[0].x} ${height - py} Z`;
  const gid = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-rg`;
  const labelEvery = Math.max(1, Math.ceil(points.length / 10));

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <CardTitleRow title={title} right={<span className="text-sm font-semibold text-gray-900">{nf.format(total)}</span>} />
        <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.32} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {[0, 1, 2].map((i) => {
            const y = py + (ySpan / 2) * i;
            const tick = Math.round(maxValue - (maxValue / 2) * i);
            return (
              <g key={i}>
                <line x1={px} y1={y} x2={width - px} y2={y} stroke="#eef2f6" strokeWidth="1" />
                <text x={px - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                  {nf.format(tick)}
                </text>
              </g>
            );
          })}
          <path d={areaPath} fill={`url(#${gid})`} />
          <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="mt-0.5 flex justify-between text-[9px] text-gray-400">
          {points
            .filter((_, i) => i % labelEvery === 0 || i === points.length - 1)
            .map((p) => (
              <span key={`${title}-${p.date}`}>{formatDateLabel(p.date)}</span>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'green' | 'amber' | 'red' | 'gray' | 'blue' }) {
  const cls = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
  }[tone];
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
}

function complianceTone(status: string): 'green' | 'amber' | 'red' {
  if (status === 'COMPLIANT') return 'green';
  if (status === 'AT_RISK') return 'amber';
  return 'red';
}

function integrityTone(status: string | null): 'green' | 'amber' | 'red' | 'gray' {
  if (status === 'CLEAN') return 'green';
  if (status === 'SUSPICIOUS') return 'amber';
  if (status === 'COMPROMISED') return 'red';
  return 'gray';
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardContent className="flex flex-col items-start gap-3 p-5">
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>
        <Button onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

/** Toolbar with server CSV + client Excel export. */
function ExportBar({
  csvType,
  onExcel,
  generatedAt,
  onRefresh,
  isFetching,
}: {
  csvType: ReportExportType | null;
  onExcel: (() => void) | null;
  generatedAt?: string;
  onRefresh: () => void;
  isFetching: boolean;
}) {
  const downloadCsv = useDownloadReportCsv();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {generatedAt && (
        <span className="mr-auto hidden items-center gap-1.5 text-xs text-gray-400 sm:flex">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Generated {formatDateTime(generatedAt)}
        </span>
      )}
      <Button size="sm" variant="outline" className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50" onClick={onRefresh} disabled={isFetching}>
        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        {isFetching ? 'Refreshing…' : 'Refresh'}
      </Button>
      {onExcel && (
        <Button size="sm" variant="outline" className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50" onClick={onExcel}>
          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
          Excel
        </Button>
      )}
      {csvType && (
        <Button size="sm" variant="outline" className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50" onClick={() => downloadCsv.mutate(csvType)} disabled={downloadCsv.isPending}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {downloadCsv.isPending ? 'Exporting…' : 'CSV'}
        </Button>
      )}
    </div>
  );
}

function exportToExcel(sheetName: string, fileName: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  XLSX.writeFile(wb, `${fileName}_${stamp}.xlsx`);
}

// ── Tab panels ───────────────────────────────────────────────────────────────

function OverviewPanel() {
  const { data, isLoading, isError, refetch, isFetching, error } = useReportOverviewQuery();

  if (isLoading) return <ReportSkeleton />;
  if (isError || !data) {
    return <ReportError message={error instanceof Error ? error.message : 'Unable to load overview report.'} onRetry={() => refetch()} />;
  }

  const toBarItems = (items: ReportNameCount[]) => items.map((i) => ({ label: i.name, value: i.count }));

  return (
    <div className="space-y-4">
      <ExportBar csvType={null} onExcel={null} generatedAt={data.generatedAt} onRefresh={() => refetch()} isFetching={isFetching} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiTile title="Total Devices" value={nf.format(data.totalDevices)} sub={`${nf.format(data.enrolledLast30Days)} enrolled in 30d`} icon={<Smartphone className="h-4 w-4" />} accent="bg-blue-50 text-blue-600" />
        <KpiTile title="Online Now" value={nf.format(data.onlineDevices)} sub={`${pf.format(data.onlinePercent)}% of fleet`} icon={<Wifi className="h-4 w-4" />} accent="bg-emerald-50 text-emerald-600" />
        <KpiTile title="Compliance Score" value={`${pf.format(data.avgComplianceScore)}`} sub={`${nf.format(data.compliantDevices)} compliant devices`} icon={<Gauge className="h-4 w-4" />} accent="bg-violet-50 text-violet-600" />
        <KpiTile title="Compromised" value={nf.format(data.compromisedDevices)} sub={`${nf.format(data.suspiciousDevices)} suspicious`} icon={<ShieldAlert className="h-4 w-4" />} accent="bg-red-50 text-red-600" />
        <KpiTile title="Security Alerts" value={nf.format(data.integrityAlerts + data.simAlerts)} sub={`${nf.format(data.simAlerts)} SIM · ${nf.format(data.integrityAlerts)} integrity`} icon={<AlertTriangle className="h-4 w-4" />} accent="bg-amber-50 text-amber-600" />
        <KpiTile title="Users" value={nf.format(data.totalUsers)} sub={`${nf.format(data.activeUsers)} active`} icon={<UserRound className="h-4 w-4" />} accent="bg-sky-50 text-sky-600" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <TrendChart title="Enrollment · 30d" points={data.enrollmentTrendLast30Days} strokeColor="#2563eb" />
        <DistributionCard
          title="Compliance Posture"
          centerValue={pf.format(data.avgComplianceScore)}
          centerLabel="Avg Score"
          segments={[
            { label: 'Compliant', value: data.compliantDevices, color: '#16a34a' },
            { label: 'At Risk', value: data.atRiskDevices, color: '#d97706' },
            { label: 'Non-Compliant', value: data.nonCompliantDevices, color: '#dc2626' },
          ]}
        />
        <DistributionCard
          title="Security Posture"
          centerValue={nf.format(data.totalDevices)}
          centerLabel="Devices"
          segments={[
            { label: 'Clean', value: data.cleanDevices, color: '#16a34a' },
            { label: 'Suspicious', value: data.suspiciousDevices, color: '#d97706' },
            { label: 'Compromised', value: data.compromisedDevices, color: '#dc2626' },
            { label: 'Not Scanned', value: data.notScannedDevices, color: '#94a3b8' },
          ]}
        />
        <BarListCard title="OS Versions" items={toBarItems(data.osDistribution)} barColor="#2563eb" />
        <BarListCard title="Device Models" items={toBarItems(data.modelDistribution)} barColor="#0ea5e9" />
        <BarListCard title="MDM Agent Versions" items={toBarItems(data.appVersionDistribution)} barColor="#7c3aed" />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <DistributionCard
          title="Agent Update Status"
          centerValue={nf.format(data.upToDateDevices)}
          centerLabel="Up to date"
          segments={[
            { label: 'Up to date', value: data.upToDateDevices, color: '#16a34a' },
            { label: 'Outdated', value: data.outdatedDevices, color: '#d97706' },
          ]}
        />
        <Card className="border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <CardTitleRow title="Policy Adoption" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Kiosk Mode', value: data.kioskModeDevices },
                { label: 'Root Detection', value: data.rootDetectionDevices },
                { label: 'Factory Reset Lock', value: data.factoryResetLockedDevices },
                { label: 'VPN', value: data.vpnEnabledDevices },
              ].map((it) => (
                <div key={it.label} className="rounded border border-gray-200 bg-gray-50 p-2 text-center">
                  <p className="text-lg font-semibold leading-none text-gray-900">{nf.format(it.value)}</p>
                  <p className="mt-1 truncate text-[10px] uppercase tracking-wide text-gray-400">{it.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DevicesPanel() {
  const { data, isLoading, isError, refetch, isFetching, error } = useDeviceReportQuery();

  if (isLoading) return <ReportSkeleton />;
  if (isError || !data) {
    return <ReportError message={error instanceof Error ? error.message : 'Unable to load device compliance report.'} onRetry={() => refetch()} />;
  }

  const excel = () =>
    exportToExcel(
      'Device Compliance',
      'mdm-device-compliance',
      data.rows.map((r) => ({
        'Device Name': r.deviceName ?? '',
        'Device UUID': r.deviceUuid,
        Model: r.model ?? '',
        'OS Version': r.osVersion ?? '',
        'Agent Version': r.appVersionName ?? '',
        Owner: r.ownerName ?? '',
        'Owner Email': r.ownerEmail ?? '',
        Online: r.online ? 'Yes' : 'No',
        'Battery %': r.batteryCharge ?? '',
        'Last Sync': r.lastStateSyncTime ?? '',
        'Integrity Status': r.integrityStatus ?? '',
        'SIM Alerts': r.simAlerts,
        'Compliance Score': r.complianceScore,
        'Compliance Status': r.complianceStatus,
        Issues: r.issues.join('; '),
      })),
    );

  return (
    <div className="space-y-4">
      <ExportBar csvType="devices" onExcel={excel} generatedAt={data.generatedAt} onRefresh={() => refetch()} isFetching={isFetching} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile title="Devices" value={nf.format(data.totalDevices)} sub="in scope" icon={<Smartphone className="h-4 w-4" />} accent="bg-blue-50 text-blue-600" />
        <KpiTile title="Compliant" value={nf.format(data.compliantDevices)} sub="score ≥ 85" icon={<ShieldCheck className="h-4 w-4" />} accent="bg-emerald-50 text-emerald-600" />
        <KpiTile title="At Risk" value={nf.format(data.atRiskDevices)} sub="score 60 – 84" icon={<AlertTriangle className="h-4 w-4" />} accent="bg-amber-50 text-amber-600" />
        <KpiTile title="Non-Compliant" value={nf.format(data.nonCompliantDevices)} sub="score < 60" icon={<ShieldAlert className="h-4 w-4" />} accent="bg-red-50 text-red-600" />
      </div>

      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {['Device', 'Owner', 'Model / OS', 'Online', 'Integrity', 'SIM Alerts', 'Score', 'Status', 'Issues'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((r) => (
                  <tr key={r.deviceUuid} className="hover:bg-gray-50">
                    <td className="max-w-[180px] px-3 py-2">
                      <p className="truncate text-xs font-medium text-gray-900">{r.deviceName ?? '—'}</p>
                      <p className="truncate text-[10px] text-gray-400">{r.deviceUuid}</p>
                    </td>
                    <td className="max-w-[160px] px-3 py-2">
                      <p className="truncate text-xs text-gray-700">{r.ownerName ?? '—'}</p>
                      <p className="truncate text-[10px] text-gray-400">{r.ownerEmail ?? ''}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">
                      {r.model ?? '—'} · {r.osVersion ? `Android ${r.osVersion}` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge label={r.online ? 'Online' : 'Offline'} tone={r.online ? 'green' : 'gray'} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge label={r.integrityStatus ?? 'NOT_SCANNED'} tone={integrityTone(r.integrityStatus)} />
                    </td>
                    <td className="px-3 py-2 text-center text-xs font-semibold text-gray-900">{r.simAlerts > 0 ? <span className="text-red-600">{nf.format(r.simAlerts)}</span> : '0'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${r.complianceScore >= 85 ? 'bg-emerald-500' : r.complianceScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${r.complianceScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-gray-900">{r.complianceScore}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge label={r.complianceStatus.replace('_', ' ')} tone={complianceTone(r.complianceStatus)} />
                    </td>
                    <td className="max-w-[260px] px-3 py-2">
                      <p className="truncate text-[11px] text-gray-500" title={r.issues.join('; ')}>
                        {r.issues.length === 0 ? '—' : r.issues.join('; ')}
                      </p>
                    </td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">
                      No devices in scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 p-3 lg:hidden">
            {data.rows.map((r) => (
              <div key={r.deviceUuid} className="rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{r.deviceName ?? '—'}</p>
                    <p className="truncate text-xs text-gray-500">{r.deviceUuid}</p>
                  </div>
                  <StatusBadge label={r.complianceStatus.replace('_', ' ')} tone={complianceTone(r.complianceStatus)} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Owner</p>
                    <p className="truncate text-sm text-gray-900">{r.ownerName ?? '—'}</p>
                    {r.ownerEmail && <p className="truncate text-xs text-gray-500">{r.ownerEmail}</p>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Model / OS</p>
                    <p className="truncate text-sm text-gray-900">
                      {r.model ?? '—'} · {r.osVersion ? `Android ${r.osVersion}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Online</p>
                    <div className="mt-0.5">
                      <StatusBadge label={r.online ? 'Online' : 'Offline'} tone={r.online ? 'green' : 'gray'} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Integrity</p>
                    <div className="mt-0.5">
                      <StatusBadge label={r.integrityStatus ?? 'NOT_SCANNED'} tone={integrityTone(r.integrityStatus)} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">SIM Alerts</p>
                    <p className="text-sm font-semibold text-gray-900">{r.simAlerts > 0 ? <span className="text-red-600">{nf.format(r.simAlerts)}</span> : '0'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Score</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${r.complianceScore >= 85 ? 'bg-emerald-500' : r.complianceScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${r.complianceScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-gray-900">{r.complianceScore}</span>
                    </div>
                  </div>
                </div>
                {r.issues.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">Issues</p>
                    <p className="text-sm text-gray-900">{r.issues.join('; ')}</p>
                  </div>
                )}
              </div>
            ))}
            {data.rows.length === 0 && <p className="px-3 py-8 text-center text-sm text-gray-500">No devices in scope.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SecurityPanel() {
  const { data, isLoading, isError, refetch, isFetching, error } = useSecurityReportQuery();

  if (isLoading) return <ReportSkeleton />;
  if (isError || !data) {
    return <ReportError message={error instanceof Error ? error.message : 'Unable to load security report.'} onRetry={() => refetch()} />;
  }

  const excel = () =>
    exportToExcel(
      'Security Events',
      'mdm-security-report',
      [
        ...data.recentIntegrityEvents.map((e) => ({
          Type: 'INTEGRITY',
          Device: e.deviceName ?? '',
          UUID: e.deviceUuid ?? '',
          'Status / Event': e.status ?? '',
          'Severity / Carrier': e.severity ?? '',
          Detail: e.playIntegrityVerdict ?? '',
          Alert: e.securityAlert ? 'Yes' : 'No',
          Time: e.eventTime ?? '',
        })),
        ...data.recentSimEvents.map((e) => ({
          Type: 'SIM',
          Device: e.deviceName ?? '',
          UUID: e.deviceUuid ?? '',
          'Status / Event': e.eventType ?? '',
          'Severity / Carrier': e.carrierName ?? '',
          Detail: e.phoneNumber ?? '',
          Alert: e.securityAlert ? 'Yes' : 'No',
          Time: e.eventTime ?? '',
        })),
      ],
    );

  return (
    <div className="space-y-4">
      <ExportBar csvType="security" onExcel={excel} generatedAt={data.generatedAt} onRefresh={() => refetch()} isFetching={isFetching} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiTile title="Scanned" value={nf.format(data.devicesScanned)} sub={`${nf.format(data.notScannedDevices)} never scanned`} icon={<ShieldCheck className="h-4 w-4" />} accent="bg-blue-50 text-blue-600" />
        <KpiTile title="Clean" value={nf.format(data.cleanDevices)} sub="no root indicators" icon={<ShieldCheck className="h-4 w-4" />} accent="bg-emerald-50 text-emerald-600" />
        <KpiTile title="Compromised" value={nf.format(data.compromisedDevices)} sub={`${nf.format(data.suspiciousDevices)} suspicious`} icon={<ShieldAlert className="h-4 w-4" />} accent="bg-red-50 text-red-600" />
        <KpiTile title="Integrity Alerts" value={nf.format(data.integrityAlerts)} sub={`${nf.format(data.totalIntegrityEvents)} events total`} icon={<AlertTriangle className="h-4 w-4" />} accent="bg-amber-50 text-amber-600" />
        <KpiTile title="SIM Alerts" value={nf.format(data.simAlerts)} sub={`${nf.format(data.totalSimEvents)} SIM events`} icon={<AlertTriangle className="h-4 w-4" />} accent="bg-orange-50 text-orange-600" />
        <KpiTile title="Remote Views" value={nf.format(data.screenSessionsTotal)} sub={`${nf.format(data.screenSessionsActive)} active now`} icon={<Smartphone className="h-4 w-4" />} accent="bg-sky-50 text-sky-600" />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <DistributionCard
          title="Integrity Posture"
          centerValue={nf.format(data.devicesScanned)}
          centerLabel="Scanned"
          segments={[
            { label: 'Clean', value: data.cleanDevices, color: '#16a34a' },
            { label: 'Suspicious', value: data.suspiciousDevices, color: '#d97706' },
            { label: 'Compromised', value: data.compromisedDevices, color: '#dc2626' },
            { label: 'Not Scanned', value: data.notScannedDevices, color: '#94a3b8' },
          ]}
        />
        <BarListCard title="Severity Distribution" items={data.severityDistribution.map((s) => ({ label: s.name, value: s.count }))} barColor="#dc2626" />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card className="border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <CardTitleRow title="Recent Integrity Events" />
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Device', 'Status', 'Severity', 'Alert', 'Time'].map((h) => (
                      <th key={h} className="whitespace-nowrap px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.recentIntegrityEvents.map((e, i) => (
                    <tr key={`${e.deviceUuid}-${e.eventTime}-${i}`}>
                      <td className="max-w-[140px] truncate px-2 py-1.5 text-xs text-gray-900">{e.deviceName ?? e.deviceUuid ?? '—'}</td>
                      <td className="px-2 py-1.5">
                        <StatusBadge label={e.status ?? '—'} tone={integrityTone(e.status)} />
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-600">{e.severity ?? '—'}</td>
                      <td className="px-2 py-1.5">{e.securityAlert ? <StatusBadge label="ALERT" tone="red" /> : <span className="text-[10px] text-gray-400">—</span>}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-[11px] text-gray-500">{formatDateTime(e.eventTime)}</td>
                    </tr>
                  ))}
                  {data.recentIntegrityEvents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-xs text-gray-500">
                        No integrity events recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 lg:hidden">
              {data.recentIntegrityEvents.map((e, i) => (
                <div key={`${e.deviceUuid}-${e.eventTime}-${i}`} className="rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-gray-900">{e.deviceName ?? e.deviceUuid ?? '—'}</p>
                    <StatusBadge label={e.status ?? '—'} tone={integrityTone(e.status)} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Severity</p>
                      <p className="text-sm text-gray-900">{e.severity ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Alert</p>
                      <div className="mt-0.5">{e.securityAlert ? <StatusBadge label="ALERT" tone="red" /> : <span className="text-sm text-gray-900">—</span>}</div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Time</p>
                      <p className="text-sm text-gray-900">{formatDateTime(e.eventTime)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {data.recentIntegrityEvents.length === 0 && <p className="px-2 py-6 text-center text-xs text-gray-500">No integrity events recorded.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <CardTitleRow title="Recent SIM Events" />
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Device', 'Event', 'Carrier', 'Alert', 'Time'].map((h) => (
                      <th key={h} className="whitespace-nowrap px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.recentSimEvents.map((e, i) => (
                    <tr key={`${e.deviceUuid}-${e.eventTime}-${i}`}>
                      <td className="max-w-[140px] truncate px-2 py-1.5 text-xs text-gray-900">{e.deviceName ?? e.deviceUuid ?? '—'}</td>
                      <td className="px-2 py-1.5">
                        <StatusBadge label={e.eventType ?? '—'} tone={e.eventType === 'SWAPPED' ? 'red' : e.eventType === 'REMOVED' ? 'amber' : 'blue'} />
                      </td>
                      <td className="max-w-[100px] truncate px-2 py-1.5 text-xs text-gray-600">{e.carrierName ?? '—'}</td>
                      <td className="px-2 py-1.5">{e.securityAlert ? <StatusBadge label="ALERT" tone="red" /> : <span className="text-[10px] text-gray-400">—</span>}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-[11px] text-gray-500">{formatDateTime(e.eventTime)}</td>
                    </tr>
                  ))}
                  {data.recentSimEvents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-xs text-gray-500">
                        No SIM events recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 lg:hidden">
              {data.recentSimEvents.map((e, i) => (
                <div key={`${e.deviceUuid}-${e.eventTime}-${i}`} className="rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-gray-900">{e.deviceName ?? e.deviceUuid ?? '—'}</p>
                    <StatusBadge label={e.eventType ?? '—'} tone={e.eventType === 'SWAPPED' ? 'red' : e.eventType === 'REMOVED' ? 'amber' : 'blue'} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Carrier</p>
                      <p className="truncate text-sm text-gray-900">{e.carrierName ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Alert</p>
                      <div className="mt-0.5">{e.securityAlert ? <StatusBadge label="ALERT" tone="red" /> : <span className="text-sm text-gray-900">—</span>}</div>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Time</p>
                      <p className="text-sm text-gray-900">{formatDateTime(e.eventTime)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {data.recentSimEvents.length === 0 && <p className="px-2 py-6 text-center text-xs text-gray-500">No SIM events recorded.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ApplicationsPanel() {
  const { data, isLoading, isError, refetch, isFetching, error } = useApplicationReportQuery();

  if (isLoading) return <ReportSkeleton />;
  if (isError || !data) {
    return <ReportError message={error instanceof Error ? error.message : 'Unable to load application report.'} onRetry={() => refetch()} />;
  }

  const excel = () =>
    exportToExcel(
      'Applications',
      'mdm-application-report',
      data.topApps.map((a) => ({
        'App Name': a.appName,
        'Package Id': a.packageId,
        'Installed On (Devices)': a.deviceCount,
        'Blocked On (Devices)': a.blockedCount,
      })),
    );

  return (
    <div className="space-y-4">
      <ExportBar csvType="applications" onExcel={excel} generatedAt={data.generatedAt} onRefresh={() => refetch()} isFetching={isFetching} />

      <div className="grid grid-cols-3 gap-3">
        <KpiTile title="Distinct Apps" value={nf.format(data.distinctApps)} sub="across the fleet" icon={<AppWindow className="h-4 w-4" />} accent="bg-blue-50 text-blue-600" />
        <KpiTile title="Installations" value={nf.format(data.totalInstallations)} sub="app-device pairs" icon={<Smartphone className="h-4 w-4" />} accent="bg-sky-50 text-sky-600" />
        <KpiTile title="Blocked" value={nf.format(data.blockedInstallations)} sub="blocked installations" icon={<ShieldAlert className="h-4 w-4" />} accent="bg-red-50 text-red-600" />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <BarListCard title="Most Installed Apps" items={data.topApps.map((a) => ({ label: a.appName, value: a.deviceCount }))} barColor="#2563eb" />
        <BarListCard title="Top Apps by Screen Time · 30d" items={data.topUsedApps.map((a) => ({ label: a.appName, value: a.foregroundHours }))} barColor="#7c3aed" valueFormatter={(v) => formatHours(v)} />
        <BarListCard title="Blocked Apps" items={data.blockedApps.map((a) => ({ label: a.appName, value: a.blockedCount }))} barColor="#dc2626" />
      </div>
    </div>
  );
}

function UsersPanel() {
  const { data, isLoading, isError, refetch, isFetching, error } = useUserReportQuery();

  if (isLoading) return <ReportSkeleton />;
  if (isError || !data) {
    return <ReportError message={error instanceof Error ? error.message : 'Unable to load user report.'} onRetry={() => refetch()} />;
  }

  const excel = () =>
    exportToExcel(
      'Users',
      'mdm-user-report',
      data.rows.map((r) => ({
        'Full Name': r.fullName ?? '',
        Email: r.email,
        Role: r.role ?? '',
        Active: r.active ? 'Yes' : 'No',
        'Devices Owned': r.devicesOwned,
        'Created At': r.createdAt ?? '',
      })),
    );

  return (
    <div className="space-y-4">
      <ExportBar csvType="users" onExcel={excel} generatedAt={data.generatedAt} onRefresh={() => refetch()} isFetching={isFetching} />

      <div className="grid grid-cols-3 gap-3">
        <KpiTile title="Total Users" value={nf.format(data.totalUsers)} sub="in your hierarchy" icon={<UserRound className="h-4 w-4" />} accent="bg-blue-50 text-blue-600" />
        <KpiTile title="Active" value={nf.format(data.activeUsers)} sub="enabled accounts" icon={<UserRound className="h-4 w-4" />} accent="bg-emerald-50 text-emerald-600" />
        <KpiTile title="Inactive" value={nf.format(data.inactiveUsers)} sub="disabled accounts" icon={<UserRound className="h-4 w-4" />} accent="bg-gray-100 text-gray-600" />
      </div>

      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {['User', 'Role', 'Status', 'Devices Owned', 'Created'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((r) => (
                  <tr key={r.userId} className="hover:bg-gray-50">
                    <td className="max-w-[220px] px-3 py-2">
                      <p className="truncate text-xs font-medium text-gray-900">{r.fullName ?? '—'}</p>
                      <p className="truncate text-[10px] text-gray-400">{r.email}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">{r.role ?? '—'}</td>
                    <td className="px-3 py-2">
                      <StatusBadge label={r.active ? 'Active' : 'Inactive'} tone={r.active ? 'green' : 'gray'} />
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold tabular-nums text-gray-900">{nf.format(r.devicesOwned)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-gray-500">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 p-3 lg:hidden">
            {data.rows.map((r) => (
              <div key={r.userId} className="rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{r.fullName ?? '—'}</p>
                    <p className="truncate text-xs text-gray-500">{r.email}</p>
                  </div>
                  <StatusBadge label={r.active ? 'Active' : 'Inactive'} tone={r.active ? 'green' : 'gray'} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Role</p>
                    <p className="truncate text-sm text-gray-900">{r.role ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Devices Owned</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900">{nf.format(r.devicesOwned)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm text-gray-900">{formatDateTime(r.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
            {data.rows.length === 0 && <p className="px-3 py-8 text-center text-sm text-gray-500">No users found.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsagePanel() {
  const { data, isLoading, isError, refetch, isFetching, error } = useUsageReportQuery();

  if (isLoading) return <ReportSkeleton />;
  if (isError || !data) {
    return <ReportError message={error instanceof Error ? error.message : 'Unable to load usage report.'} onRetry={() => refetch()} />;
  }

  const excel = () =>
    exportToExcel(
      'Usage',
      'mdm-usage-report',
      data.topDataConsumers.map((r) => ({
        'Device Name': r.deviceName ?? '',
        'Device UUID': r.deviceUuid,
        'WiFi Data': formatBytes(r.wifiBytes),
        'Mobile Data': formatBytes(r.mobileBytes),
        'Total Data': formatBytes(r.totalBytes),
        'Battery %': r.batteryCharge ?? '',
        'Last Sync': r.lastStateSyncTime ?? '',
      })),
    );

  return (
    <div className="space-y-4">
      <ExportBar csvType="usage" onExcel={excel} generatedAt={data.generatedAt} onRefresh={() => refetch()} isFetching={isFetching} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiTile title="Total Data" value={formatBytes(data.totalBytes)} sub="WiFi + mobile" icon={<Wifi className="h-4 w-4" />} accent="bg-blue-50 text-blue-600" />
        <KpiTile title="WiFi Data" value={formatBytes(data.totalWifiBytes)} sub="fleet total" icon={<Wifi className="h-4 w-4" />} accent="bg-sky-50 text-sky-600" />
        <KpiTile title="Mobile Data" value={formatBytes(data.totalMobileBytes)} sub="fleet total" icon={<Smartphone className="h-4 w-4" />} accent="bg-violet-50 text-violet-600" />
        <KpiTile title="Avg Battery" value={`${pf.format(data.avgBatteryPercent)}%`} sub={`${nf.format(data.lowBatteryDevices)} below 20%`} icon={<BatteryMedium className="h-4 w-4" />} accent="bg-emerald-50 text-emerald-600" />
        <KpiTile title="Charging" value={nf.format(data.chargingDevices)} sub="devices now" icon={<BatteryMedium className="h-4 w-4" />} accent="bg-amber-50 text-amber-600" />
        <KpiTile title="Synced 24h" value={nf.format(data.syncedLast24h)} sub={`${nf.format(data.staleDevices)} stale · ${nf.format(data.neverSyncedDevices)} never`} icon={<RefreshCw className="h-4 w-4" />} accent="bg-gray-100 text-gray-600" />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <BarListCard
          title="Top Data Consumers"
          items={data.topDataConsumers.map((r) => ({ label: r.deviceName ?? r.deviceUuid, value: r.totalBytes }))}
          barColor="#2563eb"
          valueFormatter={(v) => formatBytes(v)}
        />
        <DistributionCard
          title="Sync Freshness"
          centerValue={nf.format(data.syncedLast24h)}
          centerLabel="Fresh"
          segments={[
            { label: 'Synced 24h', value: data.syncedLast24h, color: '#16a34a' },
            { label: 'Stale', value: data.staleDevices, color: '#d97706' },
            { label: 'Never', value: data.neverSyncedDevices, color: '#dc2626' },
          ]}
        />
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ReportsDashboard() {
  const [tab, setTab] = useState<ReportTab>('overview');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold tracking-tight text-gray-900">Reports</h2>
          <span className="hidden text-xs text-gray-400 sm:inline">Fleet-wide reporting across devices, security, apps, users and usage</span>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm max-lg:flex-nowrap max-lg:overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors max-lg:min-h-[44px] max-lg:shrink-0 max-lg:whitespace-nowrap ${
              tab === t.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewPanel />}
      {tab === 'devices' && <DevicesPanel />}
      {tab === 'security' && <SecurityPanel />}
      {tab === 'applications' && <ApplicationsPanel />}
      {tab === 'users' && <UsersPanel />}
      {tab === 'usage' && <UsagePanel />}
    </div>
  );
}
