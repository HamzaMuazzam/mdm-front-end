import { useState } from 'react';
import { Lock, Plus, Trash2 } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useBulkAssignSslPinning } from '@/hooks/useSslPinning';
import type { SslPinEntryInput } from '@/api/services/sslPinning.service';
import { toast } from '@/hooks/useToast';
import { BulkPolicyScaffold, type BulkApplyContext } from './BulkPolicyScaffold';

/**
 * Bulk-assign a set of pinned certificates to groups and/or devices.
 * Target selection comes from the shared scaffold; this modal only owns the pin entries.
 */
export function BulkSslPinningModal({
  devices,
  onClose,
  lockedDeviceUuids,
  initialEntries,
}: {
  devices: Device[];
  onClose: () => void;
  /** "Apply to more devices…" from a device page: that device is pre-selected and locked. */
  lockedDeviceUuids?: string[];
  /** Pins pre-filled from the current device (per-device page). */
  initialEntries?: SslPinEntryInput[];
}) {
  const bulkMutation = useBulkAssignSslPinning();

  const [entries, setEntries] = useState<SslPinEntryInput[]>(initialEntries ?? []);
  const [domain, setDomain] = useState('');
  const [pin, setPin] = useState('');

  const addEntry = () => {
    if (!domain.trim() || !pin.trim()) return;
    setEntries((prev) => [...prev, { targetDomain: domain.trim(), pinValue: pin.trim(), isEnabled: true }]);
    setDomain('');
    setPin('');
  };

  const removeEntry = (idx: number) => setEntries((prev) => prev.filter((_, i) => i !== idx));

  const handleApply = async ({ target }: BulkApplyContext) => {
    if (entries.length === 0) return;
    try {
      const results = await bulkMutation.mutateAsync({ target, pins: entries });
      const ok = results.filter((r) => r.success).length;
      const failed = results.length - ok;
      const added = results.reduce((sum, r) => sum + (r.added || 0), 0);
      toast({
        variant: failed === 0 ? 'success' : 'destructive',
        title: 'Bulk SSL pinning applied',
        description: `${ok} device(s) updated, ${added} pin(s) added${failed ? `, ${failed} failed` : ''}.`,
      });
      if (failed === 0) onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk error',
        description: error?.response?.data?.message || 'Failed to apply SSL pinning.',
      });
    }
  };

  return (
    <BulkPolicyScaffold
      title="Bulk SSL Pinning"
      subtitle="Assign the same pinned certificates to groups or devices"
      icon={Lock}
      devices={devices}
      isPending={bulkMutation.isPending}
      canApply={entries.length > 0}
      applyVerb="Assign"
      onApply={handleApply}
      onClose={onClose}
      lockedDeviceUuids={lockedDeviceUuids}
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500">PINNED CERTIFICATES TO ASSIGN</p>
          <div className="grid grid-cols-1 gap-2">
            <input
              type="text"
              placeholder="api.bank.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="sha256/AAAA…="
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="h-9 flex-1 rounded-md border border-gray-300 bg-white px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={addEntry}
                disabled={!domain.trim() || !pin.trim()}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs text-gray-400">Add one or more domain + pin entries to assign.</p>
        ) : (
          <div className="space-y-1.5">
            {entries.map((e, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-800">{e.targetDomain}</p>
                  <p className="truncate font-mono text-[11px] text-gray-500">{e.pinValue}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeEntry(i)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Pins already present on a device are skipped; each device is re-published once.
        </p>
      </div>
    </BulkPolicyScaffold>
  );
}
