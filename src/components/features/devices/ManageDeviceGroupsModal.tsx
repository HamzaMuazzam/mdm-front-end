import { useMemo, useState } from 'react';
import { Layers, X, Check, Loader2, ShieldCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Device } from '@/types/device.types';
import { useDeviceGroupsQuery, useUpdateDeviceGroupMembers } from '@/hooks/useDeviceGroups';
import { toast } from '@/hooks/useToast';

/**
 * Per-device "Manage groups": tick the custom groups this device should belong to.
 * Each toggle is saved immediately through the group's incremental members endpoint.
 */
export function ManageDeviceGroupsModal({ device, onClose }: { device: Device; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: groups = [], isLoading } = useDeviceGroupsQuery();
  const membersMutation = useUpdateDeviceGroupMembers();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const customGroups = useMemo(() => groups.filter((g) => !g.system), [groups]);
  const memberOf = useMemo(
    () => new Set(customGroups.filter((g) => g.deviceUuids.includes(device.deviceUuid)).map((g) => g.id)),
    [customGroups, device.deviceUuid]
  );

  const toggle = async (groupId: number, groupName: string) => {
    setPendingId(groupId);
    const isMember = memberOf.has(groupId);
    try {
      await membersMutation.mutateAsync(
        isMember
          ? { id: groupId, removeDeviceUuids: [device.deviceUuid] }
          : { id: groupId, addDeviceUuids: [device.deviceUuid] }
      );
      toast({
        variant: 'success',
        title: isMember ? 'Removed from group' : 'Added to group',
        description: `${device.deviceName || device.deviceUuid} ${isMember ? 'left' : 'joined'} "${groupName}".`,
      });
    } catch {
      /* toast handled by the hook */
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl animate-sheet-up pb-safe sm:animate-none sm:rounded-lg sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-blue-50 p-2">
              <Layers className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">Manage Groups</h2>
              <p className="truncate text-xs text-muted-foreground">{device.deviceName || 'Unnamed Device'} · {device.userEmail || device.deviceUuid}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-5 py-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Always in the system group <span className="font-medium text-foreground">All</span>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading groups…
            </div>
          ) : customGroups.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No custom groups yet.
              <button
                type="button"
                onClick={() => navigate('/dashboard?tab=device-groups')}
                className="mx-auto mt-2 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Create one in Device Groups <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {customGroups.map((g) => {
                const checked = memberOf.has(g.id);
                const busy = pendingId === g.id;
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      disabled={busy || membersMutation.isPending}
                      onClick={() => toggle(g.id, g.name)}
                      className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${checked ? 'bg-blue-50' : 'hover:bg-gray-50'} disabled:opacity-60`}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                          checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin text-white" /> : checked && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{g.description || 'No description'}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{g.deviceCount}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
