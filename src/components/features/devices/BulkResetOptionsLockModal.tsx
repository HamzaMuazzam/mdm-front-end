import { useState } from 'react';
import { ShieldOff } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useApplyDevicePolicy } from '@/hooks/useDevices';
import { toast } from '@/hooks/useToast';
import { BulkPolicyScaffold } from './BulkPolicyScaffold';

type LockChoice = 'nochange' | 'lock' | 'unlock';

const toBool = (c: LockChoice): boolean | undefined =>
  c === 'nochange' ? undefined : c === 'lock';

function LockChoiceRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: LockChoice;
  onChange: (v: LockChoice) => void;
}) {
  const options: { key: LockChoice; text: string }[] = [
    { key: 'nochange', text: 'No change' },
    { key: 'lock', text: 'Lock' },
    { key: 'unlock', text: 'Unlock' },
  ];
  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground mb-2">{description}</p>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              value === o.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted/50'
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Bulk "Reset Options Lock" — dedicated bulk operation for the Settings "Reset options"
 * restrictions ONLY (never mixed with other bulk configuration fields). Each control is
 * independent; "No change" fields are omitted from the payload and the backend
 * null-guards them, so untouched settings are preserved.
 */
export function BulkResetOptionsLockModal({ devices, onClose }: { devices: Device[]; onClose: () => void }) {
  const applyMutation = useApplyDevicePolicy();
  const [factoryReset, setFactoryReset] = useState<LockChoice>('nochange');
  const [networkReset, setNetworkReset] = useState<LockChoice>('nochange');

  const hasSelection = factoryReset !== 'nochange' || networkReset !== 'nochange';

  const handleApply = async (deviceUuids: string[]) => {
    if (!hasSelection) return;
    try {
      const results = await applyMutation.mutateAsync({
        deviceUuids,
        ...(toBool(factoryReset) !== undefined ? { factoryResetLock: toBool(factoryReset) } : {}),
        ...(toBool(networkReset) !== undefined ? { networkResetLock: toBool(networkReset) } : {}),
      });
      const ok = results.filter((r) => r.success).length;
      const failed = results.length - ok;
      toast({
        variant: failed === 0 ? 'success' : 'destructive',
        title: 'Reset options lock applied',
        description: `${ok} succeeded${failed ? `, ${failed} failed` : ''}.`,
      });
      if (failed === 0) onClose();
    } catch {
      /* error toast handled by the mutation */
    }
  };

  return (
    <BulkPolicyScaffold
      title="Bulk Reset Options Lock"
      subtitle="Block or allow the Settings reset options (Device Owner). Only the fields you set are applied."
      icon={ShieldOff}
      devices={devices}
      isPending={applyMutation.isPending}
      canApply={hasSelection}
      onApply={handleApply}
      onClose={onClose}
    >
      <div className="space-y-2">
        <LockChoiceRow
          label="Factory Reset"
          description="Erase all data (factory reset) from the Settings menu. Locked by default on every new device."
          value={factoryReset}
          onChange={setFactoryReset}
        />
        <LockChoiceRow
          label="Network Reset (Wi-Fi, mobile & Bluetooth)"
          description="Reset Wi-Fi, mobile & Bluetooth settings from the Settings menu. Locked by default on every new device."
          value={networkReset}
          onChange={setNetworkReset}
        />
      </div>
    </BulkPolicyScaffold>
  );
}
