import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useApplyDevicePolicy } from '@/hooks/useDevices';
import { toast } from '@/hooks/useToast';
import { BulkPolicyScaffold } from './BulkPolicyScaffold';
import { RootPolicySection, defaultDevicePolicy, rootPolicyToPayload, type DevicePolicyState } from './DevicePolicyForm';

/** Bulk "Root / Compromise Detection" — apply the same detection policy to many devices. */
export function BulkRootPolicyModal({ devices, onClose }: { devices: Device[]; onClose: () => void }) {
  const applyMutation = useApplyDevicePolicy();
  const [policy, setPolicy] = useState<DevicePolicyState>(defaultDevicePolicy);

  const handleApply = async (deviceUuids: string[]) => {
    try {
      const results = await applyMutation.mutateAsync({ deviceUuids, ...rootPolicyToPayload(policy) });
      const ok = results.filter((r) => r.success).length;
      const failed = results.length - ok;
      toast({
        variant: failed === 0 ? 'success' : 'destructive',
        title: 'Root / compromise policy applied',
        description: `${ok} succeeded${failed ? `, ${failed} failed` : ''}.`,
      });
      if (failed === 0) onClose();
    } catch {
      /* error toast handled by the mutation */
    }
  };

  return (
    <BulkPolicyScaffold
      title="Bulk Root / Compromise Detection"
      subtitle="Apply the same detection policy to multiple devices at once"
      icon={ShieldAlert}
      devices={devices}
      isPending={applyMutation.isPending}
      onApply={handleApply}
      onClose={onClose}
    >
      <RootPolicySection value={policy} onChange={setPolicy} hideHeading />
    </BulkPolicyScaffold>
  );
}
