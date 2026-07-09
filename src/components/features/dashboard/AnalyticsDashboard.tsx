import type { ReactNode } from 'react';
import { Activity, CalendarClock, RefreshCw, ShieldCheck, Smartphone, UserCheck, UserRound, UserX, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceAnalyticsQuery } from '@/hooks/useDevices';
import type { DashboardPlanAnalytics, DashboardTrendPoint } from '@/types/device.types';
import { IntegrityFleetCard } from './IntegrityFleetCard';

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
    <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs text-gray-500">{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold text-gray-900">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between pt-2">
        <p className="text-xs text-gray-500">{description}</p>
        <div className="rounded-md bg-blue-50 p-2 text-blue-600">{icon}</div>
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
    <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <CardHeader>
        <CardDescription className="text-xs text-gray-500">{label}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div
          className="relative h-36 w-36 rounded-full"
          style={{
            background: `conic-gradient(${color} 0 ${clampedValue}%, #e2e8f0 ${clampedValue}% 100%)`,
          }}
        >
          <div className="absolute inset-4 flex items-center justify-center rounded-full bg-white text-center">
            <div>
              <p className="text-2xl font-semibold text-gray-900">{percentFormatter.format(clampedValue)}%</p>
              <p className="text-xs uppercase tracking-wide text-gray-500">Current</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600">{helperText}</p>
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
    <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">{title}</CardTitle>
        <CardDescription className="text-sm text-gray-500">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="h-4 overflow-hidden rounded-full bg-gray-200">
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
            <div className="h-full w-full bg-gray-300" />
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {segments.map((segment) => {
            const percent = total > 0 ? (segment.value / total) * 100 : 0;

            return (
              <div key={segment.label} className="flex items-center justify-between rounded-md bg-gray-50 border border-gray-200 p-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                  <p className="text-sm font-medium text-gray-600">{segment.label}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900">
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
      <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900">{title}</CardTitle>
          <CardDescription className="text-sm text-gray-500">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
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
    <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">{title}</CardTitle>
        <CardDescription className="text-sm text-gray-500">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
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

        <div className="grid gap-2 text-xs text-gray-500" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
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

interface PlanAnalyticsCardProps {
  plan: DashboardPlanAnalytics;
}

function PlanAnalyticsCard({ plan }: PlanAnalyticsCardProps) {
  return (
    <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">Plan Analytics</CardTitle>
        <CardDescription className="text-sm text-gray-500">Overview of subscription plans across your organization</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Bought</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{numberFormatter.format(plan.totalPlansBought)}</p>
        </div>
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Active</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{numberFormatter.format(plan.activePlans)}</p>
        </div>
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Expired</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{numberFormatter.format(plan.expiredPlans)}</p>
        </div>
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Expiring This Week</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{numberFormatter.format(plan.expiringThisWeek)}</p>
        </div>
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Expiring This Month</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{numberFormatter.format(plan.expiringThisMonth)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="bg-gray-100 border border-gray-200 rounded-lg">
        <CardContent className="h-40 animate-pulse" />
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="bg-gray-100 border border-gray-200 rounded-lg">
            <CardContent className="h-28 animate-pulse" />
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="bg-gray-100 border border-gray-200 rounded-lg">
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
      <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-gray-900">Analytics Dashboard</CardTitle>
          <CardDescription className="text-sm text-gray-500">The analytics request failed. Retry after checking API reachability.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
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
  const users = data.users ?? {
    totalUsersAdded: 0,
    activeUsers: 0,
    inactiveUsers: 0,
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="relative bg-white px-6 py-7">
          <div className="pointer-events-none absolute inset-0 hidden" />
          <div className="pointer-events-none absolute inset-0 hidden" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-gray-500">Device Analytics</p>
              <h2 className="text-xl font-semibold text-gray-900">Operations Pulse</h2>
              <p className="text-sm text-gray-600">Generated at {formatDateTime(generatedAt)}</p>
            </div>

            <Button
              variant="outline"
              className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
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
          title="Total Users Added"
          value={numberFormatter.format(users.totalUsersAdded)}
          description={`${numberFormatter.format(users.activeUsers)} active users`}
          icon={<UserRound className="h-5 w-5" />}
        />
        {hasSubscription && (
          <MetricCard
            title="Plan Days Remaining"
            value={numberFormatter.format(subscription!.packageDaysRemaining)}
            description={subscription!.packageExpired ? 'Subscription is expired' : 'Subscription is active'}
            icon={<CalendarClock className="h-5 w-5" />}
          />
        )}
        <IntegrityFleetCard />
      </div>

      <div className={`grid gap-4 sm:gap-6 ${hasSubscription ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {hasSubscription && (
          <RingChart
            label="Subscription Utilization"
            value={subscription!.utilizationPercent}
            color="#2563eb"
            helperText={`${numberFormatter.format(subscription!.devicesInUse)} devices currently assigned`}
          />
        )}
        <RingChart
          label="Connectivity Ratio"
          value={connectivity.onlinePercent}
          color="#0ea5e9"
          helperText={`${numberFormatter.format(connectivity.onlineDevices)} online out of ${numberFormatter.format(devices.totalDevicesAdded)}`}
        />
        {hasSubscription && (
          <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">Subscription Snapshot</CardTitle>
              <CardDescription className="text-sm text-gray-500">Current package and capacity details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Package</p>
                <p className="mt-1 text-base font-semibold text-gray-900">{subscription!.subscriptionName}</p>
              </div>
              <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Expires</p>
                <p className="mt-1 text-base font-semibold text-gray-900">{formatDateTime(subscription!.packageExpiryDate)}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">In Use</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{numberFormatter.format(subscription!.devicesInUse)}</p>
                </div>
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-blue-700">Available</p>
                  <p className="mt-1 text-lg font-semibold text-blue-900">{numberFormatter.format(subscription!.devicesRemaining)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {planAnalytics != null && <PlanAnalyticsCard plan={planAnalytics} />}

      <div className="grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-2">
        <TrendChart
          title="Enrollment Trend (Last 7 Days)"
          description="Daily count of newly enrolled devices"
          points={enrollmentTrendLast7Days}
          strokeColor="#2563eb"
          gradientStart="#2563eb"
        />
        <TrendChart
          title="Sync Trend (Last 7 Days)"
          description="Daily count of devices synced"
          points={syncTrendLast7Days}
          strokeColor="#0ea5e9"
          gradientStart="#0ea5e9"
        />
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-2">
        <StackedBarCard
          title="Device State Distribution"
          description="How your current fleet is split by state"
          segments={[
            { label: 'Active', value: devices.activeDevices, color: '#16a34a' },
            { label: 'Inactive', value: devices.inactiveDevices, color: '#d97706' },
            { label: 'Verified', value: devices.verifiedDevices, color: '#0ea5e9' },
            { label: 'Unverified', value: devices.unverifiedDevices, color: '#dc2626' },
          ]}
        />
        <StackedBarCard
          title="Connectivity & Sync Health"
          description="Operational view of online and sync quality"
          segments={[
            { label: 'Online', value: connectivity.onlineDevices, color: '#16a34a' },
            { label: 'Offline', value: connectivity.offlineDevices, color: '#64748b' },
            { label: 'Synced (24h)', value: sync.syncedInLast24Hours, color: '#0ea5e9' },
            { label: 'Never Synced', value: sync.neverSyncedDevices, color: '#d97706' },
            { label: 'Stale Sync', value: sync.staleSyncDevices, color: '#dc2626' },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-2">
        <StackedBarCard
          title="User State Distribution"
          description="How your user base is split by status"
          segments={[
            { label: 'Active Users', value: users.activeUsers, color: '#16a34a' },
            { label: 'Inactive Users', value: users.inactiveUsers, color: '#dc2626' },
          ]}
        />
        <Card className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">User Snapshot</CardTitle>
            <CardDescription className="text-sm text-gray-500">Current user counts from analytics service</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
              <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-gray-900">
                <UserRound className="h-4 w-4" />
                {numberFormatter.format(users.totalUsersAdded)}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Active</p>
              <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-gray-900">
                <UserCheck className="h-4 w-4" />
                {numberFormatter.format(users.activeUsers)}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Inactive</p>
              <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-gray-900">
                <UserX className="h-4 w-4" />
                {numberFormatter.format(users.inactiveUsers)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
