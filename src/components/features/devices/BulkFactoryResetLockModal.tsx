import { useState } from 'react';
import { ShieldOff } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useApplyDevicePolicy } from '@/hooks/useDevices';
import { toast } from '@/hooks/useToast';
import { BulkPolicyScaffold } from './BulkPolicyScaffold';

/**
 * Bulk "Factory Reset Lock" — dedicated bulk operation that enforces ONLY the
 * factoryResetLock setting on the selected devices (never mixed with other
 * bulk configuration fields). Backend null-guards every other policy field,
 * so nothing else on the device configuration is touched.
 */
export function BulkFactoryResetLockModal({ devices, onClose }: { devices: Device[]; onClose: () => void }) {
  const applyMutation = useApplyDevicePolicy();
  // Default to locked — matches the backend/device default under Device Owner.
  const [locked, setLocked] = useState(true);

  const handleApply = async (deviceUuids: string[]) => {
    try {
      const results = await applyMutation.mutateAsync({ deviceUuids, factoryResetLock: locked });
      const ok = results.filter((r) => r.success).length;
      const failed = results.length - ok;
      toast({
        variant: failed === 0 ? 'success' : 'destructive',
        title: locked ? 'Factory reset locked' : 'Factory reset unlocked',
        description: `${ok} succeeded${failed ? `, ${failed} failed` : ''}.`,
      });
      if (failed === 0) onClose();
    } catch {
      /* error toast handled by the mutation */
    }
  };

  return (
    <BulkPolicyScaffold
      title="Bulk Factory Reset Lock"
      subtitle="Block or allow factory reset from the device Settings menu (Device Owner)"
      icon={ShieldOff}
      devices={devices}
      isPending={applyMutation.isPending}
      onApply={handleApply}
      onClose={onClose}
    >
      <div className="space-y-2">
        <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
          <input
            type="radio"
            name="factoryResetLock"
            className="mt-1"
            checked={locked}
            onChange={() => setLocked(true)}
          />
          <span>
            <span className="block text-sm font-medium">Lock factory reset (recommended)</span>
            <span className="block text-xs text-muted-foreground">
              Users cannot perform a factory reset from the Settings menu. This is the default for every new device.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
          <input
            type="radio"
            name="factoryResetLock"
            className="mt-1"
            checked={!locked}
            onChange={() => setLocked(false)}
          />
          <span>
            <span className="block text-sm font-medium">Unlock factory reset</span>
            <span className="block text-xs text-muted-foreground">
              Users are allowed to factory reset the device from the Settings menu.
            </span>
          </span>
        </label>
      </div>
    </BulkPolicyScaffold>
  );
}
