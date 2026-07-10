import { useState } from 'react';
import { ArrowUpCircle } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useApplyDevicePolicy } from '@/hooks/useDevices';
import { toast } from '@/hooks/useToast';
import { BulkPolicyScaffold } from './BulkPolicyScaffold';
import { OsUpgradeSection, defaultDevicePolicy, osUpgradeToPayload, type DevicePolicyState } from './DevicePolicyForm';

/** Bulk "OS Upgrade Policy" — apply the same system-update policy to many devices. */
export function BulkOsUpgradeModal({ devices, onClose }: { devices: Device[]; onClose: () => void }) {
  const applyMutation = useApplyDevicePolicy();
  const [policy, setPolicy] = useState<DevicePolicyState>(defaultDevicePolicy);

  const handleApply = async (deviceUuids: string[]) => {
    try {
      const results = await applyMutation.mutateAsync({ deviceUuids, ...osUpgradeToPayload(policy) });
      const ok = results.filter((r) => r.success).length;
      const failed = results.length - ok;
      toast({
        variant: failed === 0 ? 'success' : 'destructive',
        title: 'OS upgrade policy applied',
        description: `${ok} succeeded${failed ? `, ${failed} failed` : ''}.`,
      });
      if (failed === 0) onClose();
    } catch {
      /* error toast handled by the mutation */
    }
  };

  return (
    <BulkPolicyScaffold
      title="Bulk OS Upgrade Policy"
      subtitle="Apply the same system-update policy to multiple devices at once"
      icon={ArrowUpCircle}
      devices={devices}
      isPending={applyMutation.isPending}
      onApply={handleApply}
      onClose={onClose}
    >
      <OsUpgradeSection value={policy} onChange={setPolicy} hideHeading />
    </BulkPolicyScaffold>
  );
}
