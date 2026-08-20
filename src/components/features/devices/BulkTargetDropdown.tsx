import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { useDeviceGroupsQuery } from '@/hooks/useDeviceGroups';
import {
  BulkTargetPicker,
  describeSelection,
  effectiveDeviceUuids,
  isSelectionEmpty,
  type BulkTargetSelection,
} from './BulkTargetPicker';

/**
 * Form-field flavour of the target picker: a dropdown trigger that summarises the selection
 * ("Sales (300) + 3 devices · 303 devices") and opens the Groups / Devices picker in a popover.
 * Used where a bulk target sits inside a larger form (App Management install/uninstall).
 */
export function BulkTargetDropdown({
  devices,
  value,
  onChange,
  placeholder = 'Select groups or devices…',
  disabled = false,
}: {
  devices: Device[];
  value: BulkTargetSelection;
  onChange: (next: BulkTargetSelection) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: groups = [], isLoading } = useDeviceGroupsQuery();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeDevices = useMemo(() => devices.filter((d) => !d.deletedAt), [devices]);
  const effectiveCount = useMemo(
    () => effectiveDeviceUuids(value, groups, activeDevices).size,
    [value, groups, activeDevices]
  );
  const empty = isSelectionEmpty(value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      >
        <span className={`flex min-w-0 items-center gap-2 ${empty ? 'text-muted-foreground' : 'text-foreground'}`}>
          <Layers className="h-3.5 w-3.5 shrink-0 text-blue-600" />
          <span className="truncate">
            {empty ? placeholder : `${describeSelection(value, groups)} · ${effectiveCount} device${effectiveCount === 1 ? '' : 's'}`}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 flex h-[26rem] w-full min-w-[20rem] flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <BulkTargetPicker
            devices={activeDevices}
            groups={groups}
            groupsLoading={isLoading}
            value={value}
            onChange={onChange}
            compact
          />
          <div className="flex shrink-0 justify-end border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
