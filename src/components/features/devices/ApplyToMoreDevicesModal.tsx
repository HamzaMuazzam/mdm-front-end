import { useMemo, useState, type ComponentType } from 'react';
import { Copy, Check } from 'lucide-react';
import type { ApplyDevicePolicyRequest, Device, UpdateDeviceConfigurationRequest } from '@/types/device.types';
import { useApplyDevicePolicy } from '@/hooks/useDevices';
import { toast } from '@/hooks/useToast';
import { BulkPolicyScaffold, type BulkApplyContext } from './BulkPolicyScaffold';

type PolicyField = Exclude<keyof ApplyDevicePolicyRequest, 'deviceUuids' | 'target'>;

/** Fields that are never pre-selected — pushing them to a fleet by accident is dangerous. */
const SENSITIVE_FIELDS = new Set<PolicyField>([
  'deviceAdminCode',
  'devicePassword',
  'unlockPassword',
  'vpnSecret',
  'newServerURL',
  'kioskModePackageId',
]);

/** Humanised labels for the checklist (falls back to the camelCase key). */
const LABELS: Partial<Record<PolicyField, string>> = {
  rootDetectionEnabled: 'Root detection',
  rootDetectionLockOnCompromise: 'Lock on compromise',
  rootDetectionWipeOnCompromise: 'Wipe on compromise',
  rootDetectionMinSeverityForAction: 'Min severity for action',
  rootDetectionScanIntervalMinutes: 'Scan interval (min)',
  systemUpdatePolicyType: 'OS update policy',
  maintenanceWindowStart: 'Maintenance window start',
  maintenanceWindowEnd: 'Maintenance window end',
  freezePeriodStart: 'Freeze period start',
  freezePeriodEnd: 'Freeze period end',
  clearSystemUpdatePolicy: 'Clear OS update policy',
  vpnEnabled: 'VPN enabled',
  vpnServerAddress: 'VPN server',
  vpnUsername: 'VPN username',
  vpnSecret: 'VPN secret',
  vpnProtocolTypeId: 'VPN protocol',
  vpnRoutingRules: 'VPN routing rules',
  wifiStateId: 'Wi-Fi',
  mobileDataStateId: 'Mobile data',
  gpsStateId: 'GPS',
  bluetoothStateId: 'Bluetooth',
  pushNotificationProtocolTypeId: 'Push protocol',
  useDefaultLauncherTheme: 'Default launcher theme',
  backgroundColor: 'Background colour',
  applicationNamesColor: 'App name colour',
  backgroundImageUrl: 'Background image',
  iconSize: 'Icon size',
  screenAlwaysOn: 'Screen always on',
  manageScreenTimeout: 'Manage screen timeout',
  screenTimeoutSeconds: 'Screen timeout (s)',
  enableKioskMode: 'Kiosk mode',
  kioskModePackageId: 'Kiosk package',
  enableScreenLock: 'Screen lock',
  blockExternalStorage: 'Block external storage',
  isDefaultLauncher: 'Default launcher',
  isDeviceAdminCodeEnabled: 'Admin code enabled',
  deviceAdminCode: 'Admin code',
  allowToAccessSensitiveSettings: 'Allow sensitive settings',
  strictAirplaneMode: 'Strict airplane mode',
  factoryResetLock: 'Factory reset lock',
  networkResetLock: 'Network reset lock',
  appsControlLock: 'Apps control lock',
  lockPowerButton: 'Lock power button',
  devicePassword: 'Device password',
  unlockPassword: 'Unlock password',
  newServerURL: 'Server URL',
  launcherOrientation: 'Launcher orientation',
  enableHomeButton: 'Home button',
  enableRecentsButton: 'Recents button',
  enableStatusBarInfo: 'Status bar info',
  notificationBarStateId: 'Notification bar',
  enableNotifications: 'Notifications',
  hideSystemNotificationBarInLauncher: 'Hide system notification bar',
  showLauncherOwnNotificationBar: 'Launcher notification bar',
  locationTrackingByTypeId: 'Location tracking type',
  lockSystemOrientation: 'Lock system orientation',
  lockLauncherOrientation: 'Lock launcher orientation',
  lockVolume: 'Lock volume',
  volumePercentage: 'Volume %',
  applicationPermissionGranterTypeId: 'Permission granter',
};

