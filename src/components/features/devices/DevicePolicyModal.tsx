import { useEffect, useState } from 'react';
import { ShieldAlert, X, Loader2 } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useDeviceConfiguration, useApplyDevicePolicy } from '@/hooks/useDevices';
import { toast } from '@/hooks/useToast';
import {
  DevicePolicyForm,
  defaultDevicePolicy,
  policyToPayload,
  type DevicePolicyState,
} from './DevicePolicyForm';

/** Per-device "Update & Security Policy" editor, prefilled from the device's config. */
export function DevicePolicyModal({ device, onClose }: { device: Device; onClose: () => void }) {
  const { data: config, isLoading } = useDeviceConfiguration(device.id);
  const applyMutation = useApplyDevicePolicy();
  const [policy, setPolicy] = useState<DevicePolicyState>(defaultDevicePolicy);

  useEffect(() => {
    if (!config) return;
    setPolicy({
      rootDetectionEnabled: config.rootDetectionEnabled ?? true,
      rootDetectionLockOnCompromise: config.rootDetectionLockOnCompromise ?? true,
      rootDetectionWipeOnCompromise: config.rootDetectionWipeOnCompromise ?? false,
      rootDetectionMinSeverityForAction: config.rootDetectionMinSeverityForAction ?? 'CRITICAL',
      rootDetectionScanIntervalMinutes: config.rootDetectionScanIntervalMinutes ?? 15,
      systemUpdatePolicyType: config.systemUpdatePolicyType ?? '',
      maintenanceWindowStart: config.maintenanceWindowStart ?? '',
      maintenanceWindowEnd: config.maintenanceWindowEnd ?? '',
      freezePeriodStart: config.freezePeriodStart ?? '',
      freezePeriodEnd: config.freezePeriodEnd ?? '',
      vpnEnabled: config.vpnEnabled ?? false,
      vpnServerAddress: config.vpnServerAddress ?? '',
      vpnUsername: config.vpnUsername ?? '',
      vpnSecret: config.vpnSecret ?? '',
      vpnProtocolTypeId: config.vpnProtocolTypeId ?? '',
      vpnRoutingRules: (config.vpnRoutingRules ?? []).join(', '),
    });
  }, [config]);

  const handleApply = async () => {
    try {
      const results = await applyMutation.mutateAsync({
        deviceUuids: [device.deviceUuid],
        ...policyToPayload(policy),
      });
      const ok = results.every((r) => r.success);
      toast({
        variant: ok ? 'success' : 'destructive',
        title: ok ? 'Policy applied' : 'Policy partially applied',
        description: ok
          ? `Update & security policy pushed to ${device.deviceName || 'device'}.`
          : results.find((r) => !r.success)?.message || 'Some devices failed.',
      });
      if (ok) onClose();
    } catch {
      /* error toast handled by the mutation */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-blue-50 p-2">
              <ShieldAlert className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Update &amp; Security Policy</h2>
              <p className="text-xs text-muted-foreground">{device.deviceName || device.deviceUuid}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <DevicePolicyForm value={policy} onChange={setPolicy} />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={applyMutation.isPending || isLoading}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {applyMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Apply &amp; Push
          </button>
        </div>
      </div>
    </div>
  );
}
