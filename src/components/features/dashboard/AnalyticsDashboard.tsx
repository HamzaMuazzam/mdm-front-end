import type { ReactNode } from 'react';
import { Activity, CalendarClock, CheckCircle2, CloudOff, RefreshCw, ShieldCheck, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceAnalyticsQuery } from '@/hooks/useDevices';
import type { DashboardTrendPoint } from '@/types/device.types';

const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatDateLabel(date: string): string {
  const parsedDate = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsedDate);
}

function formatDateTime(dateTime: string): string {
  const normalizedDateTime = dateTime.replace(/(\.\d{3})\d+/, '$1');
  const parsedDate = new Date(normalizedDateTime);
  if (Number.isNaN(parsedDate.getTime())) {
    return dateTime;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate);
}

function clampPercentage(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
}

function MetricCard({ title, value, description, icon }: MetricCardProps) {
  return (
    <Card className="border-0 bg-white/85 shadow-lg backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardDescription className="text-slate-600">{title}</CardDescription>
        <CardTitle className="text-3xl font-bold text-slate-900">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between pt-2">
        <p className="text-sm text-slate-500">{description}</p>
        <div className="rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</div>
      </CardContent>
    </Card>
  );
}

interface RingChartProps {
  label: string;
  value: number;
  color: string;
  helperText: string;
}

function RingChart({ label, value, color, helperText }: RingChartProps) {
  const clampedValue = clampPercentage(value);

  return (
    <Card className="border-0 bg-white/85 shadow-lg backdrop-blur-sm">
      <CardHeader>
        <CardDescription className="text-slate-600">{label}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div
          className="relative h-36 w-36 rounded-full"
          style={{
            background: `conic-gradient(${color} 0 ${clampedValue}%, #e2e8f0 ${clampedValue}% 100%)`,
          }}
        >
          <div className="absolute inset-4 flex items-center justify-center rounded-full bg-white text-center shadow-inner">
            <div>
              <p className="text-3xl font-bold text-slate-900">{percentFormatter.format(clampedValue)}%</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">Current</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-500">{helperText}</p>
      </CardContent>
    </Card>
  );
}

interface StackedBarSegment {
  label: string;
  value: number;
  color: string;
}

interface StackedBarProps {
  title: string;
  description: string;
  segments: StackedBarSegment[];
}

