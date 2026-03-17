import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Home,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDevicesQuery } from '@/hooks/useDevices';
import { useDeviceNotifications, useNotificationSettings, useUpdateNotificationSettings } from '@/hooks/useNotifications';
import { ROUTES } from '@/utils/constants';
import type { NotificationPriority } from '@/types/notification.types';
import { usePermissionStore } from '@/store/permissionStore';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const normalized = value.replace(/(\.\d{3})\d+/, '$1');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function toIsoBoundary(value: string, boundary: 'start' | 'end'): string {
  if (!value) return value;
  return `${value}T${boundary === 'start' ? '00:00:00' : '23:59:59'}`;
}

export function DeviceNotificationsPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const numericDeviceId = deviceId ? parseInt(deviceId, 10) : null;
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [priority, setPriority] = useState<NotificationPriority | 'ALL'>('ALL');
  const [packageName, setPackageName] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);

  const { data: devices = [], isLoading: isLoadingDevices } = useDevicesQuery();
  const device = devices.find((item) => item.id === numericDeviceId);

  const queryParams = useMemo(
    () => ({
      page,
      size,
      ...(from ? { from: toIsoBoundary(from, 'start') } : {}),
      ...(to ? { to: toIsoBoundary(to, 'end') } : {}),
      ...(priority !== 'ALL' ? { priority } : {}),
      ...(packageName.trim() ? { packageName: packageName.trim() } : {}),
    }),
    [from, to, priority, packageName, page, size]
  );

  const {
    data: notificationsData,
    isLoading: isLoadingNotifications,
    isFetching: isFetchingNotifications,
    refetch,
  } = useDeviceNotifications(numericDeviceId, queryParams, !!numericDeviceId);

  const { data: settings } = useNotificationSettings(numericDeviceId, !!numericDeviceId && hasPermission('notifications:manage-alerts'));
  const updateSettingsMutation = useUpdateNotificationSettings();

  const notifications = notificationsData?.content ?? [];
  const currentPage = notificationsData?.number ?? page;
  const totalPages = notificationsData?.totalPages ?? 0;
  const canPrev = currentPage > 0;
  const canNext = totalPages > 0 && currentPage < totalPages - 1;

  const handleBack = () => {
    navigate(ROUTES.DASHBOARD, { state: { activeTab: 'devices' } });
  };

  const handleToggleAlerts = () => {
    if (!numericDeviceId || !settings) return;
    updateSettingsMutation.mutate({ deviceId: numericDeviceId, alertsEnabled: !settings.alertsEnabled });
  };

  if (isLoadingDevices) {
    return <div className="p-8">Loading notifications...</div>;
  }

  if (!device || !numericDeviceId) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <Card className="mx-auto max-w-2xl border border-destructive/20 bg-destructive/10">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-destructive">Device not found</h2>
            <p className="mt-2 text-sm text-destructive/80">The selected device could not be loaded.</p>
            <Button className="mt-4" onClick={handleBack}>
              Back To Devices
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 h-12 sm:h-14">
            <nav className="flex items-center space-x-2 text-sm min-w-0">
              <button onClick={handleBack} className="flex items-center text-muted-foreground hover:text-foreground shrink-0">
                <Home className="h-4 w-4" />
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <button onClick={handleBack} className="text-muted-foreground hover:text-foreground shrink-0">
                Devices
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">Notifications</span>
            </nav>
            <div className="hidden items-center gap-3 border-l border-border pl-4 md:flex shrink-0">
              <span className="text-sm font-medium">{device.model}</span>
              <span className="text-sm font-mono">{device.deviceUuid}</span>
              <span className="text-sm">{device.userName}</span>
            </div>
            <div className="flex items-center gap-2">
              {hasPermission('notifications:manage-alerts') && settings && (
                <Button
                  size="sm"
                  variant={settings.alertsEnabled ? 'default' : 'outline'}
                  onClick={handleToggleAlerts}
                  disabled={updateSettingsMutation.isPending}
                >
                  {settings.alertsEnabled ? 'Alerts On' : 'Alerts Off'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 shrink-0" disabled={isFetchingNotifications}>
                <RefreshCw className={`h-4 w-4 ${isFetchingNotifications ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 pb-3 flex-wrap">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="flex-1 min-w-[130px] sm:flex-none sm:w-[180px]" />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="flex-1 min-w-[130px] sm:flex-none sm:w-[180px]" />
            <div className="relative flex-1 min-w-[130px] sm:flex-none sm:w-[160px]">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                value={priority}
                onChange={(event) => setPriority(event.target.value as NotificationPriority | 'ALL')}
              >
                <option value="ALL">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <Input
              placeholder="Filter by package"
              value={packageName}
              onChange={(event) => setPackageName(event.target.value)}
              className="flex-1 min-w-[180px]"
            />
            <select
              className="flex-1 min-w-[90px] sm:flex-none sm:w-[120px] flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 pb-10">
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-3 shadow-lg shadow-orange-500/25">
            <Bell className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notification History</h1>
            <p className="mt-1 text-sm text-muted-foreground">Full captured notifications for this device.</p>
          </div>
        </div>

        <Card className="shadow-md">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={!canPrev} onClick={() => setPage((prev) => Math.max(prev - 1, 0))}>
                  Prev
                </Button>
                <Button size="sm" variant="outline" disabled={!canNext} onClick={() => setPage((prev) => prev + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingNotifications ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading notification history...</p>
            ) : notifications.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No notifications found for the current filters.</p>
            ) : (
              <>
                <div className="flex flex-col divide-y divide-border sm:hidden">
                  {notifications.map((item) => (
                    <div key={item.id} className="px-4 py-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-foreground">{item.appName || item.packageName}</p>
                        <span className="text-[11px] font-semibold uppercase text-muted-foreground">{item.priority}</span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground truncate">{item.packageName}</p>
                      {item.title && <p className="text-sm font-semibold text-foreground">{item.title}</p>}
                      {item.message && <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{item.message}</p>}
                      {item.rawPayload && (
                        <details className="rounded-lg border border-border/60 bg-muted/30 p-2">
                          <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">Payload</summary>
                          <pre className="mt-2 max-h-56 overflow-auto text-[11px] text-foreground whitespace-pre-wrap break-words">{item.rawPayload}</pre>
                        </details>
                      )}
                      <p className="text-xs text-muted-foreground">{formatDateTime(item.receivedAt)}</p>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">App</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Message</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Payload</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Priority</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {notifications.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 text-sm">
                            <p className="font-medium text-foreground">{item.appName || 'Unknown'}</p>
                            <p className="text-xs font-mono text-muted-foreground">{item.packageName}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">{item.title || '-'}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap break-words max-w-[480px]">{item.message || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            {item.rawPayload ? (
                              <details className="group">
                                <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground">View Payload</summary>
                                <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-muted/40 p-2 text-xs text-foreground whitespace-pre-wrap break-words">{item.rawPayload}</pre>
                              </details>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold uppercase text-foreground">
                              {item.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateTime(item.receivedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