const mask = (key: PolicyField, value: unknown) => {
  if (SENSITIVE_FIELDS.has(key) && typeof value === 'string' && value.length > 0) return '••••••';
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (value === '' || value === null || value === undefined) return '—';
  return String(value);
};

/** Projects the per-device Configuration editor form onto the policy endpoint (same field names). */
export function configFormToPolicyPayload(form: UpdateDeviceConfigurationRequest): Partial<ApplyDevicePolicyRequest> {
  const { userId: _u, deviceId: _d, configName: _c, description: _desc, isInstalledAsDeviceOwner: _o, ...rest } = form;
  void _u;
  void _d;
  void _c;
  void _desc;
  void _o;
  const out: Record<string, unknown> = {};
  Object.entries(rest).forEach(([k, v]) => {
    if (v === undefined) return;
    // Empty strings mean "not set" in the editor — never push them as a value.
    if (typeof v === 'string' && v.trim() === '') return;
    out[k] = v;
  });
  return out as Partial<ApplyDevicePolicyRequest>;
}

/**
 * "Apply to more devices…" — takes the values currently on a per-device form and pushes them to
 * groups and/or other devices through the shared policy endpoint. The source device is pre-selected
 * and locked; the admin ticks which fields travel (sensitive ones are off by default).
 */
export function ApplyToMoreDevicesModal({
  title,
  subtitle,
  icon,
  devices,
  sourceDevice,
  payload,
  onClose,
}: {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  devices: Device[];
  sourceDevice: Device;
  payload: Partial<ApplyDevicePolicyRequest>;
  onClose: () => void;
}) {
  const applyMutation = useApplyDevicePolicy();

  const fields = useMemo(
    () =>
      (Object.keys(payload) as PolicyField[]).filter((k) => {
        const v = payload[k];
        return v !== undefined && v !== null && !(typeof v === 'string' && v === '');
      }),
    [payload]
  );
  const [included, setIncluded] = useState<Set<PolicyField>>(() => new Set(fields.filter((f) => !SENSITIVE_FIELDS.has(f))));

  const toggle = (f: PolicyField) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  const allOn = fields.every((f) => included.has(f));

  const handleApply = async ({ target }: BulkApplyContext) => {
    const body: Partial<ApplyDevicePolicyRequest> = {};
    included.forEach((f) => {
      (body as Record<string, unknown>)[f] = payload[f];
    });
    try {
      const results = await applyMutation.mutateAsync({ target, ...body });
      const ok = results.filter((r) => r.success).length;
      const failed = results.length - ok;
      toast({
        variant: failed === 0 ? 'success' : 'destructive',
        title: 'Applied to more devices',
        description: `${included.size} setting${included.size === 1 ? '' : 's'} pushed to ${ok} device${ok === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.`,
      });
      if (failed === 0) onClose();
    } catch {
      /* error toast handled by the mutation */
    }
  };

  return (
    <BulkPolicyScaffold
      title={title}
      subtitle={subtitle}
      icon={icon}
      devices={devices}
      isPending={applyMutation.isPending}
      canApply={included.size > 0}
      onApply={handleApply}
      onClose={onClose}
      lockedDeviceUuids={[sourceDevice.deviceUuid]}
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Values below are taken from <span className="font-semibold">{sourceDevice.deviceName || sourceDevice.deviceUuid}</span>. Only
            ticked settings are sent; everything else on the targeted devices stays untouched.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Settings to apply ({included.size}/{fields.length})
          </p>
          <button
            type="button"
            onClick={() => setIncluded(allOn ? new Set() : new Set(fields))}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            {allOn ? 'Untick all' : 'Tick all'}
          </button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to apply — the form has no values set.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-gray-200">
            {fields.map((f) => {
              const on = included.has(f);
              const sensitive = SENSITIVE_FIELDS.has(f);
              return (
                <li key={f}>
                  <button
                    type="button"
                    onClick={() => toggle(f)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${on ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}
                  >
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${on ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`}>
                      {on && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        {LABELS[f] || f}
                        {sensitive && <span className="ml-1.5 rounded bg-amber-50 px-1 py-px text-[10px] font-medium text-amber-700">sensitive</span>}
                      </p>
                    </div>
                    <span className="max-w-[45%] truncate font-mono text-xs text-muted-foreground" title={mask(f, payload[f])}>
                      {mask(f, payload[f])}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </BulkPolicyScaffold>
  );
}
