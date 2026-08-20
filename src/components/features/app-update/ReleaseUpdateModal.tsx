import { useMemo, useState } from 'react';
import { Rocket, X, Loader2, Globe, Layers, AlertTriangle } from 'lucide-react';
import { appUpdateService } from '@/api/services/app-update.service';
import { useDevicesQuery } from '@/hooks/useDevices';
import { useDeviceGroupsQuery } from '@/hooks/useDeviceGroups';
import { toast } from '@/hooks/useToast';
import type { AppUpdate, ReleaseUpdateResult } from '@/types/app-update.types';
import {
  BulkTargetPicker,
  describeSelection,
  effectiveDeviceUuids,
  emptySelection,
  isSelectionEmpty,
  selectionToTarget,
  type BulkTargetSelection,
} from '@/components/features/devices/BulkTargetPicker';

type Scope = 'account' | 'platform';

/**
 * "Release to…" for the active agent update: pick groups/devices of your account (or, for the
 * platform administrator, every account). Targets are recorded against the release so the agents'
 * periodic update check honours them; the resolved devices are nudged immediately.
 */
export function ReleaseUpdateModal({
  update,
  onClose,
  onReleased,
}: {
  update: AppUpdate;
  onClose: () => void;
  onReleased: (result: ReleaseUpdateResult[]) => void;
}) {
  const { data: devices = [] } = useDevicesQuery();
  const { data: groups = [], isLoading: groupsLoading } = useDeviceGroupsQuery();
  const [scope, setScope] = useState<Scope>('account');
  const [selection, setSelection] = useState<BulkTargetSelection>(emptySelection());
  const [isPending, setIsPending] = useState(false);
  const [confirmPlatform, setConfirmPlatform] = useState(false);

  const activeDevices = useMemo(() => devices.filter((d) => !d.deletedAt), [devices]);
  const effectiveCount = useMemo(
    () => effectiveDeviceUuids(selection, groups, activeDevices).size,
    [selection, groups, activeDevices]
  );

  const ready = scope === 'platform' ? confirmPlatform && !isPending : !isSelectionEmpty(selection) && effectiveCount > 0 && !isPending;

  const submit = async () => {
    if (!ready) return;
    setIsPending(true);
    try {
      const res = await appUpdateService.release(
        scope === 'platform'
          ? { platform: update.platform, platformWide: true }
          : { platform: update.platform, target: selectionToTarget(selection, groups) }
      );
      const results = res.data || [];
      const r = results[0];
      toast({
        variant: 'success',
        title: `Version ${update.versionCode} released`,
        description: r
          ? `${r.targetDescription} — ${r.devicesNotified} device${r.devicesNotified === 1 ? '' : 's'} notified now${
              r.targetsAdded === 0 ? ' (targets were already in place)' : ''
            }${r.skippedNotVisible ? `, ${r.skippedNotVisible} outside your scope skipped` : ''}.`
          : 'Release recorded.',
      });
      onReleased(results);
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Release failed',
        description: error?.response?.data?.message || error?.message || 'Unable to release this update.',
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 lg:items-center lg:p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl animate-sheet-up pb-safe lg:animate-none lg:rounded-lg lg:pb-0">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-blue-50 p-2">
              <Rocket className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Release v{update.versionCode} ({update.platform})
              </h2>
              <p className="text-xs text-muted-foreground">
                Choose who may install this build. Devices outside the target never receive it — not even through their periodic update check.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
          {/* Scope */}
          <div className="flex shrink-0 flex-col gap-2 border-b border-border p-4 sm:w-64 sm:border-b-0 sm:border-r">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Release scope</p>
            <button
              type="button"
              onClick={() => setScope('account')}
              className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors ${
                scope === 'account' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Layers className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span>
                <span className="block text-sm font-medium text-foreground">My account</span>
                <span className="block text-xs text-muted-foreground">Selected groups and/or devices — e.g. a Pilot group first, then Sales, then All.</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setScope('platform')}
              className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors ${
                scope === 'platform' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <span className="block text-sm font-medium text-foreground">Platform-wide</span>
                <span className="block text-xs text-muted-foreground">Every device of every account. Platform administrator only.</span>
              </span>
            </button>

            {update.targetSummary && (
              <div className="mt-auto rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Currently:</span> {update.targetSummary}
                {typeof update.targetedDeviceCount === 'number' && update.targets && update.targets.length > 0 && (
                  <> · {update.targetedDeviceCount} of your devices</>
                )}
              </div>
            )}
          </div>

          {/* Target */}
          <div className="flex min-h-0 flex-1 flex-col">
            {scope === 'account' ? (
              <BulkTargetPicker
                devices={activeDevices}
                groups={groups}
                groupsLoading={groupsLoading}
                value={selection}
                onChange={setSelection}
              />
            ) : (
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">This reaches every account on the platform.</p>
                    <p className="text-xs">
                      Also publishes the legacy broadcast topic, so agents that have not been upgraded to the targeting-aware build yet still
                      receive it. Use this once after deploying the new agent, then release per account or group.
                    </p>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={confirmPlatform} onChange={(e) => setConfirmPlatform(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                  I understand — release v{update.versionCode} to all accounts
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-4">
          <p className="hidden min-w-0 truncate text-xs text-muted-foreground sm:block">
            {scope === 'platform'
              ? 'Target: every device on the platform'
              : isSelectionEmpty(selection)
                ? 'Select one or more groups, or pick devices individually.'
                : `Target: ${describeSelection(selection, groups)}`}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!ready}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                scope === 'platform' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              {scope === 'platform' ? 'Release platform-wide' : `Release to ${effectiveCount} device${effectiveCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
