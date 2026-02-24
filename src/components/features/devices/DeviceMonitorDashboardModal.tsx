import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, BatteryCharging, BatteryMedium, Bluetooth, CalendarClock, Gauge, MapPin, RefreshCw, Signal, Smartphone, Wifi } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDeviceAppUsageHistoryQuery, useDeviceMonitorStateDashboardQuery } from '@/hooks/useDevices';
import type { Device } from '@/types/device.types';

interface DeviceMonitorDashboardModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
}

const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function formatDateBoundaryForApi(value: string, boundary: 'start' | 'end'): string {
  if (!value) {
    return value;
  }

  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }

  const timePart = boundary === 'start' ? '00:00:00' : '23:59:59';
  return `${day}-${month}-${year} ${timePart}`;
}

function safeDate(value: string): Date {
  const normalized = value.replace(/(\.\d{3})\d+/, '$1');
  return new Date(normalized);
}

function formatDateTime(value: string): string {
  if (!value) {
    return '-';
  }

  const date = safeDate(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function FeatureBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        enabled
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-slate-200 bg-slate-100 text-slate-700'
      }`}
    >
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm font-semibold">{enabled ? 'Enabled' : 'Disabled'}</p>
    </div>
  );
}

interface TopMetricProps {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
}

function TopMetric({ title, value, helper, icon }: TopMetricProps) {
  return (
    <Card className="border-0 bg-white/90 shadow-md">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{helper}</p>
        </div>
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">{icon}</div>
      </CardContent>
    </Card>
  );
}

export function DeviceMonitorDashboardModal({ device, isOpen, onClose }: DeviceMonitorDashboardModalProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);

  const deviceUuid = device?.deviceUuid ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setFrom('');
    setTo('');
    setPage(0);
    setSize(50);
  }, [deviceUuid, isOpen]);

  const usageParams = useMemo(
    () => ({
      page,
      size,
      ...(from ? { from: formatDateBoundaryForApi(from, 'start') } : {}),
      ...(to ? { to: formatDateBoundaryForApi(to, 'end') } : {}),
    }),
    [page, size, from, to]
  );

  const {
    data: stateData,
    isLoading: isStateLoading,
    isError: isStateError,
    error: stateError,
    refetch: refetchState,
    isFetching: isFetchingState,
  } = useDeviceMonitorStateDashboardQuery(deviceUuid, isOpen);

  const {
    data: usageData,
    isLoading: isUsageLoading,
    isError: isUsageError,
    error: usageError,
    refetch: refetchUsage,
    isFetching: isFetchingUsage,
  } = useDeviceAppUsageHistoryQuery(deviceUuid, usageParams, isOpen);

  const appUsageRows = usageData?.content ?? [];
  const topAppUsage = useMemo(
    () => [...appUsageRows].sort((a, b) => b.foregroundTimeMillis - a.foregroundTimeMillis).slice(0, 8),
    [appUsageRows]
  );
  const maxUsage = useMemo(
    () => topAppUsage.reduce((max, app) => Math.max(max, app.foregroundTimeMillis), 0),
    [topAppUsage]
  );

  if (!isOpen || !device) {
    return null;
  }

  const refreshAll = () => {
    refetchState();
    refetchUsage();
  };

  const stateErrorMessage = stateError instanceof Error ? stateError.message : 'Failed to fetch device state dashboard.';
  const usageErrorMessage = usageError instanceof Error ? usageError.message : 'Failed to fetch app usage history.';

  const totalDataBytes = (stateData?.totalWifiDataBytes ?? 0) + (stateData?.totalMobileDataBytes ?? 0);
  const wifiPercent = totalDataBytes > 0 ? (stateData?.totalWifiDataBytes ?? 0) / totalDataBytes * 100 : 0;
  const mobilePercent = totalDataBytes > 0 ? (stateData?.totalMobileDataBytes ?? 0) / totalDataBytes * 100 : 0;

  const currentPage = usageData?.number ?? page;
  const totalPages = usageData?.totalPages ?? 0;
  const canPrev = currentPage > 0;
  const canNext = totalPages > 0 && currentPage < totalPages - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden border-0 shadow-2xl">
        <CardHeader className="border-b border-slate-200 bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-700 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">Device Monitor Dashboard</CardTitle>
              <p className="mt-1 text-sm text-cyan-100">
                {device.userName} | {device.deviceUuid}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-white/50 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={refreshAll}
                disabled={isFetchingState || isFetchingUsage}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${(isFetchingState || isFetchingUsage) ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="ghost"
                className="text-white hover:bg-white/20 hover:text-white"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-6 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-6">
          <Card className="border border-slate-200 bg-white/90 shadow-sm">
            <CardContent className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">From Date</label>
                <Input
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">To Date</label>
                <Input
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Page Size</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  value={size}
                  onChange={(event) => {
                    setSize(Number(event.target.value));
                    setPage(0);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Page</label>
                <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-700">
                  {currentPage + 1}
                  {totalPages > 0 ? ` / ${totalPages}` : ''}
                </div>
              </div>
            </CardContent>
          </Card>

          {isStateError && (
            <Card className="border border-rose-200 bg-rose-50">
              <CardContent className="p-4 text-sm text-rose-700">{stateErrorMessage}</CardContent>
            </Card>
          )}
          {isUsageError && (
            <Card className="border border-rose-200 bg-rose-50">
              <CardContent className="p-4 text-sm text-rose-700">{usageErrorMessage}</CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <TopMetric
              title="Battery"
              value={stateData ? `${stateData.batteryCharge}%` : '-'}
              helper={stateData?.isCharging ? 'Charging now' : 'Not charging'}
              icon={stateData?.isCharging ? <BatteryCharging className="h-5 w-5" /> : <BatteryMedium className="h-5 w-5" />}
            />
            <TopMetric
              title="Total Data"
              value={stateData ? formatBytes(totalDataBytes) : '-'}
              helper={stateData ? `${percentFormatter.format(wifiPercent)}% WiFi / ${percentFormatter.format(mobilePercent)}% Mobile` : '-'}
              icon={<Signal className="h-5 w-5" />}
            />
            <TopMetric
              title="Last Sync"
              value={stateData ? formatDateTime(stateData.lastStateSyncTime) : '-'}
              helper="State dashboard sync"
              icon={<CalendarClock className="h-5 w-5" />}
            />
            <TopMetric
              title="Usage Records"
              value={numberFormatter.format(usageData?.totalElements ?? 0)}
              helper={`Showing ${numberFormatter.format(appUsageRows.length)} entries`}
              icon={<Activity className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="border-0 bg-white/90 shadow-md xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Device Feature State</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FeatureBadge label="WiFi" enabled={stateData?.wifiEnabled ?? false} />
                <FeatureBadge label="Mobile Data" enabled={stateData?.mobileDataEnabled ?? false} />
                <FeatureBadge label="Bluetooth" enabled={stateData?.bluetoothEnabled ?? false} />
                <FeatureBadge label="GPS" enabled={stateData?.gpsEnabled ?? false} />
                <FeatureBadge label="Accessibility" enabled={stateData?.accessibilityEnabled ?? false} />
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800">
                  <p className="text-xs uppercase tracking-wide">Last Update</p>
                  <p className="mt-1 text-sm font-semibold">{stateData ? formatDateTime(stateData.lastUpdate) : '-'}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white/90 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Data Traffic Split</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div
                  className="relative h-40 w-40 rounded-full"
                  style={{
                    background: `conic-gradient(#0284c7 0 ${wifiPercent}%, #0f766e ${wifiPercent}% 100%)`,
                  }}
                >
                  <div className="absolute inset-5 rounded-full bg-white shadow-inner" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xl font-bold text-slate-900">{stateData ? formatBytes(totalDataBytes) : '-'}</p>
                      <p className="text-xs text-slate-500">Combined</p>
                    </div>
                  </div>
                </div>
                <div className="grid w-full gap-2">
                  <div className="flex items-center justify-between rounded-md bg-sky-50 px-3 py-2 text-sm">
                    <span className="font-medium text-sky-800">WiFi</span>
                    <span className="text-sky-900">
                      {stateData ? `${formatBytes(stateData.totalWifiDataBytes)} (${percentFormatter.format(wifiPercent)}%)` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-teal-50 px-3 py-2 text-sm">
                    <span className="font-medium text-teal-800">Mobile</span>
                    <span className="text-teal-900">
                      {stateData ? `${formatBytes(stateData.totalMobileDataBytes)} (${percentFormatter.format(mobilePercent)}%)` : '-'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-0 bg-white/90 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Top App Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isUsageLoading ? (
                  <p className="text-sm text-slate-500">Loading usage chart...</p>
                ) : topAppUsage.length === 0 ? (
                  <p className="text-sm text-slate-500">No app usage data for selected filters.</p>
                ) : (
                  topAppUsage.map((app) => {
                    const ratio = maxUsage > 0 ? app.foregroundTimeMillis / maxUsage : 0;
                    const width = Math.max(8, ratio * 100);
                    return (
                      <div key={`${app.packageName}-${app.recordDate}`} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <div className="truncate font-medium text-slate-800">{app.appName}</div>
                          <div className="whitespace-nowrap text-slate-500">{formatDuration(app.foregroundTimeMillis)}</div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="border-0 bg-white/90 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Quick Device Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Device</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Smartphone className="h-4 w-4" />
                    {device.model || '-'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">OS Version</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{device.osVersion || '-'}</p>
                </div>
                <div className="rounded-lg bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Connectivity</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Wifi className="h-4 w-4" />
                    {(stateData?.wifiEnabled ?? false) || (stateData?.mobileDataEnabled ?? false) ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Sensors</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <MapPin className="h-4 w-4" />
                    {stateData?.gpsEnabled ? 'GPS active' : 'GPS inactive'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Bluetooth</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Bluetooth className="h-4 w-4" />
                    {stateData?.bluetoothEnabled ? 'On' : 'Off'}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Battery Health</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Gauge className="h-4 w-4" />
                    {stateData ? `${stateData.batteryCharge}%` : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 bg-white/90 shadow-md">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">App Usage History</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canPrev}
                    onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                  >
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canNext}
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isUsageLoading ? (
                <p className="py-6 text-center text-sm text-slate-500">Loading app usage history...</p>
              ) : appUsageRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No app usage entries found for current filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">App</th>
                        <th className="px-3 py-2">Package</th>
                        <th className="px-3 py-2">Foreground Time</th>
                        <th className="px-3 py-2">Window</th>
                        <th className="px-3 py-2">Record Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appUsageRows.map((item) => (
                        <tr key={`${item.packageName}-${item.recordDate}`} className="border-b border-slate-100 text-sm">
                          <td className="px-3 py-2 font-medium text-slate-800">{item.appName}</td>
                          <td className="px-3 py-2 text-slate-600">{item.packageName}</td>
                          <td className="px-3 py-2 text-slate-700">{formatDuration(item.foregroundTimeMillis)}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {formatDateTime(item.usageStart)} - {formatDateTime(item.usageEnd)}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{formatDateTime(item.recordDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {(isStateLoading || isUsageLoading) && (
            <div className="flex items-center justify-center py-2 text-sm text-slate-500">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Loading dashboard data...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
