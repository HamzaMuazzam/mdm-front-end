import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Check,
  CheckSquare,
  Square,
  Loader2,
  Smartphone,
  History,
  ShieldCheck,
  UserPlus,
  UserMinus,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissionStore } from '@/store/permissionStore';
import { useDevicesQuery } from '@/hooks/useDevices';
import {
  useBulkOperationsQuery,
  useCreateDeviceGroup,
  useDeleteDeviceGroup,
  useDeviceGroupsQuery,
  useUpdateDeviceGroup,
  useUpdateDeviceGroupMembers,
} from '@/hooks/useDeviceGroups';
import { toast } from '@/hooks/useToast';
import type { Device } from '@/types/device.types';
import { BULK_MODULE_LABELS, type BulkModule, type BulkOperationLog, type DeviceGroup } from '@/types/bulk.types';

// ─── Shared: searchable device multi-select ───────────────────────────────────

function DeviceMultiSelect({
  devices,
  selected,
  onChange,
  emptyText = 'No devices found',
  maxHeightClass = 'max-h-72',
}: {
  devices: Device[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  emptyText?: string;
  maxHeightClass?: string;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        (d.deviceName || '').toLowerCase().includes(q) ||
        (d.userEmail || '').toLowerCase().includes(q) ||
        d.deviceUuid.toLowerCase().includes(q) ||
        (d.phone || '').toLowerCase().includes(q)
    );
  }, [devices, search]);

  const allSelected = filtered.length > 0 && filtered.every((d) => selected.has(d.deviceUuid));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) filtered.forEach((d) => next.delete(d.deviceUuid));
    else filtered.forEach((d) => next.add(d.deviceUuid));
    onChange(next);
  };
  const toggleOne = (uuid: string) => {
    const next = new Set(selected);
    next.has(uuid) ? next.delete(uuid) : next.add(uuid);
    onChange(next);
  };

  return (
    <div className="flex flex-col rounded-md border border-gray-200">
      <div className="space-y-2 border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search devices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggleAll}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {allSelected ? 'Deselect all shown' : `Select all shown (${filtered.length})`}
          </button>
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
        </div>
      </div>
      <div className={`${maxHeightClass} divide-y divide-border overflow-y-auto`}>
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{emptyText}</div>
        ) : (
          filtered.map((d) => {
            const isSel = selected.has(d.deviceUuid);
            return (
              <button
                key={d.deviceUuid}
                type="button"
                onClick={() => toggleOne(d.deviceUuid)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${isSel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                    isSel ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
                  }`}
                >
                  {isSel && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{d.deviceName || 'Unnamed Device'}</p>
                  <p className="truncate text-xs text-muted-foreground">{d.userEmail || d.deviceUuid}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Shared: modal shell ──────────────────────────────────────────────────────

function Modal({
  title,
  subtitle,
  icon: Icon = Layers,
  onClose,
  children,
  footer,
  widthClass = 'max-w-lg',
}: {
  title: string;
  subtitle?: string;
  icon?: typeof Layers;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  widthClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`flex max-h-[92vh] w-full ${widthClass} flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl animate-sheet-up pb-safe sm:animate-none sm:rounded-lg sm:pb-0`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-blue-50 p-2">
              <Icon className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">{children}</div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>
      </div>
    </div>
  );
}

// ─── Create / edit dialogs ────────────────────────────────────────────────────

function CreateGroupDialog({ devices, onClose }: { devices: Device[]; onClose: () => void }) {
  const createMutation = useCreateDeviceGroup();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Group name is required.');
    if (trimmed.toLowerCase() === 'all') return setError('"All" is reserved for the system group.');
    setError('');
    try {
      await createMutation.mutateAsync({ name: trimmed, description: description.trim() || undefined, deviceUuids: Array.from(selected) });
      onClose();
    } catch {
      /* toast handled by the hook */
    }
  };

  return (
    <Modal
      title="New Device Group"
      subtitle="Name the group and optionally add devices now — you can change members any time"
      onClose={onClose}
      widthClass="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create group{selected.size ? ` with ${selected.size} device${selected.size === 1 ? '' : 's'}` : ''}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dg-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Name *
          </Label>
          <Input id="dg-name" placeholder="e.g. Sales" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dg-desc" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Description
          </Label>
          <Input id="dg-desc" placeholder="Optional" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Initial members (optional)</Label>
        <DeviceMultiSelect devices={devices} selected={selected} onChange={setSelected} />
      </div>
    </Modal>
  );
}

function EditGroupDialog({ group, onClose }: { group: DeviceGroup; onClose: () => void }) {
  const updateMutation = useUpdateDeviceGroup();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [error, setError] = useState('');

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Group name is required.');
    if (trimmed.toLowerCase() === 'all') return setError('"All" is reserved for the system group.');
    setError('');
    try {
      await updateMutation.mutateAsync({ id: group.id, name: trimmed, description: description.trim() });
      onClose();
    } catch {
      /* toast handled by the hook */
    }
  };

  return (
    <Modal
      title="Edit Group"
      subtitle="Rename the group or change its description"
      icon={Pencil}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="dg-edit-name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Name *
        </Label>
        <Input id="dg-edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dg-edit-desc" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Description
        </Label>
        <Input id="dg-edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

function AddMembersDialog({ group, candidates, onClose }: { group: DeviceGroup; candidates: Device[]; onClose: () => void }) {
  const membersMutation = useUpdateDeviceGroupMembers();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const submit = async () => {
    if (selected.size === 0) return;
    try {
      await membersMutation.mutateAsync({ id: group.id, addDeviceUuids: Array.from(selected) });
      toast({ variant: 'success', title: 'Members added', description: `${selected.size} device${selected.size === 1 ? '' : 's'} added to "${group.name}".` });
      onClose();
    } catch {
      /* toast handled by the hook */
    }
  };

  return (
    <Modal
      title={`Add devices to "${group.name}"`}
      subtitle="Devices already in the group are not listed"
      icon={UserPlus}
      onClose={onClose}
      widthClass="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={selected.size === 0 || membersMutation.isPending}>
            {membersMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {selected.size || ''} device{selected.size === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <DeviceMultiSelect
        devices={candidates}
        selected={selected}
        onChange={setSelected}
        emptyText="Every device is already in this group"
        maxHeightClass="max-h-[50vh]"
      />
    </Modal>
  );
}

function DeleteGroupDialog({ group, onClose }: { group: DeviceGroup; onClose: () => void }) {
  const deleteMutation = useDeleteDeviceGroup();
  const submit = async () => {
    try {
      await deleteMutation.mutateAsync(group.id);
      onClose();
    } catch {
      /* toast handled by the hook */
    }
  };
  return (
    <Modal
      title={`Delete "${group.name}"?`}
      subtitle="Only the group is removed — its devices are not affected"
      icon={Trash2}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete group
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-700">
        {group.deviceCount} device{group.deviceCount === 1 ? '' : 's'} will leave this group. Any agent-update release targeted at this
        group stops applying to it. This cannot be undone.
      </p>
    </Modal>
  );
}

// ─── Bulk history ─────────────────────────────────────────────────────────────

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

function DetailsChips({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return <span className="text-xs text-muted-foreground">—</span>;
  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex max-w-full items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700">
          <span className="font-medium text-gray-500">{k}:</span>
          <span className="truncate font-mono">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
        </span>
      ))}
    </div>
  );
}

function OutcomeBadge({ log }: { log: BulkOperationLog }) {
  const failed = log.failedCount || 0;
  const ok = log.successCount || 0;
  if (log.module === 'DEVICE_GROUP') {
    return <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{ok} device{ok === 1 ? '' : 's'}</span>;
  }
  if (failed === 0) {
    return <span className="rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{ok} ok</span>;
  }
  return (
    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      {ok} ok · {failed} failed
    </span>
  );
}

export function BulkHistoryPanel({ compact = false }: { compact?: boolean }) {
  const [page, setPage] = useState(0);
  const [module, setModule] = useState<BulkModule | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const query = useMemo(
    () => ({
      page,
      size: compact ? 10 : 20,
      module: module || undefined,
      from: from ? `${from}T00:00:00` : undefined,
      to: to ? `${to}T23:59:59` : undefined,
    }),
    [page, module, from, to, compact]
  );
  const { data, isLoading, isFetching, refetch } = useBulkOperationsQuery(query);

  useEffect(() => setPage(0), [module, from, to]);

  const rows = data?.content ?? [];

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Bulk History
            <span className="text-xs font-normal text-muted-foreground">who changed what, on which groups and devices</span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={module}
              onChange={(e) => setModule(e.target.value as BulkModule | '')}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All modules</option>
              {(Object.keys(BULK_MODULE_LABELS) as BulkModule[]).map((m) => (
                <option key={m} value={m}>
                  {BULK_MODULE_LABELS[m]}
                </option>
              ))}
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs" />
            <span className="text-xs text-muted-foreground">to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs" />
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No bulk operations recorded yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Who</th>
                  <th className="px-3 py-2">Module</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Resolved</th>
                  <th className="px-3 py-2">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((log) => {
                  const isOpen = expanded === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr className="cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(isOpen ? null : log.id)}>
                        <td className="px-3 py-2 text-muted-foreground">
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">{formatDate(log.createdAt)}</td>
                        <td className="max-w-[12rem] truncate px-3 py-2 text-xs text-gray-700">{log.performedByEmail || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-medium text-gray-800">{BULK_MODULE_LABELS[log.module] || log.module}</td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] text-blue-700">{log.action}</span>
                        </td>
                        <td className="max-w-[16rem] truncate px-3 py-2 text-xs text-gray-700" title={log.targetDescription || ''}>
                          {log.targetDescription || '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700">
                          {log.resolvedCount ?? '—'}
                          {(log.skippedNotVisible || 0) > 0 && (
                            <span className="ml-1 text-[10px] text-amber-600" title="Devices outside the caller's scope were skipped">
                              (+{log.skippedNotVisible} skipped)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <OutcomeBadge log={log} />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/20">
                          <td />
                          <td colSpan={7} className="px-3 py-3">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Target</p>
                                {log.targetSummary ? (
                                  <div className="space-y-1 text-xs text-gray-700">
                                    {log.targetSummary.allDevices && <p>All devices of the account</p>}
                                    {!!log.targetSummary.groupNames?.length && <p>Groups: {log.targetSummary.groupNames.join(', ')}</p>}
                                    {!!log.targetSummary.explicitDeviceCount && <p>Individually picked: {log.targetSummary.explicitDeviceCount}</p>}
                                    <p>
                                      Requested {log.targetSummary.requestedCount ?? log.requestedCount ?? '—'} · resolved{' '}
                                      {log.targetSummary.resolvedCount ?? log.resolvedCount ?? '—'}
                                      {!!log.targetSummary.skippedInactive && ` · ${log.targetSummary.skippedInactive} deactivated skipped`}
                                      {!!log.targetSummary.notFoundUuids?.length && ` · ${log.targetSummary.notFoundUuids.length} not found`}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-700">{log.targetDescription || '—'}</p>
                                )}
                              </div>
                              <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Changes</p>
                                <DetailsChips details={log.details} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {data && data.totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <span>
              Page {data.number + 1} of {data.totalPages} · {data.totalElements} record{data.totalElements === 1 ? '' : 's'}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={data.first} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DeviceGroupManagement() {
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const canManage = hasPermission('devices:update');

  const { data: groups = [], isLoading: groupsLoading, isFetching, refetch } = useDeviceGroupsQuery();
  const { data: allDevices = [] } = useDevicesQuery();
  const devices = useMemo(() => allDevices.filter((d) => !d.deletedAt), [allDevices]);
  const deviceByUuid = useMemo(() => new Map(devices.map((d) => [d.deviceUuid, d] as const)), [devices]);

  const membersMutation = useUpdateDeviceGroupMembers();

  const [view, setView] = useState<'groups' | 'history'>('groups');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DeviceGroup | null>(null);
  const [deleting, setDeleting] = useState<DeviceGroup | null>(null);
  const [adding, setAdding] = useState<DeviceGroup | null>(null);
  const [removingUuid, setRemovingUuid] = useState<string | null>(null);

  // Keep a sensible selection: first group by default, fall back when the selected one disappears.
  useEffect(() => {
    if (groups.length === 0) return;
    if (selectedId === null || !groups.some((g) => g.id === selectedId)) setSelectedId(groups[0].id);
  }, [groups, selectedId]);

  const selected = groups.find((g) => g.id === selectedId) ?? null;

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q));
  }, [groups, groupSearch]);

  const members = useMemo(() => {
    if (!selected) return [] as Device[];
    const list = selected.deviceUuids.map((u) => deviceByUuid.get(u)).filter((d): d is Device => !!d);
    const q = memberSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (d) =>
        (d.deviceName || '').toLowerCase().includes(q) ||
        (d.userEmail || '').toLowerCase().includes(q) ||
        d.deviceUuid.toLowerCase().includes(q)
    );
  }, [selected, deviceByUuid, memberSearch]);

  const candidates = useMemo(() => {
    if (!selected) return [] as Device[];
    const present = new Set(selected.deviceUuids);
    return devices.filter((d) => !present.has(d.deviceUuid));
  }, [selected, devices]);

  const removeMember = async (uuid: string) => {
    if (!selected) return;
    setRemovingUuid(uuid);
    try {
      await membersMutation.mutateAsync({ id: selected.id, removeDeviceUuids: [uuid] });
    } finally {
      setRemovingUuid(null);
    }
  };

  const ungroupedCount = useMemo(() => {
    const grouped = new Set<string>();
    groups.filter((g) => !g.system).forEach((g) => g.deviceUuids.forEach((u) => grouped.add(u)));
    return devices.filter((d) => !grouped.has(d.deviceUuid)).length;
  }, [groups, devices]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Device Groups</h1>
          <p className="text-sm text-muted-foreground">
            Group devices once, then target whole groups in every bulk action, App Management and App Update.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView('groups')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                view === 'groups' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> Groups
            </button>
            <button
              type="button"
              onClick={() => setView('history')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                view === 'history' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <History className="h-3.5 w-3.5" /> Bulk History
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} title="Refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          {canManage && view === 'groups' && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Group
            </Button>
          )}
        </div>
      </div>

      {view === 'history' ? (
        <BulkHistoryPanel />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          {/* Left: group list */}
          <Card className="flex min-h-[14rem] flex-col lg:w-80 lg:min-h-0 lg:shrink-0">
            <CardHeader className="space-y-2 pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Groups
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {groups.length} · {ungroupedCount} ungrouped
                </span>
              </CardTitle>
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
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-auto p-0">
              {groupsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">{groups.length === 0 ? 'No groups yet.' : 'No groups match.'}</div>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredGroups.map((g) => {
                    const active = g.id === selectedId;
                    return (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(g.id)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                            active ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className={`rounded-md p-1.5 ${g.system ? 'bg-gray-100' : 'bg-blue-50'}`}>
                            {g.system ? <ShieldCheck className="h-4 w-4 text-gray-600" /> : <Layers className="h-4 w-4 text-blue-600" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-medium ${active ? 'text-blue-700' : 'text-foreground'}`}>{g.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {g.system ? 'System group · every device' : g.description || 'No description'}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{g.deviceCount}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Right: selected group */}
          <Card className="flex min-h-[20rem] flex-1 flex-col lg:min-h-0">
            {!selected ? (
              <CardContent className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {groupsLoading ? 'Loading…' : 'Select a group to see its devices.'}
              </CardContent>
            ) : (
              <>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        {selected.name}
                        {selected.system && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">System</span>
                        )}
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {selected.deviceCount} device{selected.deviceCount === 1 ? '' : 's'}
                        </span>
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selected.system
                          ? 'Automatically contains every active device of your account. It cannot be edited — use it in any bulk action to target the whole fleet.'
                          : selected.description || 'No description'}
                        {!selected.system && selected.createdByEmail && <> · created by {selected.createdByEmail}</>}
                      </p>
                    </div>
                    {canManage && !selected.system && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button size="sm" onClick={() => setAdding(selected)}>
                          <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add devices
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(selected)}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(selected)}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="relative mt-3">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search members…"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </CardHeader>
                <CardContent className="min-h-0 flex-1 overflow-auto p-0">
                  {members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                      <Smartphone className="h-6 w-6" />
                      {selected.deviceUuids.length === 0 ? 'No devices in this group yet.' : 'No members match your search.'}
                      {canManage && !selected.system && selected.deviceUuids.length === 0 && (
                        <Button size="sm" variant="outline" onClick={() => setAdding(selected)}>
                          <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add devices
                        </Button>
                      )}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {members.map((d) => (
                        <li key={d.deviceUuid} className="flex items-center gap-3 px-4 py-2.5">
                          <div className={`h-2 w-2 shrink-0 rounded-full ${d.online ? 'bg-green-500' : 'bg-gray-300'}`} title={d.online ? 'Online' : 'Offline'} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{d.deviceName || 'Unnamed Device'}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {d.userEmail || '—'} · {d.model || 'Unknown model'} · {d.deviceUuid}
                            </p>
                          </div>
                          {canManage && !selected.system && (
                            <button
                              type="button"
                              onClick={() => removeMember(d.deviceUuid)}
                              disabled={removingUuid === d.deviceUuid}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              title="Remove from group"
                            >
                              {removingUuid === d.deviceUuid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
                              Remove
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </div>
      )}

      {isCreateOpen && <CreateGroupDialog devices={devices} onClose={() => setIsCreateOpen(false)} />}
      {editing && <EditGroupDialog group={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteGroupDialog group={deleting} onClose={() => setDeleting(null)} />}
      {adding && <AddMembersDialog group={adding} candidates={candidates} onClose={() => setAdding(null)} />}
    </div>
  );
}
