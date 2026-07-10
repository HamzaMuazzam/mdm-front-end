import { useMemo, useState, type ReactNode, type ComponentType } from 'react';
import { X, Loader2, Search, Check, CheckSquare, Square, Users } from 'lucide-react';
import type { Device } from '@/types/device.types';

/**
 * Reusable shell for a per-module bulk-assignment modal: a searchable device multi-select on the
 * left, the module's own form (passed as children) on the right, and a shared apply footer.
 * Each concrete modal supplies its title/icon/form and an onApply that receives the selected uuids.
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
}: {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  devices: Device[];
  isPending: boolean;
  applyVerb?: string;
  /** Extra gate on top of "at least one device selected". */
  canApply?: boolean;
  onApply: (deviceUuids: string[]) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        (d.deviceName || '').toLowerCase().includes(q) ||
        (d.userEmail || '').toLowerCase().includes(q) ||
        d.deviceUuid.toLowerCase().includes(q)
    );
  }, [devices, search]);

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filtered.map((d) => d.deviceUuid)));
  const toggleOne = (uuid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uuid) ? next.delete(uuid) : next.add(uuid);
      return next;
    });

  const ready = selected.size > 0 && canApply && !isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 pt-5 pb-4 shrink-0">
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

        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Device selection */}
          <div className="flex flex-col sm:w-80 border-b sm:border-b-0 sm:border-r border-border max-h-64 sm:max-h-none">
            <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search devices…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                {allSelected ? 'Deselect all' : `Select all (${filtered.length})`}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">No devices found</div>
              ) : (
                filtered.map((device) => {
                  const isSel = selected.has(device.deviceUuid);
                  return (
                    <button
                      key={device.deviceUuid}
                      type="button"
                      onClick={() => toggleOne(device.deviceUuid)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSel ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                          isSel ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSel && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {device.deviceName || 'Unnamed Device'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {device.userEmail || device.deviceUuid}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-border bg-muted/30 shrink-0">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span>
                  <span className="font-semibold text-foreground">{selected.size}</span> device
                  {selected.size !== 1 ? 's' : ''} selected
                </span>
              </p>
            </div>
          </div>

          {/* Module form */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => ready && onApply(Array.from(selected))}
            disabled={!ready}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {applyVerb} to {selected.size} device{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
