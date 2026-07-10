import type { ReactNode } from 'react';
import {
  Activity,
  CalendarClock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserRound,
  Wifi,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDeviceAnalyticsQuery } from '@/hooks/useDevices';
import type { DashboardPlanAnalytics, DashboardTrendPoint } from '@/types/device.types';
import { IntegrityFleetCard } from './IntegrityFleetCard';

const nf = new Intl.NumberFormat('en-US');
const pf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

function formatDateTime(dateTime: string): string {
  const normalized = dateTime.replace(/(\.\d{3})\d+/, '$1');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return dateTime;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function clampPct(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.min(100, Math.max(0, v));
}
function pct(v: number, total: number): number {
  return total > 0 ? (v / total) * 100 : 0;
}
function trendDelta(points: DashboardTrendPoint[]): number | null {
  if (!points || points.length < 2) return null;
  return points[points.length - 1].value - points[0].value;
}

// ── Building blocks ─────────────────────────────────────────────────────────

function CardTitleRow({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {right}
    </div>
  );
}

function DeltaChip({ delta }: { delta: number }) {
  const neutral = delta === 0;
  const up = delta > 0;
  const cls = neutral ? 'bg-gray-100 text-gray-500' : up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700';
  const Icon = neutral ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-2.5 w-2.5" />
      {up ? '+' : ''}
      {nf.format(delta)}
    </span>
  );
}

interface KpiTileProps {
  title: string;
  value: string;
  sub: string;
  icon: ReactNode;
  accent: string;
  delta?: number | null;
}