function StackedBarCard({ title, description, segments }: StackedBarProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <Card className="border-0 bg-white/85 shadow-lg backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl text-slate-900">{title}</CardTitle>
        <CardDescription className="text-slate-600">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="h-4 overflow-hidden rounded-full bg-slate-200">
          {total > 0 ? (
            <div className="flex h-full w-full">
              {segments.map((segment) => (
                <div
                  key={segment.label}
                  style={{
                    width: `${(segment.value / total) * 100}%`,
                    backgroundColor: segment.color,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="h-full w-full bg-slate-300" />
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {segments.map((segment) => {
            const percent = total > 0 ? (segment.value / total) * 100 : 0;

            return (
              <div key={segment.label} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                  <p className="text-sm font-medium text-slate-700">{segment.label}</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {numberFormatter.format(segment.value)} ({percentFormatter.format(percent)}%)
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface TrendChartProps {
  title: string;
  description: string;
  points: DashboardTrendPoint[];
  strokeColor: string;
  gradientStart: string;
}

function TrendChart({ title, description, points, strokeColor, gradientStart }: TrendChartProps) {
  if (points.length === 0) {
    return (
      <Card className="border-0 bg-white/85 shadow-lg backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-900">{title}</CardTitle>
          <CardDescription className="text-slate-600">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No trend data available for this period.
          </p>
        </CardContent>
      </Card>
    );
  }

  const width = 700;
  const height = 240;
  const paddingX = 44;
  const paddingY = 24;
  const xSpan = width - paddingX * 2;
  const ySpan = height - paddingY * 2;
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const denominator = points.length > 1 ? points.length - 1 : 1;

  const coordinates = points.map((point, index) => ({
    x: paddingX + (index / denominator) * xSpan,
    y: height - paddingY - (point.value / maxValue) * ySpan,
  }));

  const linePath = coordinates
    .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`)
    .join(' ');

  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x} ${height - paddingY} L ${coordinates[0].x} ${height - paddingY} Z`;
  const gradientId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-gradient`;

  return (
    <Card className="border-0 bg-white/85 shadow-lg backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl text-slate-900">{title}</CardTitle>
        <CardDescription className="text-slate-600">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-60 w-full">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradientStart} stopOpacity={0.45} />
                <stop offset="100%" stopColor={gradientStart} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {[0, 1, 2, 3].map((index) => {
              const y = paddingY + (ySpan / 3) * index;
              const tickValue = Math.round(maxValue - (maxValue / 3) * index);

              return (
                <g key={index}>
                  <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                  <text x={paddingX - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                    {numberFormatter.format(tickValue)}
                  </text>
                </g>
              );
            })}

            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />

            {coordinates.map((coord, index) => (
              <circle key={`${points[index].date}-dot`} cx={coord.x} cy={coord.y} r="4" fill={strokeColor} />
            ))}
          </svg>
        </div>

        <div className="grid gap-2 text-xs text-slate-500" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
          {points.map((point) => (
            <p key={`${title}-${point.date}`} className="text-center">
              {formatDateLabel(point.date)}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border-0 bg-slate-200/70">
        <CardContent className="h-40 animate-pulse" />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="border-0 bg-slate-200/70">
            <CardContent className="h-28 animate-pulse" />
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-0 bg-slate-200/70">
            <CardContent className="h-72 animate-pulse" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsDashboard() {
  const { data, isLoading, isError, refetch, isFetching, error } = useDeviceAnalyticsQuery();

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (isError || !data) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to load analytics data.';

    return (
      <Card className="border-0 bg-white/85 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-900">Analytics Dashboard</CardTitle>
          <CardDescription className="text-slate-600">The analytics request failed. Retry after checking API reachability.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { subscription, devices, connectivity, sync, generatedAt, enrollmentTrendLast7Days, syncTrendLast7Days } = data;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 shadow-xl">
        <div className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-700 px-6 py-7 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_50%)]" />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.18em] text-cyan-100">Device Analytics</p>
              <h2 className="text-3xl font-bold">Operations Pulse</h2>
              <p className="text-sm text-cyan-100">Generated at {formatDateTime(generatedAt)}</p>
            </div>

            <Button
              variant="outline"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Total Devices Added"
          value={numberFormatter.format(devices.totalDevicesAdded)}
          description={`${numberFormatter.format(devices.activeDevices)} active devices`}
          icon={<Smartphone className="h-5 w-5" />}
        />
        <MetricCard
          title="Online Devices"
          value={numberFormatter.format(connectivity.onlineDevices)}
          description={`${numberFormatter.format(connectivity.offlineDevices)} offline devices`}
          icon={<Wifi className="h-5 w-5" />}
        />
        <MetricCard
          title="Synced In Last 24h"
          value={numberFormatter.format(sync.syncedInLast24Hours)}
          description={`${numberFormatter.format(sync.neverSyncedDevices)} never synced`}
          icon={<Activity className="h-5 w-5" />}
        />
        <MetricCard
          title="Verified Devices"
          value={numberFormatter.format(devices.verifiedDevices)}
          description={`${numberFormatter.format(devices.unverifiedDevices)} unverified`}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <MetricCard
          title="Plan Days Remaining"
          value={numberFormatter.format(subscription.packageDaysRemaining)}
          description={subscription.packageExpired ? 'Subscription is expired' : 'Subscription is active'}
          icon={<CalendarClock className="h-5 w-5" />}
        />
        <MetricCard
          title="Devices Remaining"
          value={numberFormatter.format(subscription.devicesRemaining)}
          description={`${numberFormatter.format(subscription.devicesInUse)} in use of ${numberFormatter.format(subscription.allowedDevices)}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <RingChart
          label="Subscription Utilization"
          value={subscription.utilizationPercent}
          color="#1d4ed8"
          helperText={`${numberFormatter.format(subscription.devicesInUse)} devices currently assigned`}
        />
        <RingChart
          label="Connectivity Ratio"
          value={connectivity.onlinePercent}
          color="#0891b2"
          helperText={`${numberFormatter.format(connectivity.onlineDevices)} online out of ${numberFormatter.format(devices.totalDevicesAdded)}`}
        />
        <Card className="border-0 bg-white/85 shadow-lg backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-900">Subscription Snapshot</CardTitle>
            <CardDescription className="text-slate-600">Current package and capacity details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Package</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{subscription.subscriptionName}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Expires</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{formatDateTime(subscription.packageExpiryDate)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-wide text-emerald-700">In Use</p>
                <p className="mt-1 text-lg font-bold text-emerald-900">{numberFormatter.format(subscription.devicesInUse)}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs uppercase tracking-wide text-blue-700">Available</p>
                <p className="mt-1 text-lg font-bold text-blue-900">{numberFormatter.format(subscription.devicesRemaining)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TrendChart
          title="Enrollment Trend (Last 7 Days)"
          description="Daily count of newly enrolled devices"
          points={enrollmentTrendLast7Days}
          strokeColor="#2563eb"
          gradientStart="#60a5fa"
        />
        <TrendChart
          title="Sync Trend (Last 7 Days)"
          description="Daily count of devices synced"
          points={syncTrendLast7Days}
          strokeColor="#0f766e"
          gradientStart="#2dd4bf"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <StackedBarCard
          title="Device State Distribution"
          description="How your current fleet is split by state"
          segments={[
            { label: 'Active', value: devices.activeDevices, color: '#10b981' },
            { label: 'Inactive', value: devices.inactiveDevices, color: '#f59e0b' },
            { label: 'Verified', value: devices.verifiedDevices, color: '#0ea5e9' },
            { label: 'Unverified', value: devices.unverifiedDevices, color: '#ef4444' },
          ]}
        />
        <StackedBarCard
          title="Connectivity & Sync Health"
          description="Operational view of online and sync quality"
          segments={[
            { label: 'Online', value: connectivity.onlineDevices, color: '#22c55e' },
            { label: 'Offline', value: connectivity.offlineDevices, color: '#64748b' },
            { label: 'Synced (24h)', value: sync.syncedInLast24Hours, color: '#06b6d4' },
            { label: 'Never Synced', value: sync.neverSyncedDevices, color: '#f97316' },
            { label: 'Stale Sync', value: sync.staleSyncDevices, color: '#ef4444' },
          ]}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 bg-emerald-50 shadow-md">
          <CardContent className="flex items-center gap-3 p-5">
            <Wifi className="h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm text-emerald-700">Online Now</p>
              <p className="text-xl font-bold text-emerald-900">{numberFormatter.format(connectivity.onlineDevices)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-slate-100 shadow-md">
          <CardContent className="flex items-center gap-3 p-5">
            <WifiOff className="h-5 w-5 text-slate-700" />
            <div>
              <p className="text-sm text-slate-700">Offline Now</p>
              <p className="text-xl font-bold text-slate-900">{numberFormatter.format(connectivity.offlineDevices)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-orange-50 shadow-md">
          <CardContent className="flex items-center gap-3 p-5">
            <CloudOff className="h-5 w-5 text-orange-700" />
            <div>
              <p className="text-sm text-orange-700">Never Synced</p>
              <p className="text-xl font-bold text-orange-900">{numberFormatter.format(sync.neverSyncedDevices)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
