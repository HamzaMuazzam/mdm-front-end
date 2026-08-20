import { useState, type ComponentType } from 'react';
import { Wifi, Monitor, Lock, Bell } from 'lucide-react';
import type { Device, ApplyDevicePolicyRequest } from '@/types/device.types';
import {
  useApplyDevicePolicy,
  useFeatureStates,
  useLocationTrackingTypes,
  usePushNotificationProtocols,
  useApplicationPermissionGranters,
} from '@/hooks/useDevices';
import { toast } from '@/hooks/useToast';
import { BulkPolicyScaffold, type BulkApplyContext } from './BulkPolicyScaffold';

export type BulkConfigSection = 'connectivity' | 'display' | 'security' | 'notifications';

type FieldKind = 'enum' | 'tristate' | 'text' | 'number' | 'color';
type EnumSource = 'feature' | 'location' | 'push' | 'permission';

interface FieldDef {
  key: keyof ApplyDevicePolicyRequest;
  label: string;
  kind: FieldKind;
  enumSource?: EnumSource;
  placeholder?: string;
}

interface SectionDef {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  fields: FieldDef[];
}

const SECTIONS: Record<BulkConfigSection, SectionDef> = {
  connectivity: {
    title: 'Bulk Connectivity',
    subtitle: 'Push WiFi / mobile data / GPS and push transport to many devices',
    icon: Wifi,
    fields: [
      { key: 'wifiStateId', label: 'WiFi State', kind: 'enum', enumSource: 'feature' },
      { key: 'mobileDataStateId', label: 'Mobile Data State', kind: 'enum', enumSource: 'feature' },
      { key: 'gpsStateId', label: 'GPS State', kind: 'enum', enumSource: 'feature' },
      { key: 'bluetoothStateId', label: 'Bluetooth State', kind: 'enum', enumSource: 'feature' },
      { key: 'pushNotificationProtocolTypeId', label: 'Push Notification Protocol', kind: 'enum', enumSource: 'push' },
    ],
  },
  display: {
    title: 'Bulk Display & Screen',
    subtitle: 'Push theme, colors and screen behaviour to many devices',
    icon: Monitor,
    fields: [
      { key: 'useDefaultLauncherTheme', label: 'Use Default Theme', kind: 'tristate' },
      { key: 'backgroundColor', label: 'Background Color', kind: 'color' },
      { key: 'applicationNamesColor', label: 'App Names Color', kind: 'color' },
      { key: 'iconSize', label: 'Icon Size', kind: 'text', placeholder: 'small / medium / large' },
      { key: 'screenAlwaysOn', label: 'Screen Always On', kind: 'tristate' },
      { key: 'manageScreenTimeout', label: 'Manage Screen Timeout', kind: 'tristate' },
      { key: 'screenTimeoutSeconds', label: 'Screen Timeout (seconds)', kind: 'number', placeholder: '60' },
    ],
  },
  security: {
    title: 'Bulk Security & Controls',
    subtitle: 'Push kiosk, locks and admin access to many devices',
    icon: Lock,
    fields: [
      { key: 'enableKioskMode', label: 'Enable Kiosk Mode', kind: 'tristate' },
      { key: 'kioskModePackageId', label: 'Kiosk Package ID', kind: 'text', placeholder: 'com.example.app' },
      { key: 'enableScreenLock', label: 'Enable Screen Lock', kind: 'tristate' },
      { key: 'blockExternalStorage', label: 'Block External Storage', kind: 'tristate' },
      { key: 'isDefaultLauncher', label: 'Is Default Launcher', kind: 'tristate' },
      { key: 'isDeviceAdminCodeEnabled', label: 'Device Admin Code Enabled', kind: 'tristate' },
      { key: 'deviceAdminCode', label: 'Device Admin Code', kind: 'text' },
      { key: 'allowToAccessSensitiveSettings', label: 'Allow Sensitive Settings', kind: 'tristate' },
      { key: 'strictAirplaneMode', label: 'Block Airplane Mode (strict)', kind: 'tristate' },
      { key: 'appsControlLock', label: 'Block App Tampering (apps control)', kind: 'tristate' },
    ],
  },
  notifications: {
    title: 'Bulk Notifications, Location & Volume',
    subtitle: 'Push notification, tracking, orientation, volume and permission settings',
    icon: Bell,
    fields: [
      { key: 'notificationBarStateId', label: 'Notification Bar State', kind: 'enum', enumSource: 'feature' },
      { key: 'enableNotifications', label: 'Enable Notifications', kind: 'tristate' },
      { key: 'hideSystemNotificationBarInLauncher', label: 'Hide System Notification Bar', kind: 'tristate' },
      { key: 'showLauncherOwnNotificationBar', label: 'Show Launcher Notification Bar', kind: 'tristate' },
      { key: 'locationTrackingByTypeId', label: 'Location Tracking', kind: 'enum', enumSource: 'location' },
      { key: 'lockSystemOrientation', label: 'Lock System Orientation', kind: 'tristate' },
      { key: 'lockLauncherOrientation', label: 'Lock Launcher Orientation', kind: 'tristate' },
      { key: 'lockVolume', label: 'Lock Volume', kind: 'tristate' },
      { key: 'volumePercentage', label: 'Volume Level (%)', kind: 'number', placeholder: '0–100' },
      { key: 'applicationPermissionGranterTypeId', label: 'Permission Granter', kind: 'enum', enumSource: 'permission' },
    ],
  },
};

