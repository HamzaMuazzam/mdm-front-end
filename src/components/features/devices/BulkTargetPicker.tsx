import { useMemo, useState } from 'react';
import { Check, CheckSquare, Square, Search, Layers, Smartphone, Lock, Loader2, X } from 'lucide-react';
import type { Device } from '@/types/device.types';
import type { BulkTarget, DeviceGroup } from '@/types/bulk.types';

/**
 * What the admin picked: whole groups and/or individual devices. The account's system "All" group
 * is just a group here (selecting it means "every device"); `selectionToTarget` turns it into the
 * backend's `allDevices` flag.
 */
export interface BulkTargetSelection {
  groupIds: Set<number>;
  deviceUuids: Set<string>;
}

export const emptySelection = (): BulkTargetSelection => ({ groupIds: new Set(), deviceUuids: new Set() });

export function selectionFromDevices(deviceUuids: string[]): BulkTargetSelection {
  return { groupIds: new Set(), deviceUuids: new Set(deviceUuids) };
}

/** Backend contract: `allDevices` for the system group, custom group ids, explicit uuids. */
export function selectionToTarget(sel: BulkTargetSelection, groups: DeviceGroup[]): BulkTarget {
  const systemIds = new Set(groups.filter((g) => g.system).map((g) => g.id));
  const allDevices = Array.from(sel.groupIds).some((id) => systemIds.has(id));
  const groupIds = Array.from(sel.groupIds).filter((id) => !systemIds.has(id));
  const target: BulkTarget = {};
  if (allDevices) target.allDevices = true;
  if (groupIds.length) target.groupIds = groupIds;
  if (sel.deviceUuids.size) target.deviceUuids = Array.from(sel.deviceUuids);
  return target;
}

/** Union of group members and explicit devices (what the server will resolve, before its own scoping). */
export function effectiveDeviceUuids(sel: BulkTargetSelection, groups: DeviceGroup[], devices: Device[]): Set<string> {
  const out = new Set<string>();
  const byId = new Map(groups.map((g) => [g.id, g] as const));
  let all = false;
  sel.groupIds.forEach((id) => {
    const g = byId.get(id);
    if (!g) return;
    if (g.system) all = true;
    else g.deviceUuids.forEach((u) => out.add(u));
  });
  if (all) devices.forEach((d) => out.add(d.deviceUuid));
  sel.deviceUuids.forEach((u) => out.add(u));
  return out;
}

export function isSelectionEmpty(sel: BulkTargetSelection): boolean {
  return sel.groupIds.size === 0 && sel.deviceUuids.size === 0;
}

