import type { ApplyDevicePolicyRequest, SystemUpdatePolicyType } from '@/types/device.types';

/** Editable end-state of the device policy form (root-detection + OS-upgrade). */
export interface DevicePolicyState {
  rootDetectionEnabled: boolean;
  rootDetectionLockOnCompromise: boolean;
  rootDetectionWipeOnCompromise: boolean;
  rootDetectionMinSeverityForAction: string;
  rootDetectionScanIntervalMinutes: number | '';
  /** '' means Unmanaged (clears any system update policy). */
  systemUpdatePolicyType: '' | SystemUpdatePolicyType;
  maintenanceWindowStart: number | '';
  maintenanceWindowEnd: number | '';
  freezePeriodStart: string;
  freezePeriodEnd: string;
}

export const defaultDevicePolicy: DevicePolicyState = {
  rootDetectionEnabled: true,
  rootDetectionLockOnCompromise: true,
  rootDetectionWipeOnCompromise: false,
  rootDetectionMinSeverityForAction: 'CRITICAL',
  rootDetectionScanIntervalMinutes: 15,
  systemUpdatePolicyType: '',
  maintenanceWindowStart: '',
  maintenanceWindowEnd: '',
  freezePeriodStart: '',
  freezePeriodEnd: '',
};

/** Convert the form state into the API payload (minus deviceUuids). */
export function policyToPayload(p: DevicePolicyState): Omit<ApplyDevicePolicyRequest, 'deviceUuids'> {
  const unmanaged = p.systemUpdatePolicyType === '';
  return {
    rootDetectionEnabled: p.rootDetectionEnabled,
    rootDetectionLockOnCompromise: p.rootDetectionLockOnCompromise,
    rootDetectionWipeOnCompromise: p.rootDetectionWipeOnCompromise,
    rootDetectionMinSeverityForAction: p.rootDetectionMinSeverityForAction,
    rootDetectionScanIntervalMinutes:
      p.rootDetectionScanIntervalMinutes === '' ? null : Number(p.rootDetectionScanIntervalMinutes),
    systemUpdatePolicyType: unmanaged ? null : p.systemUpdatePolicyType,
    maintenanceWindowStart: p.maintenanceWindowStart === '' ? null : Number(p.maintenanceWindowStart),
    maintenanceWindowEnd: p.maintenanceWindowEnd === '' ? null : Number(p.maintenanceWindowEnd),
    freezePeriodStart: p.freezePeriodStart || null,
    freezePeriodEnd: p.freezePeriodEnd || null,
    clearSystemUpdatePolicy: unmanaged,
  };
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-sm text-gray-700">{label}</p>
        {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );
}

/** Shared controlled policy form used by both the per-device and bulk modals. */
export function DevicePolicyForm({
  value,
  onChange,
}: {
  value: DevicePolicyState;
  onChange: (next: DevicePolicyState) => void;
}) {
  const set = <K extends keyof DevicePolicyState>(key: K, v: DevicePolicyState[K]) =>
    onChange({ ...value, [key]: v });

  const inputCls =
    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <div className="space-y-6">
      {/* Root / compromise detection */}
      <section className="space-y-1">
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-2">
          Root / Compromise Detection
        </h3>
        <Toggle
          label="Enable root / compromise detection"
          checked={value.rootDetectionEnabled}
          onChange={(v) => set('rootDetectionEnabled', v)}
        />
        <Toggle
          label="Lock device on compromise"
          hint="Lock/kiosk when severity ≥ action threshold"
          checked={value.rootDetectionLockOnCompromise}
          onChange={(v) => set('rootDetectionLockOnCompromise', v)}
        />
        <Toggle
          label="Wipe device on CRITICAL compromise"
          hint="Destructive — off by default"
          checked={value.rootDetectionWipeOnCompromise}
          onChange={(v) => set('rootDetectionWipeOnCompromise', v)}
        />
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <label className={labelCls}>Min severity for action</label>
            <select
              value={value.rootDetectionMinSeverityForAction}
              onChange={(e) => set('rootDetectionMinSeverityForAction', e.target.value)}
              className={inputCls}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Scan interval (minutes)</label>
            <input
              type="number"
              min={15}
              value={value.rootDetectionScanIntervalMinutes}
              onChange={(e) =>
                set('rootDetectionScanIntervalMinutes', e.target.value === '' ? '' : parseInt(e.target.value))
              }
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* OS upgrade policy */}
      <section className="space-y-1">
        <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-2">
          OS Upgrade Policy
        </h3>
        <div>
          <label className={labelCls}>System update policy</label>
          <select
            value={value.systemUpdatePolicyType}
            onChange={(e) => set('systemUpdatePolicyType', e.target.value as DevicePolicyState['systemUpdatePolicyType'])}
            className={inputCls}
          >
            <option value="">Unmanaged (user-controlled)</option>
            <option value="AUTOMATIC">Automatic</option>
            <option value="WINDOWED">Windowed (daily maintenance window)</option>
            <option value="POSTPONED">Postponed</option>
            <option value="FREEZE">Freeze (auto outside freeze window)</option>
          </select>
        </div>

        {value.systemUpdatePolicyType === 'WINDOWED' && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className={labelCls}>Window start (min from midnight)</label>
              <input
                type="number"
                min={0}
                max={1439}
                value={value.maintenanceWindowStart}
                onChange={(e) =>
                  set('maintenanceWindowStart', e.target.value === '' ? '' : parseInt(e.target.value))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Window end (min from midnight)</label>
              <input
                type="number"
                min={0}
                max={1439}
                value={value.maintenanceWindowEnd}
                onChange={(e) =>
                  set('maintenanceWindowEnd', e.target.value === '' ? '' : parseInt(e.target.value))
                }
                className={inputCls}
              />
            </div>
          </div>
        )}

        {value.systemUpdatePolicyType === 'FREEZE' && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className={labelCls}>Freeze start</label>
              <input
                type="date"
                value={value.freezePeriodStart}
                onChange={(e) => set('freezePeriodStart', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Freeze end</label>
              <input
                type="date"
                value={value.freezePeriodEnd}
                onChange={(e) => set('freezePeriodEnd', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
