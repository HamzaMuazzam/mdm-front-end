import type { ReactNode } from 'react';
import {
  Activity,
  CalendarClock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserRound,
  UserX,
  Wifi,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceAnalyticsQuery } from '@/hooks/useDevices';
import type { DashboardPlanAnalytics, DashboardTrendPoint } from '@/types/device.types';
import { nexusTheme } from '@/lib/theme';

const fmt = new Intl.NumberFormat('en-US');
const pctFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(`${date}T00:00:00`)
  );
}

function formatDateTime(dateTime: string) {
  const d = new Date(dateTime.replace(/(\.\d{3})\d+/, '$1'));
  if (Number.isNaN(d.getTime())) return dateTime;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function clamp(v: number) {
  return Math.min(100, Math.max(0, v));
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
}

function StatCard({ title, value, sub, icon, iconColor = 'text-primary-500', trend, trendLabel }: StatCardProps) {
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-success-600' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <Card className="card-lift overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2 truncate">
              {title}
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-none">
              {typeof value === 'number' ? fmt.format(value) : value}
            </p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5 truncate">{sub}</p>}
            {trend && trendLabel && (
              <div className={`flex items-center gap-1 mt-2 ${trendColor}`}>
                <TrendIcon className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{trendLabel}</span>
              </div>
            )}
          </div>
          <div
            className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center ${iconColor} bg-current/[0.08]`}
          >
            <span className={iconColor}>{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Donut / Ring Chart ─────────────────────────────────────────────────────

interface DonutProps {
  label: string;
  value: number;
  color: string;
  sub?: string;
}

function DonutCard({ label, value, color, sub }: DonutProps) {
  const clamped = clamp(value);
  const circumference = 2 * Math.PI * 44;
  const offset = circumference * (1 - clamped / 100);

  return (
    <Card className="card-lift">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center pb-5">
        <div className="relative w-36 h-36">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold text-foreground">{pctFmt.format(clamped)}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">of total</p>
          </div>
        </div>
        {sub && <p className="text-xs text-muted-foreground text-center mt-3 leading-relaxed">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Stacked Bar ───────────────────────────────────────────────────────────

interface Segment { label: string; value: number; color: string }

function StackedBarCard({
  title,
  description,
  segments,
}: {
  title: string;
  description: string;
  segments: Segment[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <Card className="card-lift">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        {/* Bar */}
        <div className="h-3 rounded-full overflow-hidden bg-muted flex">
          {total > 0 &&
            segments.map((seg) => (
              <div
                key={seg.label}
                style={{ width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color }}
              />
            ))}
        </div>
        {/* Legend */}
        <div className="grid gap-2 sm:grid-cols-2">
          {segments.map((seg) => {
            const pct = total > 0 ? (seg.value / total) * 100 : 0;
            return (
              <div key={seg.label} className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-xs font-medium text-foreground/80 truncate">{seg.label}</span>
                </div>
                <span className="text-xs font-bold text-foreground flex-shrink-0">
                  {fmt.format(seg.value)}{' '}
                  <span className="text-muted-foreground font-normal">({pctFmt.format(pct)}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Trend / Area Chart ────────────────────────────────────────────────────

function TrendChart({
  title,
  description,
  points,
  strokeColor,
  gradientStart,
}: {
  title: string;
  description: string;
  points: DashboardTrendPoint[];
  strokeColor: string;
  gradientStart: string;
}) {
  if (points.length === 0) {
    return (
      <Card className="card-lift">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-border text-muted-foreground gap-2">
            <Activity className="h-8 w-8 opacity-30" />
            <p className="text-sm">No trend data for this period</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const W = 700, H = 220, PX = 44, PY = 20;
  const xSpan = W - PX * 2, ySpan = H - PY * 2;
  const maxV = Math.max(1, ...points.map((p) => p.value));
  const denom = points.length > 1 ? points.length - 1 : 1;

  const coords = points.map((p, i) => ({
    x: PX + (i / denom) * xSpan,
    y: H - PY - (p.value / maxV) * ySpan,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${H - PY} L ${coords[0].x} ${H - PY} Z`;
  const gradId = `g-${title.replace(/\W/g, '')}`;

  return (
    <Card className="card-lift">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="rounded-xl bg-muted/30 border border-border/50 p-3 overflow-hidden">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradientStart} stopOpacity={0.35} />
                <stop offset="100%" stopColor={gradientStart} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((i) => {
              const y = PY + (ySpan / 3) * i;
              const tick = Math.round(maxV - (maxV / 3) * i);
              return (
                <g key={i}>
                  <line x1={PX} y1={y} x2={W - PX} y2={y} stroke="hsl(var(--border))" strokeWidth="1" />
                  <text x={PX - 8} y={y + 4} textAnchor="end" fontSize="11" fill="hsl(var(--muted-foreground))">
                    {fmt.format(tick)}
                  </text>
                </g>
              );
            })}
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {coords.map((c, i) => (
              <circle key={points[i].date} cx={c.x} cy={c.y} r="4" fill={strokeColor} stroke="hsl(var(--surface))" strokeWidth="2" />
            ))}
          </svg>
        </div>
        <div
          className="grid gap-1 mt-2"
          style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
        >
          {points.map((p) => (
            <p key={p.date} className="text-[10px] text-muted-foreground text-center">
              {formatDateLabel(p.date)}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Plan Analytics ────────────────────────────────────────────────────────

function PlanAnalyticsCard({ plan }: { plan: DashboardPlanAnalytics }) {
  const items = [
    { label: 'Total Bought', value: plan.totalPlansBought, bg: 'bg-muted/50', text: 'text-foreground' },
    { label: 'Active', value: plan.activePlans, bg: 'bg-success-50', text: 'text-success-700' },
    { label: 'Expired', value: plan.expiredPlans, bg: 'bg-red-50', text: 'text-red-700' },
    { label: 'Expiring this week', value: plan.expiringThisWeek, bg: 'bg-warning-50', text: 'text-warning-700' },
    { label: 'Expiring this month', value: plan.expiringThisMonth, bg: 'bg-orange-50', text: 'text-orange-700' },
  ];

  return (
    <Card className="card-lift">
      <CardHeader>
        <CardTitle>Plan Analytics</CardTitle>
        <CardDescription>Subscription plan health across your organization</CardDescription>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {items.map((item) => (
            <div key={item.label} className={`rounded-xl p-3 ${item.bg}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${item.text} opacity-70`}>
                {item.label}
              </p>
              <p className={`text-2xl font-bold mt-1 ${item.text}`}>{fmt.format(item.value)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="h-36 rounded-2xl skeleton" />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl skeleton" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-72 rounded-2xl skeleton" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────

export function AnalyticsDashboard() {
  const { data, isLoading, isError, refetch, isFetching, error } = useDeviceAnalyticsQuery();

  if (isLoading) return <Skeleton />;

  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fleet Overview</CardTitle>
          <CardDescription>Failed to load analytics. Check API connectivity and retry.</CardDescription>
        </CardHeader>
        <CardContent className="pb-5 flex flex-col items-start gap-4">
          <div className="px-3.5 py-2.5 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm">
            {error instanceof Error ? error.message : 'An unknown error occurred.'}
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { subscription, devices, connectivity, sync, generatedAt, enrollmentTrendLast7Days, syncTrendLast7Days, planAnalytics } = data;
  const users = data.users ?? { totalUsersAdded: 0, activeUsers: 0, inactiveUsers: 0 };
  const hasSub = subscription != null;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Hero Banner ──────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl">
        <div
          className="px-6 py-6 sm:py-7"
          style={{
            background:
              'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e3a5f 100%)',
          }}
        >
          {/* Decorative blobs */}
          <div
            className="absolute inset-0 opacity-50 pointer-events-none"
            style={{
              backgroundImage: `
                radial-gradient(at 0% 0%, rgba(99,102,241,0.4) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(14,165,233,0.3) 0px, transparent 50%)
              `,
            }}
          />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-indigo-300/80 font-semibold mb-1">
                {nexusTheme.brand.name} Platform
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Fleet Overview
              </h2>
              <p className="text-xs text-indigo-200/60 mt-1">
                Last updated {formatDateTime(generatedAt)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/10 text-white hover:bg-white/18 hover:text-white shadow-none self-start sm:self-auto"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI Grid ─────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total Devices"
          value={devices.totalDevicesAdded}
          sub={`${fmt.format(devices.activeDevices)} active · ${fmt.format(devices.inactiveDevices)} inactive`}
          icon={<Smartphone className="h-5 w-5" />}
          iconColor="text-primary-500"
        />
        <StatCard
          title="Online Now"
          value={connectivity.onlineDevices}
          sub={`${fmt.format(connectivity.offlineDevices)} offline`}
          icon={<Wifi className="h-5 w-5" />}
          iconColor="text-success-600"
          trend={connectivity.onlinePercent >= 75 ? 'up' : connectivity.onlinePercent >= 40 ? 'neutral' : 'down'}
          trendLabel={`${pctFmt.format(connectivity.onlinePercent)}% online`}
        />
        <StatCard
          title="Synced in 24h"
          value={sync.syncedInLast24Hours}
          sub={`${fmt.format(sync.neverSyncedDevices)} never synced · ${fmt.format(sync.staleSyncDevices)} stale`}
          icon={<Activity className="h-5 w-5" />}
          iconColor="text-info-600"
        />
        <StatCard
          title="Verified Devices"
          value={devices.verifiedDevices}
          sub={`${fmt.format(devices.unverifiedDevices)} pending verification`}
          icon={<ShieldCheck className="h-5 w-5" />}
          iconColor="text-warning-600"
        />
        <StatCard
          title="Team Members"
          value={users.totalUsersAdded}
          sub={`${fmt.format(users.activeUsers)} active · ${fmt.format(users.inactiveUsers)} inactive`}
          icon={<UserRound className="h-5 w-5" />}
          iconColor="text-purple-500"
        />
        {hasSub && (
          <StatCard
            title="Days Remaining"
            value={subscription!.packageDaysRemaining}
            sub={subscription!.packageExpired ? 'Subscription expired' : `Renews: ${formatDateTime(subscription!.packageExpiryDate)}`}
            icon={<CalendarClock className="h-5 w-5" />}
            iconColor={subscription!.packageExpired ? 'text-destructive' : 'text-primary-500'}
            trend={subscription!.packageExpired ? 'down' : subscription!.packageDaysRemaining < 7 ? 'neutral' : 'up'}
            trendLabel={subscription!.packageExpired ? 'Expired' : 'Active'}
          />
        )}
      </div>

      {/* ── Donuts + Subscription Snapshot ───────────────────── */}
      <div className={`grid gap-4 ${hasSub ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 max-w-xl'}`}>
        {hasSub && (
          <DonutCard
            label="Subscription Utilization"
            value={subscription!.utilizationPercent}
            color="#6366f1"
            sub={`${fmt.format(subscription!.devicesInUse)} assigned · ${fmt.format(subscription!.devicesRemaining)} available`}
          />
        )}
        <DonutCard
          label="Connectivity Rate"
          value={connectivity.onlinePercent}
          color="#10b981"
          sub={`${fmt.format(connectivity.onlineDevices)} online out of ${fmt.format(devices.totalDevicesAdded)}`}
        />
        {hasSub && (
          <Card className="card-lift">
            <CardHeader>
              <CardTitle>Active Plan</CardTitle>
              <CardDescription>Current subscription details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 pb-5">
              <div className="rounded-xl bg-muted/50 px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Package</p>
                <p className="text-base font-bold text-foreground mt-0.5">{subscription!.subscriptionName}</p>
              </div>
              <div className="rounded-xl bg-muted/50 px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Expires</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{formatDateTime(subscription!.packageExpiryDate)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-success-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-success-700">In Use</p>
                  <p className="text-xl font-bold text-success-800 mt-0.5">{fmt.format(subscription!.devicesInUse)}</p>
                </div>
                <div className="rounded-xl bg-primary-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-700">Available</p>
                  <p className="text-xl font-bold text-primary-800 mt-0.5">{fmt.format(subscription!.devicesRemaining)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Plan Analytics ───────────────────────────────────── */}
      {planAnalytics != null && <PlanAnalyticsCard plan={planAnalytics} />}

      {/* ── Trend Charts ─────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        <TrendChart
          title="Enrollment Trend — 7 Days"
          description="Daily count of newly enrolled devices"
          points={enrollmentTrendLast7Days}
          strokeColor="#6366f1"
          gradientStart="#818cf8"
        />
        <TrendChart
          title="Sync Trend — 7 Days"
          description="Daily count of devices that synced"
          points={syncTrendLast7Days}
          strokeColor="#0ea5e9"
          gradientStart="#38bdf8"
        />
      </div>

      {/* ── Distribution Bars ────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        <StackedBarCard
          title="Device State Breakdown"
          description="Fleet split by current state"
          segments={[
            { label: 'Active', value: devices.activeDevices, color: '#10b981' },
            { label: 'Inactive', value: devices.inactiveDevices, color: '#f59e0b' },
            { label: 'Verified', value: devices.verifiedDevices, color: '#6366f1' },
            { label: 'Unverified', value: devices.unverifiedDevices, color: '#ef4444' },
          ]}
        />
        <StackedBarCard
          title="Connectivity & Sync Health"
          description="Operational view of online and sync quality"
          segments={[
            { label: 'Online', value: connectivity.onlineDevices, color: '#22c55e' },
            { label: 'Offline', value: connectivity.offlineDevices, color: '#94a3b8' },
            { label: 'Synced (24h)', value: sync.syncedInLast24Hours, color: '#06b6d4' },
            { label: 'Never Synced', value: sync.neverSyncedDevices, color: '#f97316' },
            { label: 'Stale', value: sync.staleSyncDevices, color: '#ef4444' },
          ]}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        <StackedBarCard
          title="Team Status"
          description="Member activity breakdown"
          segments={[
            { label: 'Active Members', value: users.activeUsers, color: '#16a34a' },
            { label: 'Inactive Members', value: users.inactiveUsers, color: '#dc2626' },
          ]}
        />
        <Card className="card-lift">
          <CardHeader>
            <CardTitle>Team Snapshot</CardTitle>
            <CardDescription>Current member counts</CardDescription>
          </CardHeader>
          <CardContent className="pb-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="flex flex-col items-center gap-1 mt-1">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xl font-bold text-foreground">{fmt.format(users.totalUsersAdded)}</span>
                </p>
              </div>
              <div className="rounded-xl bg-success-50 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-success-700">Active</p>
                <p className="flex flex-col items-center gap-1 mt-1">
                  <UserCheck className="h-4 w-4 text-success-600" />
                  <span className="text-xl font-bold text-success-800">{fmt.format(users.activeUsers)}</span>
                </p>
              </div>
              <div className="rounded-xl bg-red-50 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700">Inactive</p>
                <p className="flex flex-col items-center gap-1 mt-1">
                  <UserX className="h-4 w-4 text-red-500" />
                  <span className="text-xl font-bold text-red-700">{fmt.format(users.inactiveUsers)}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
