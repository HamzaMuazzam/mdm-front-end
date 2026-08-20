import { useMemo, useState, type ReactNode, type ComponentType } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Device } from '@/types/device.types';
import type { BulkTarget } from '@/types/bulk.types';
import { useDeviceGroupsQuery } from '@/hooks/useDeviceGroups';
import {
  BulkTargetPicker,
  emptySelection,
  selectionFromDevices,
  selectionToTarget,
  effectiveDeviceUuids,
  isSelectionEmpty,
  describeSelection,
  type BulkTargetSelection,
} from './BulkTargetPicker';

/** What a module receives when the admin clicks Apply. */
export interface BulkApplyContext {
  /** Backend contract: groups + devices + all. */
  target: BulkTarget;
  /** Client-side preview of how many devices the target expands to. */
  effectiveCount: number;
  /** Human-readable selection, e.g. "Sales (300) + 3 devices". */
  description: string;
}

/**
 * Reusable shell for a per-module bulk-assignment modal: the group / device target picker on the
 * left, the module's own form (passed as children) on the right, and a shared apply footer.
 * Each concrete modal supplies its title/icon/form and an onApply that receives the target.
 */
export function BulkPolicyScaffold({
  title,
  subtitle,
  icon: Icon,
  devices,
  isPending,
  applyVerb = 'Apply',
  canApply = true,
  onApply,
  onClose,
  children,
  lockedDeviceUuids,
  initialDeviceUuids,
  maxWidthClass = 'max-w-4xl',
}: {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  devices: Device[];
  isPending: boolean;
  applyVerb?: string;
  /** Extra gate on top of "at least one device selected". */
  canApply?: boolean;
  onApply: (ctx: BulkApplyContext) => void;
  onClose: () => void;
  children: ReactNode;
  /** Pre-selected devices that cannot be unselected (the "Apply to more devices…" flow). */
  lockedDeviceUuids?: string[];
  /** Pre-selected (but changeable) devices. */
  initialDeviceUuids?: string[];
  maxWidthClass?: string;
}) {
  const { data: groups = [], isLoading: groupsLoading } = useDeviceGroupsQuery();
  const [selection, setSelection] = useState<BulkTargetSelection>(() => {
    const preset = [...(lockedDeviceUuids || []), ...(initialDeviceUuids || [])];
    return preset.length ? selectionFromDevices(preset) : emptySelection();
  });

  const activeDevices = useMemo(() => devices.filter((d) => !d.deletedAt), [devices]);
  const effectiveCount = useMemo(
    () => effectiveDeviceUuids(selection, groups, activeDevices).size,
    [selection, groups, activeDevices]
  );

  const ready = !isSelectionEmpty(selection) && effectiveCount > 0 && canApply && !isPending;

  const handleApply = () => {
    if (!ready) return;
    onApply({
      target: selectionToTarget(selection, groups),
      effectiveCount,
      description: describeSelection(selection, groups),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 lg:items-center lg:p-4">
      <div
        className={`flex max-h-[92vh] w-full ${maxWidthClass} flex-col overflow-hidden rounded-t-2xl rounded-b-none bg-white shadow-xl animate-sheet-up pb-safe lg:animate-none lg:rounded-lg lg:pb-0`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-blue-50 p-2">
              <Icon className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
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

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
          {/* Target selection */}
          <div className="flex max-h-72 flex-col border-b border-border sm:max-h-none sm:w-[22rem] sm:border-b-0 sm:border-r">
            <BulkTargetPicker
              devices={activeDevices}
              groups={groups}
              groupsLoading={groupsLoading}
              value={selection}
              onChange={setSelection}
              lockedDeviceUuids={lockedDeviceUuids}
              initialTab={lockedDeviceUuids?.length ? 'devices' : 'groups'}
            />
          </div>

          {/* Module form */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-4">
          <p className="hidden min-w-0 truncate text-xs text-muted-foreground sm:block">
            {isSelectionEmpty(selection)
              ? 'Select one or more groups, or pick devices individually.'
              : `Target: ${describeSelection(selection, groups)}`}
          </p>
          <div className="flex items-center gap-2">
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
              disabled={!ready}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {applyVerb} to {effectiveCount} device{effectiveCount === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