const inputCls = 'h-9 w-56 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary';

/**
 * Bulk-assign one configuration section to many devices. Every control defaults to "No change" —
 * only fields the admin explicitly sets are sent, so a bulk apply never clobbers untouched settings
 * (the backend applies only non-null fields).
 */
export function BulkConfigModal({ section, devices, onClose }: { section: BulkConfigSection; devices: Device[]; onClose: () => void }) {
  const meta = SECTIONS[section];
  const applyMutation = useApplyDevicePolicy();
  const [values, setValues] = useState<Record<string, string>>({});

  const { data: featureStates = [] } = useFeatureStates();
  const { data: locationTrackingTypes = [] } = useLocationTrackingTypes();
  const { data: pushNotificationProtocols = [] } = usePushNotificationProtocols();
  const { data: permissionGranters = [] } = useApplicationPermissionGranters();

  const enumOptions = (src?: EnumSource) => {
    switch (src) {
      case 'feature': return featureStates;
      case 'location': return locationTrackingTypes;
      case 'push': return pushNotificationProtocols;
      case 'permission': return permissionGranters;
      default: return [];
    }
  };

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const buildPayload = (): Partial<ApplyDevicePolicyRequest> => {
    const out: Record<string, any> = {};
    for (const f of meta.fields) {
      const raw = values[f.key as string];
      if (raw === undefined || raw === '') continue; // "no change"
      if (f.kind === 'tristate') out[f.key] = raw === 'true';
      else if (f.kind === 'enum' || f.kind === 'number') out[f.key] = Number(raw);
      else out[f.key] = raw; // text | color
    }
    return out as Partial<ApplyDevicePolicyRequest>;
  };

  const chosenCount = meta.fields.filter((f) => {
    const v = values[f.key as string];
    return v !== undefined && v !== '';
  }).length;

  const handleApply = async ({ target }: BulkApplyContext) => {
    try {
      const results = await applyMutation.mutateAsync({ target, ...buildPayload() });
      const ok = results.filter((r) => r.success).length;
      const failed = results.length - ok;
      toast({
        variant: failed === 0 ? 'success' : 'destructive',
        title: 'Configuration applied',
        description: `${ok} device(s) updated${failed ? `, ${failed} failed` : ''}.`,
      });
      if (failed === 0) onClose();
    } catch {
      /* error toast handled by the mutation */
    }
  };

  return (
    <BulkPolicyScaffold
      title={meta.title}
      subtitle={meta.subtitle}
      icon={meta.icon}
      devices={devices}
      isPending={applyMutation.isPending}
      canApply={chosenCount > 0}
      applyVerb="Apply"
      onApply={handleApply}
      onClose={onClose}
    >
      <div>
        <p className="mb-3 text-xs text-gray-500">
          Only fields you change below are pushed. Anything left on <span className="font-medium">“No change”</span> is untouched.
        </p>
        {meta.fields.map((f) => (
          <div key={f.key as string} className="flex items-center justify-between gap-4 border-b border-gray-100 py-2.5 last:border-0">
            <span className="text-sm font-medium text-gray-600">{f.label}</span>
            {f.kind === 'enum' && (
              <select className={inputCls} value={values[f.key as string] ?? ''} onChange={(e) => set(f.key as string, e.target.value)}>
                <option value="">— No change —</option>
                {enumOptions(f.enumSource).map((o) => (
                  <option key={o.id} value={o.id.toString()}>{o.title}</option>
                ))}
              </select>
            )}
            {f.kind === 'tristate' && (
              <select className={inputCls} value={values[f.key as string] ?? ''} onChange={(e) => set(f.key as string, e.target.value)}>
                <option value="">— No change —</option>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            )}
            {f.kind === 'text' && (
              <input type="text" className={inputCls} placeholder={f.placeholder || 'No change'} value={values[f.key as string] ?? ''} onChange={(e) => set(f.key as string, e.target.value)} />
            )}
            {f.kind === 'number' && (
              <input type="number" className={inputCls} placeholder={f.placeholder || 'No change'} value={values[f.key as string] ?? ''} onChange={(e) => set(f.key as string, e.target.value)} />
            )}
            {f.kind === 'color' && (
              <div className="flex items-center gap-2">
                <input type="color" className="h-9 w-9 rounded-md border border-gray-300 cursor-pointer" value={values[f.key as string] || '#ffffff'} onChange={(e) => set(f.key as string, e.target.value)} />
                <input type="text" className="h-9 w-28 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="No change" value={values[f.key as string] ?? ''} onChange={(e) => set(f.key as string, e.target.value)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </BulkPolicyScaffold>
  );
}
