import { useState } from 'react';
import { Activity } from 'lucide-react';
import type { Device } from '@/types/device.types';
import {
  trackingService,
  HEARTBEAT_MIN_SECONDS,
  HEARTBEAT_MAX_SECONDS,
} from '@/api/services/tracking.service';
import { toast } from '@/hooks/useToast';
import { BulkPolicyScaffold, type BulkApplyContext } from './BulkPolicyScaffold';

/** Quick presets for the most common heartbeat cadences. */
const PRESETS = [
  { label: '1 min', seconds: 60 },
  { label: '5 min', seconds: 300 },
  { label: '15 min', seconds: 900 },
  { label: '30 min', seconds: 1800 },
];

/** Renders a seconds value as a human-friendly cadence. */
function describe(seconds: number): string {
  if (seconds < 60) return `every ${seconds} seconds`;
  const mins = seconds / 60;
  if (mins < 60) return `every ${Number.isInteger(mins) ? mins : mins.toFixed(1)} minutes`;
  const hours = mins / 60;
  return `every ${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours`;
}

/**
 * Bulk "Heartbeat Timer" — set how often the agent pings in over MQTT, for many devices at once.
 *
 * The backend persists per device and pushes the new value on the device's
 * `trackingConfigUpdate` topic, so live devices pick it up without waiting for a config poll.
 */
export function BulkHeartbeatModal({
  devices,
  onClose,
  lockedDeviceUuids,
  initialSeconds,
}: {
  devices: Device[];
  onClose: () => void;
  /** "Apply to more devices…" from a device page: that device is pre-selected and locked. */
  lockedDeviceUuids?: string[];
  /** Heartbeat pre-filled from the current device. */
  initialSeconds?: number;
}) {
  const [seconds, setSeconds] = useState<number>(
    initialSeconds && Number.isFinite(initialSeconds) ? Math.round(initialSeconds) : 300
  );
  const [isPending, setIsPending] = useState(false);

  const outOfRange = seconds < HEARTBEAT_MIN_SECONDS || seconds > HEARTBEAT_MAX_SECONDS;
  const isValid = Number.isFinite(seconds) && !outOfRange;

  const handleApply = async ({ target }: BulkApplyContext) => {
    if (!isValid) return;
    setIsPending(true);
    try {
      const results = await trackingService.bulkUpdateConfig({ target, heartbeatTimer: seconds });
      const ok = results.filter((r) => r.success).length;
      const failed = results.length - ok;
      toast({
        variant: failed === 0 ? 'success' : 'destructive',
        title: 'Heartbeat timer applied',
        description: `${ok} succeeded${failed ? `, ${failed} failed` : ''}.`,
      });
      if (failed === 0) onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Heartbeat update failed',
        description: error?.response?.data?.message || error?.message || 'Unable to apply heartbeat timer.',
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <BulkPolicyScaffold
      title="Bulk Heartbeat Timer"
      subtitle="Set how often devices report they are alive, for multiple devices at once"
      icon={Activity}
      devices={devices}
      isPending={isPending}
      canApply={isValid}
      onApply={handleApply}
      onClose={onClose}
      lockedDeviceUuids={lockedDeviceUuids}
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Heartbeat interval</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The agent publishes a presence ping on this cadence. Shorter means fresher online status,
            but more battery and network use.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.seconds}
              type="button"
              onClick={() => setSeconds(p.seconds)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                seconds === p.seconds
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="heartbeat-seconds" className="mb-1 block text-xs font-medium text-gray-700">
            Interval (seconds)
          </label>
          <input
            id="heartbeat-seconds"
            type="number"
            min={HEARTBEAT_MIN_SECONDS}
            max={HEARTBEAT_MAX_SECONDS}
            step={1}
            value={Number.isFinite(seconds) ? seconds : ''}
            onChange={(e) => setSeconds(parseInt(e.target.value, 10))}
            className={`w-full rounded-md border bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${
              outOfRange
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-primary'
            }`}
          />
          {outOfRange ? (
            <p className="mt-1 text-xs font-medium text-red-600">
              Must be between {HEARTBEAT_MIN_SECONDS} and {HEARTBEAT_MAX_SECONDS} seconds.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Devices will check in {describe(seconds)}.
            </p>
          )}
        </div>

        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Applied over MQTT — devices that are online pick this up immediately; offline devices
          apply it on their next config sync.
        </p>
      </div>
    </BulkPolicyScaffold>
  );
}