function KpiTile({ title, value, sub, icon, accent, delta }: KpiTileProps) {
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <p className="truncate text-[11px] font-medium text-gray-500">{title}</p>
          <div className={`rounded p-1 ${accent}`}>{icon}</div>
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <p className="text-xl font-semibold leading-none tracking-tight text-gray-900">{value}</p>
          {delta !== null && delta !== undefined && <DeltaChip delta={delta} />}
        </div>
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
            <span className="w-9 text-right text-[10px] tabular-nums text-gray-400">{pf.format(pct(s.value, total))}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DistributionCard({
  title,
  segments,
  centerValue,
  centerLabel,
}: {
  title: string;
  segments: Segment[];
  centerValue: string;
  centerLabel: string;
}) {
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

function TrendChart({ title, points, strokeColor }: { title: string; points: DashboardTrendPoint[]; strokeColor: string }) {
  const total = points.reduce((s, p) => s + p.value, 0);
  const delta = trendDelta(points);

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
  const gid = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-g`;

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <CardTitleRow
          title={title}
          right={
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-gray-900">{nf.format(total)}</span>
              {delta !== null && <DeltaChip delta={delta} />}
            </div>
          }
        />
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
          {coords.map((c, i) => (
            <circle key={`${points[i].date}-d`} cx={c.x} cy={c.y} r="2.5" fill="#fff" stroke={strokeColor} strokeWidth="1.5" />
          ))}
        </svg>
        <div className="mt-0.5 grid text-[9px] text-gray-400" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
          {points.map((p) => (
            <p key={`${title}-${p.date}`} className="text-center">
              {formatDateLabel(p.date)}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionCard({
  name,
  utilizationPercent,
  devicesInUse,
  devicesRemaining,
  expiry,
}: {
  name: string;
  utilizationPercent: number;
  devicesInUse: number;
  devicesRemaining: number;
  expiry: string;
}) {
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <CardTitleRow title={`Subscription · ${name}`} />
        <div className="flex items-center gap-4">
          <Donut
            segments={[
              { label: 'In use', value: devicesInUse, color: '#2563eb' },
              { label: 'Available', value: devicesRemaining, color: '#e5e7eb' },
            ]}
            center={
              <div>
                <p className="text-base font-semibold leading-none text-gray-900">{pf.format(clampPct(utilizationPercent))}%</p>
                <p className="mt-0.5 text-[9px] uppercase tracking-wide text-gray-400">Used</p>
              </div>
            }
          />
          <div className="w-full flex-1 space-y-1.5">
            <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-2 py-1">
              <span className="text-[11px] text-gray-500">In use</span>
              <span className="text-[12px] font-semibold text-gray-900">{nf.format(devicesInUse)}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-2 py-1">
              <span className="text-[11px] text-blue-700">Available</span>
              <span className="text-[12px] font-semibold text-blue-900">{nf.format(devicesRemaining)}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-2 py-1">
              <span className="text-[11px] text-gray-500">Expires</span>
              <span className="text-[12px] font-semibold text-gray-900">{expiry}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanAnalyticsCard({ plan }: { plan: DashboardPlanAnalytics }) {
  const items = [
    { label: 'Bought', value: plan.totalPlansBought },
    { label: 'Active', value: plan.activePlans },
    { label: 'Expired', value: plan.expiredPlans },
    { label: 'Exp. Week', value: plan.expiringThisWeek },
    { label: 'Exp. Month', value: plan.expiringThisMonth },
  ];
  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <CardTitleRow title="Plan Analytics" />
        <div className="grid grid-cols-5 gap-2">
          {items.map((it) => (
            <div key={it.label} className="rounded border border-gray-200 bg-gray-50 p-2 text-center">
              <p className="text-lg font-semibold leading-none text-gray-900">{nf.format(it.value)}</p>
              <p className="mt-1 truncate text-[10px] uppercase tracking-wide text-gray-400">{it.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

export function AnalyticsDashboard() {
  const { data, isLoading, isError, refetch, isFetching, error } = useDeviceAnalyticsQuery();

  if (isLoading) return <AnalyticsSkeleton />;

  if (isError || !data) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to load analytics data.';
    return (
      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardContent className="flex flex-col items-start gap-3 p-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Analytics Dashboard</h2>
            <p className="text-sm text-gray-500">The analytics request failed. Retry after checking API reachability.</p>
          </div>
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { subscription, devices, connectivity, sync, generatedAt, enrollmentTrendLast7Days, syncTrendLast7Days, planAnalytics } = data;
  const hasSubscription = subscription != null;
  const users = data.users ?? { totalUsersAdded: 0, activeUsers: 0, inactiveUsers: 0 };

  return (
    <div className="space-y-4">
      {/* ── Slim header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold tracking-tight text-gray-900">Operations Pulse</h2>
          <span className="hidden items-center gap-1.5 text-xs text-gray-400 sm:flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Updated {formatDateTime(generatedAt)}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* ── KPI strip: 6 across ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          title="Total Devices"
          value={nf.format(devices.totalDevicesAdded)}
          sub={`${nf.format(devices.activeDevices)} active`}
          icon={<Smartphone className="h-4 w-4" />}
          accent="bg-blue-50 text-blue-600"
          delta={trendDelta(enrollmentTrendLast7Days)}
        />
        <KpiTile
          title="Online Now"
          value={nf.format(connectivity.onlineDevices)}
          sub={`${pf.format(clampPct(connectivity.onlinePercent))}% online`}
          icon={<Wifi className="h-4 w-4" />}
          accent="bg-emerald-50 text-emerald-600"
        />
        <KpiTile
          title="Synced 24h"
          value={nf.format(sync.syncedInLast24Hours)}
          sub={`${nf.format(sync.neverSyncedDevices)} never`}
          icon={<Activity className="h-4 w-4" />}
          accent="bg-sky-50 text-sky-600"
          delta={trendDelta(syncTrendLast7Days)}
        />
        <KpiTile
          title="Verified"
          value={nf.format(devices.verifiedDevices)}
          sub={`${nf.format(devices.unverifiedDevices)} unverified`}
          icon={<ShieldCheck className="h-4 w-4" />}
          accent="bg-violet-50 text-violet-600"
        />
        <KpiTile
          title="Total Users"
          value={nf.format(users.totalUsersAdded)}
          sub={`${nf.format(users.activeUsers)} active`}
          icon={<UserRound className="h-4 w-4" />}
          accent="bg-amber-50 text-amber-600"
        />
        {hasSubscription ? (
          <KpiTile
            title="Plan Days"
            value={nf.format(subscription!.packageDaysRemaining)}
            sub={subscription!.packageExpired ? 'Expired' : 'Active'}
            icon={<CalendarClock className="h-4 w-4" />}
            accent="bg-indigo-50 text-indigo-600"
          />
        ) : (
          <KpiTile
            title="Offline"
            value={nf.format(connectivity.offlineDevices)}
            sub={`${nf.format(sync.staleSyncDevices)} stale`}
            icon={<Wifi className="h-4 w-4" />}
            accent="bg-gray-100 text-gray-600"
          />
        )}
      </div>

      {/* ── Trends (compact) + distributions in a dense 3-col grid ───────── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <TrendChart title="Enrollment · 7d" points={enrollmentTrendLast7Days} strokeColor="#2563eb" />
        <TrendChart title="Sync · 7d" points={syncTrendLast7Days} strokeColor="#0ea5e9" />
        <DistributionCard
          title="Fleet Composition"
          centerValue={nf.format(devices.totalDevicesAdded)}
          centerLabel="Devices"
          segments={[
            { label: 'Active', value: devices.activeDevices, color: '#16a34a' },
            { label: 'Inactive', value: devices.inactiveDevices, color: '#d97706' },
            { label: 'Verified', value: devices.verifiedDevices, color: '#0ea5e9' },
            { label: 'Unverified', value: devices.unverifiedDevices, color: '#dc2626' },
          ]}
        />
        <DistributionCard
          title="Connectivity & Sync"
          centerValue={`${pf.format(clampPct(connectivity.onlinePercent))}%`}
          centerLabel="Online"
          segments={[
            { label: 'Online', value: connectivity.onlineDevices, color: '#16a34a' },
            { label: 'Offline', value: connectivity.offlineDevices, color: '#64748b' },
            { label: 'Synced 24h', value: sync.syncedInLast24Hours, color: '#0ea5e9' },
            { label: 'Stale', value: sync.staleSyncDevices, color: '#d97706' },
            { label: 'Never', value: sync.neverSyncedDevices, color: '#dc2626' },
          ]}
        />
        <DistributionCard
          title="User State"
          centerValue={nf.format(users.totalUsersAdded)}
          centerLabel="Users"
          segments={[
            { label: 'Active', value: users.activeUsers, color: '#16a34a' },
            { label: 'Inactive', value: users.inactiveUsers, color: '#dc2626' },
          ]}
        />
        {hasSubscription && (
          <SubscriptionCard
            name={subscription!.subscriptionName}
            utilizationPercent={subscription!.utilizationPercent}
            devicesInUse={subscription!.devicesInUse}
            devicesRemaining={subscription!.devicesRemaining}
            expiry={formatDateTime(subscription!.packageExpiryDate)}
          />
        )}
      </div>

      {/* ── Integrity + plans ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <IntegrityFleetCard />
        {planAnalytics != null && <PlanAnalyticsCard plan={planAnalytics} />}
      </div>
    </div>
  );
}
