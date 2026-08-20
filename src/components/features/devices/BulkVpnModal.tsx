import { useState } from 'react';
import { Globe } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useApplyDevicePolicy } from '@/hooks/useDevices';
import { toast } from '@/hooks/useToast';
import { BulkPolicyScaffold, type BulkApplyContext } from './BulkPolicyScaffold';
import { VpnSection, defaultDevicePolicy, vpnToPayload, type DevicePolicyState } from './DevicePolicyForm';

/** Bulk "VPN" — apply the same managed-VPN configuration to many devices. */
export function BulkVpnModal({ devices, onClose }: { devices: Device[]; onClose: () => void }) {
  const applyMutation = useApplyDevicePolicy();
  const [policy, setPolicy] = useState<DevicePolicyState>(defaultDevicePolicy);

  // Guard: if VPN is being enabled, require a protocol + server address.
  const vpnValid = !policy.vpnEnabled || (policy.vpnProtocolTypeId !== '' && policy.vpnServerAddress.trim().length > 0);

  const handleApply = async ({ target }: BulkApplyContext) => {
    try {
      const results = await applyMutation.mutateAsync({ target, ...vpnToPayload(policy) });
      const ok = results.filter((r) => r.success).length;
      const failed = results.length - ok;
      toast({
        variant: failed === 0 ? 'success' : 'destructive',
        title: 'VPN policy applied',
        description: `${ok} succeeded${failed ? `, ${failed} failed` : ''}.`,
      });
      if (failed === 0) onClose();
    } catch {
      /* error toast handled by the mutation */
    }
  };

  return (
    <BulkPolicyScaffold
      title="Bulk VPN"
      subtitle="Apply the same managed-VPN configuration to multiple devices at once"
      icon={Globe}
      devices={devices}
      isPending={applyMutation.isPending}
      canApply={vpnValid}
      onApply={handleApply}
      onClose={onClose}
    >
      <VpnSection value={policy} onChange={setPolicy} hideHeading />
    </BulkPolicyScaffold>
  );
}
