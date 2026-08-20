import { useState } from 'react';
import { Clock, CheckSquare, Square } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { timeRangeService } from '@/api/services/timerange.service';
import { toast } from '@/hooks/useToast';
import { BulkPolicyScaffold, type BulkApplyContext } from './BulkPolicyScaffold';

const TIMEZONES = [
  'device',
  'UTC',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dubai',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Australia/Sydney',
];

export interface TimeRangePreset {
  startTime: string;
  endTime: string;
  timezone?: string;
  enabled?: boolean;
}

/**
 * Bulk "Usage Time Range" — lock devices outside an allowed daily window, for groups and/or devices.
 * Replaces the former inline modal in DeviceManagement; target selection comes from the scaffold.
 */
export function BulkTimeRangeModal({
  devices,
  onClose,
  lockedDeviceUuids,
  preset,
}: {
  devices: Device[];
  onClose: () => void;
  /** "Apply to more devices…" from a device page: that device is pre-selected and locked. */
  lockedDeviceUuids?: string[];
  /** Values pre-filled from the current device's time range. */
  preset?: TimeRangePreset;
}) {
  const [startTime, setStartTime] = useState(preset?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(preset?.endTime ?? '17:00');
  const [timezone, setTimezone] = useState(preset?.timezone ?? 'device');
  const [enabled, setEnabled] = useState(preset?.enabled ?? true);
  const [isPending, setIsPending] = useState(false);

  const isValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(endTime);

  const handleApply = async ({ target, effectiveCount }: BulkApplyContext) => {
    if (!isValid) return;
    setIsPending(true);
    try {
      const results = await timeRangeService.bulkAssign({ target, startTime, endTime, timezone, enabled });
      const ok = results.length;
      const failed = Math.max(effectiveCount - ok, 0);
      toast({
        variant: failed === 0 ? 'success' : 'destructive',
        title: 'Time range applied',
        description: `${ok} device${ok === 1 ? '' : 's'} updated${failed ? `, ${failed} not applied` : ''}.`,
      });
      if (failed === 0) onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Time range failed',
        description: error?.response?.data?.message || error?.message || 'Unable to apply the time range.',
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <BulkPolicyScaffold
      title="Bulk Usage Time Range"
      subtitle="Set the allowed usage window for groups or devices"
      icon={Clock}
      devices={devices}
      isPending={isPending}
      canApply={isValid}
      onApply={handleApply}
      onClose={onClose}
      lockedDeviceUuids={lockedDeviceUuids}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Start Time (allowed from)</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">End Time (lock after)</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {startTime > endTime && (
          <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Midnight-crossing range: unlocks at {startTime}, locks at {endTime} next day.
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz === 'device' ? 'Device local timezone' : tz}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              enabled
                ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                : 'border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {enabled ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
          <p className="text-xs text-muted-foreground">
            {enabled ? 'Policy is enforced immediately on every targeted device.' : 'Config is saved but not enforced.'}
          </p>
        </div>
      </div>
    </BulkPolicyScaffold>
  );
}