/** "Sales (300) + Office (200) + 3 devices" */
export function describeSelection(sel: BulkTargetSelection, groups: DeviceGroup[]): string {
  const byId = new Map(groups.map((g) => [g.id, g] as const));
  const parts: string[] = [];
  sel.groupIds.forEach((id) => {
    const g = byId.get(id);
    if (g) parts.push(`${g.name} (${g.deviceCount})`);
  });
  if (sel.deviceUuids.size) parts.push(`${sel.deviceUuids.size} device${sel.deviceUuids.size === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' + ') : 'nothing selected';
}

type Tab = 'groups' | 'devices';

/**
 * Reusable group / device target picker used by every bulk flow.
 *
 * Groups tab: checkbox list of the account's groups ("All" pinned first). Devices tab: searchable
 * device list with a group filter; devices already covered by a checked group show as ticked and
 * locked. The footer previews the effective selection; the backend re-resolves authoritatively.
 */
export function BulkTargetPicker({
  devices,
  groups,
  groupsLoading = false,
  value,
  onChange,
  lockedDeviceUuids = [],
  initialTab = 'groups',
  compact = false,
}: {
  devices: Device[];
  groups: DeviceGroup[];
  groupsLoading?: boolean;
  value: BulkTargetSelection;
  onChange: (next: BulkTargetSelection) => void;
  /** Pre-selected devices that cannot be unselected (e.g. the device whose form we came from). */
  lockedDeviceUuids?: string[];
  initialTab?: Tab;
  /** Tighter paddings for popovers. */
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(groups.length === 0 && !groupsLoading ? 'devices' : initialTab);
  const [groupSearch, setGroupSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | 'ungrouped' | number>('all');

  const locked = useMemo(() => new Set(lockedDeviceUuids), [lockedDeviceUuids]);
  const activeDevices = useMemo(() => devices.filter((d) => !d.deletedAt), [devices]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g] as const)), [groups]);

  /** uuid → names of the *selected* groups that cover it. */
  const coveredBy = useMemo(() => {
    const map = new Map<string, string[]>();
    let all: DeviceGroup | null = null;
    value.groupIds.forEach((id) => {
      const g = groupById.get(id);
      if (!g) return;
      if (g.system) {
        all = g;
        return;
      }
      g.deviceUuids.forEach((u) => map.set(u, [...(map.get(u) || []), g.name]));
    });
    if (all) {
      const allGroup: DeviceGroup = all;
      activeDevices.forEach((d) => map.set(d.deviceUuid, [allGroup.name]));
    }
    return map;
  }, [value.groupIds, groupById, activeDevices]);

  /** uuid → custom groups the device belongs to (for the filter + hint). */
  const membership = useMemo(() => {
    const map = new Map<string, DeviceGroup[]>();
    groups.filter((g) => !g.system).forEach((g) => g.deviceUuids.forEach((u) => map.set(u, [...(map.get(u) || []), g])));
    return map;
  }, [groups]);

  const effective = useMemo(() => effectiveDeviceUuids(value, groups, activeDevices), [value, groups, activeDevices]);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    return groups.filter((g) => !q || g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q));
  }, [groups, groupSearch]);

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();
    return activeDevices.filter((d) => {
      if (groupFilter === 'ungrouped' && (membership.get(d.deviceUuid)?.length || 0) > 0) return false;
      if (typeof groupFilter === 'number' && !(membership.get(d.deviceUuid) || []).some((g) => g.id === groupFilter)) return false;
      if (!q) return true;
      return (
        (d.deviceName || '').toLowerCase().includes(q) ||
        (d.userEmail || '').toLowerCase().includes(q) ||
        d.deviceUuid.toLowerCase().includes(q) ||
        (d.phone || '').toLowerCase().includes(q)
      );
    });
  }, [activeDevices, deviceSearch, groupFilter, membership]);

  const allSelected = value.groupIds.size > 0 && Array.from(value.groupIds).some((id) => groupById.get(id)?.system);

  const toggleGroup = (g: DeviceGroup) => {
    const next = new Set(value.groupIds);
    next.has(g.id) ? next.delete(g.id) : next.add(g.id);
    onChange({ ...value, groupIds: next });
  };

  const toggleDevice = (uuid: string) => {
    if (locked.has(uuid)) return;
    const next = new Set(value.deviceUuids);
    next.has(uuid) ? next.delete(uuid) : next.add(uuid);
    onChange({ ...value, deviceUuids: next });
  };

  const selectableFiltered = filteredDevices.filter((d) => !coveredBy.has(d.deviceUuid));
  const allFilteredSelected =
    selectableFiltered.length > 0 && selectableFiltered.every((d) => value.deviceUuids.has(d.deviceUuid));
  const toggleAllFiltered = () => {
    const next = new Set(value.deviceUuids);
    if (allFilteredSelected) {
      selectableFiltered.forEach((d) => {
        if (!locked.has(d.deviceUuid)) next.delete(d.deviceUuid);
      });
    } else {
      selectableFiltered.forEach((d) => next.add(d.deviceUuid));
    }
    onChange({ ...value, deviceUuids: next });
  };

  const clearAll = () => onChange({ groupIds: new Set(), deviceUuids: new Set(lockedDeviceUuids) });

  const pad = compact ? 'px-3' : 'px-4';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Tabs */}
      <div className={`flex shrink-0 items-center gap-1 border-b border-border ${pad} pt-2`}>
        {(
          [
            { key: 'groups', label: 'Groups', icon: Layers, count: groups.length },
            { key: 'devices', label: 'Devices', icon: Smartphone, count: activeDevices.length },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs font-semibold transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'groups' ? (
        <>
          <div className={`shrink-0 space-y-2 border-b border-border ${pad} py-3`}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search groups…"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pick whole groups. Switch to <span className="font-medium">Devices</span> to add single devices from any group.
            </p>
          </div>
          <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {groupsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading groups…
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {groups.length === 0 ? 'No groups yet — create them under Devices › Device Groups.' : 'No groups match your search'}
              </div>
            ) : (
              filteredGroups.map((g) => {
                const isSel = value.groupIds.has(g.id);
                const impliedByAll = allSelected && !g.system;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGroup(g)}
                    className={`flex w-full items-center gap-3 ${pad} py-2.5 text-left transition-colors ${
                      isSel ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        isSel ? 'border-blue-600 bg-blue-600' : impliedByAll ? 'border-blue-300 bg-blue-100' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {(isSel || impliedByAll) && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                        {g.name}
                        {g.system && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                            System
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {g.description || (g.system ? 'Every active device of your account' : 'No description')}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {g.deviceCount}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          <div className={`shrink-0 space-y-2 border-b border-border ${pad} py-3`}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search devices…"
                  value={deviceSearch}
                  onChange={(e) => setDeviceSearch(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <select
                value={typeof groupFilter === 'number' ? String(groupFilter) : groupFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setGroupFilter(v === 'all' || v === 'ungrouped' ? v : Number(v));
                }}
                className="max-w-[40%] rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                title="Filter by group"
              >
                <option value="all">All groups</option>
                <option value="ungrouped">Ungrouped</option>
                {groups
                  .filter((g) => !g.system)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.deviceCount})
                    </option>
                  ))}
              </select>
            </div>
            <button
              type="button"
              onClick={toggleAllFiltered}
              disabled={selectableFiltered.length === 0}
              className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {allFilteredSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              {allFilteredSelected ? 'Deselect all shown' : `Select all shown (${selectableFiltered.length})`}
            </button>
          </div>
          <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {filteredDevices.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No devices found</div>
            ) : (
              filteredDevices.map((device) => {
                const via = coveredBy.get(device.deviceUuid);
                const isLocked = locked.has(device.deviceUuid);
                const isSel = !!via || value.deviceUuids.has(device.deviceUuid);
                const memberOf = membership.get(device.deviceUuid) || [];
                return (
                  <button
                    key={device.deviceUuid}
                    type="button"
                    onClick={() => !via && toggleDevice(device.deviceUuid)}
                    disabled={!!via || isLocked}
                    className={`flex w-full items-center gap-3 ${pad} py-2.5 text-left transition-colors ${
                      isSel ? 'bg-blue-50' : 'hover:bg-gray-50'
                    } ${via || isLocked ? 'cursor-default' : ''}`}
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        isSel ? (via || isLocked ? 'border-blue-300 bg-blue-400' : 'border-blue-600 bg-blue-600') : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSel && (isLocked && !via ? <Lock className="h-2.5 w-2.5 text-white" /> : <Check className="h-2.5 w-2.5 text-white" />)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{device.deviceName || 'Unnamed Device'}</p>
                      <p className="truncate text-xs text-muted-foreground">{device.userEmail || device.deviceUuid}</p>
                      {memberOf.length > 0 && (
                        <p className="mt-0.5 flex flex-wrap gap-1">
                          {memberOf.slice(0, 3).map((g) => (
                            <span key={g.id} className="rounded bg-gray-100 px-1.5 py-px text-[10px] text-gray-600">
                              {g.name}
                            </span>
                          ))}
                          {memberOf.length > 3 && <span className="text-[10px] text-muted-foreground">+{memberOf.length - 3}</span>}
                        </p>
                      )}
                    </div>
                    {via && <span className="shrink-0 text-[10px] font-medium text-blue-600">via {via[0]}</span>}
                    {!via && isLocked && <span className="shrink-0 text-[10px] font-medium text-muted-foreground">this device</span>}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Summary */}
      <div className={`flex shrink-0 items-center justify-between gap-2 border-t border-border bg-muted/30 ${pad} py-2`}>
        <p className="min-w-0 truncate text-xs text-muted-foreground" title={describeSelection(value, groups)}>
          <span className="font-semibold text-foreground">{effective.size}</span> device{effective.size === 1 ? '' : 's'}
          {!isSelectionEmpty(value) && <span className="text-muted-foreground"> · {describeSelection(value, groups)}</span>}
        </p>
        {!isSelectionEmpty(value) && (
          <button
            type="button"
            onClick={clearAll}
            className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
